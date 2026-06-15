/**
 * Nassayem — Suitelet that creates a payment link on the website.
 *
 * Called by the Client Script (cs_payment_link.js). Reads the reservation
 * record, builds the request payload, signs it with the shared secret
 * (kept server-side as a script parameter), and POSTs to the website API.
 *
 * Deployment notes:
 *   - Script type: Suitelet
 *   - Available Without Login: NO (require NetSuite session)
 *   - Audience: any internal role allowed to create payment links
 *
 * Required script parameters (defined on the Script record):
 *   custscript_nass_website_url   — e.g. https://nassayem.com
 *   custscript_nass_inbound_secret — same value as NETSUITE_INBOUND_SECRET on the website
 *
 * Customise the FIELD_IDS map below to match your reservation record schema.
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(["N/record", "N/https", "N/runtime", "N/format", "N/log", "N/search"],
  function (record, https, runtime, format, log, search) {

    // ── EDIT ME: Field-id map for the reservation record ─────────────────────
    // Replace the right-hand strings with the actual NetSuite field IDs you
    // use on your reservation record. Anything you don't have can stay null —
    // the website API only requires netsuiteReservationId, customerName, amount.
    var FIELD_IDS = {
      reservationRef: "tranid",                       // human-readable id (e.g. "RES-2026-00412")
      customerEntity: "entity",                       // standard customer link
      customerNameTxt: "custbody_ns_customer_name",  // free-text fallback
      customerPhone: "custbody_nass_customer_phone",
      customerEmail: "custbody_nass_customer_email",
      checkIn: "custbody_nass_check_in",
      checkOut: "custbody_nass_check_out",
      unitCode: "custbody_nass_unit_code",
      // Building reference on the reservation. For a List/Record field this
      // returns the building's internal id — put that same id into the
      // "NetSuite Building ID" field on the matching website building so the
      // website can scope receptionists to their building(s).
      // ⚠ Replace with the real field id on your reservation record.
      buildingId: "custbody_nass_building_id",
      description: "custbody_nass_payment_note",   // optional — shown to customer
    };
    // ─────────────────────────────────────────────────────────────────────────

    function onRequest(context) {
      if (context.request.method !== "POST") {
        respond(context, 405, { ok: false, error: "Method not allowed" });
        return;
      }

      var script = runtime.getCurrentScript();
      // var websiteUrl = (script.getParameter({ name: "custscript_nass_website_url" }) || "").replace(/\/$/, "");
      var websiteUrl = "https://www.nassayem.com";
      // var secret = script.getParameter({ name: "custscript_nass_inbound_secret" });
      var secret = "nidhalghdiri98590405";

      if (!websiteUrl || !secret) {
        log.error({
          title: "sl_payment_link config missing",
          details: "Set custscript_nass_website_url and custscript_nass_inbound_secret on the script record",
        });
        respond(context, 500, { ok: false, error: "Server misconfigured (script parameters missing)" });
        return;
      }

      var body;
      try {
        body = JSON.parse(context.request.body || "{}");
      } catch (e) {
        respond(context, 400, { ok: false, error: "Invalid JSON" });
        return;
      }

      var recordType = body.recordType;
      var recordId = body.recordId;
      var amount = parseFloat(body.amount);
      var locale = body.locale === "ar" ? "ar" : "en";
      var description = body.description || null;

      if (!recordType || !recordId) {
        respond(context, 400, { ok: false, error: "recordType and recordId are required" });
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        respond(context, 400, { ok: false, error: "amount must be a positive number" });
        return;
      }

      // ── Load the reservation ────────────────────────────────────────────────
      var rec;
      try {
        rec = record.load({ type: recordType, id: recordId, isDynamic: false });
      } catch (e) {
        log.error({ title: "Reservation load failed", details: e });
        respond(context, 404, { ok: false, error: "Reservation not found: " + e.message });
        return;
      }

      // ── Extract reservation data ────────────────────────────────────────────
      var reservationRef = safeGetValue(rec, FIELD_IDS.reservationRef) || ("ID-" + recordId);

      // Customer name: prefer linked customer record, fall back to text field
      var customerName = "";
      var customerEntityId = safeGetValue(rec, FIELD_IDS.customerEntity);
      if (customerEntityId) {
        customerName = safeGetText(rec, FIELD_IDS.customerEntity) || "";
      }
      if (!customerName) {
        customerName = safeGetValue(rec, FIELD_IDS.customerNameTxt) || "";
      }

      var customerPhone = safeGetValue(rec, FIELD_IDS.customerPhone);
      var customerEmail = safeGetValue(rec, FIELD_IDS.customerEmail);

      // If customer linked, look up phone/email from the customer record when missing
      if (customerEntityId && (!customerPhone || !customerEmail)) {
        try {
          var customer = record.load({
            type: record.Type.CUSTOMER,
            id: customerEntityId,
            isDynamic: false,
          });
          if (!customerPhone) customerPhone = customer.getValue({ fieldId: "phone" }) || customer.getValue({ fieldId: "mobilephone" });
          if (!customerEmail) customerEmail = customer.getValue({ fieldId: "email" });
          if (!customerName) customerName = customer.getValue({ fieldId: "companyname" }) || customer.getValue({ fieldId: "entityid" });
        } catch (e) {
          log.audit({ title: "Customer lookup skipped", details: e.message });
        }
      }

      if (!customerName) {
        respond(context, 400, {
          ok: false,
          error: "Could not resolve customer name from the reservation. Please set a customer or fill the customer-name field.",
        });
        return;
      }

      var checkIn = isoDate(safeGetValue(rec, FIELD_IDS.checkIn));
      var checkOut = isoDate(safeGetValue(rec, FIELD_IDS.checkOut));
      var unitCode = safeGetValue(rec, FIELD_IDS.unitCode);
      var buildingId = safeGetValue(rec, FIELD_IDS.buildingId);
      var recordDescription = safeGetValue(rec, FIELD_IDS.description);

      // ── Receptionist (current user) ─────────────────────────────────────────
      var user = runtime.getCurrentUser();
      var receptionistEmail = user.email || null;
      var receptionistName = user.name || null;

      // ── Build description shown to customer ─────────────────────────────────
      var finalDescription = description || recordDescription;
      if (!finalDescription) {
        var bits = [];
        if (unitCode) bits.push("Unit " + unitCode);
        if (checkIn && checkOut) bits.push(formatRange(checkIn, checkOut));
        if (bits.length) finalDescription = "Reservation: " + bits.join(" · ");
      }

      // ── Call website API ────────────────────────────────────────────────────
      var payload = {
        netsuiteReservationId: String(recordId),
        netsuiteReservationRef: reservationRef,
        netsuiteBuildingId: buildingId ? String(buildingId) : null,
        unitCode: unitCode || null,
        checkIn: checkIn,
        checkOut: checkOut,
        customerName: customerName,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        amount: Number(amount.toFixed(3)),
        currency: "OMR",
        description: finalDescription || null,
        receptionistEmail: receptionistEmail,
        receptionistName: receptionistName,
        locale: locale,
      };

      log.audit({ title: "Creating payment link", details: payload });

      var targetUrl = websiteUrl + "/api/netsuite/payment-link";
      var requestId = "ns-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
      // Send the secret under several header names + Authorization Bearer so the
      // route accepts whichever shape it actually checks. Harmless if extras are ignored.
      var requestHeaders = {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json",
        "User-Agent": "NetSuite-Suitelet/1.0",
        "x-netsuite-secret": secret,
        "x-netsuite-shared-secret": secret,
        "x-inbound-secret": secret,
        "Authorization": "Bearer " + secret,
        "x-request-id": requestId,
      };
      var requestBody = JSON.stringify(payload);

      log.audit({
        title: "Outbound request — target",
        details: {
          url: targetUrl,
          method: "POST",
          requestId: requestId,
          headerKeys: Object.keys(requestHeaders),
          secretFingerprint: fingerprintSecret(secret),
          payloadBytes: requestBody.length,
        },
      });

      var response;
      try {
        response = https.post({
          url: targetUrl,
          body: requestBody,
          headers: requestHeaders,
        });
      } catch (e) {
        log.error({ title: "Website API call failed", details: e });
        respond(context, 502, { ok: false, error: "Could not reach website: " + e.message });
        return;
      }

      log.audit({
        title: "Outbound response — raw",
        details: {
          code: response.code,
          headers: response.headers || null,
          bodyLength: (response.body || "").length,
          bodyPreview: (response.body || "").slice(0, 1000),
        },
      });

      var apiData;
      try {
        apiData = JSON.parse(response.body);
      } catch (e) {
        log.error({ title: "Website returned non-JSON", details: response.body });
        respond(context, 502, { ok: false, error: "Website returned an unexpected response" });
        return;
      }

      if (response.code >= 200 && response.code < 300 && apiData.ok) {
        respond(context, 200, {
          ok: true,
          url: apiData.url,
          token: apiData.token,
          paymentLinkId: apiData.paymentLinkId,
          reused: apiData.reused === true,
          expiresAt: apiData.expiresAt,
          customerPhone: customerPhone || null,
        });
        return;
      }

      log.error({
        title: "Website rejected payment-link request",
        details: { code: response.code, body: apiData },
      });
      respond(context, response.code || 502, {
        ok: false,
        error: apiData.error || "Website rejected the request",
      });
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    function safeGetValue(rec, fieldId) {
      if (!fieldId) return null;
      try {
        var v = rec.getValue({ fieldId: fieldId });
        return v === "" ? null : v;
      } catch (e) {
        return null;
      }
    }

    function safeGetText(rec, fieldId) {
      if (!fieldId) return null;
      try {
        var v = rec.getText({ fieldId: fieldId });
        return v === "" ? null : v;
      } catch (e) {
        return null;
      }
    }

    function fingerprintSecret(s) {
      if (s === null || s === undefined) return { present: false };
      var str = String(s);
      var trimmed = str.replace(/^\s+|\s+$/g, "");
      return {
        present: true,
        length: str.length,
        trimmedLength: trimmed.length,
        hasWhitespace: str.length !== trimmed.length,
        first2: trimmed.slice(0, 2),
        last2: trimmed.slice(-2),
      };
    }

    function isoDate(d) {
      if (!d) return null;
      if (typeof d === "string") return d; // already a string — assume yyyy-mm-dd
      try {
        // d is a Date object
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
      } catch (e) {
        return null;
      }
    }

    function formatRange(a, b) {
      return a + " → " + b;
    }

    function respond(context, code, body) {
      context.response.setHeader({ name: "Content-Type", value: "application/json" });
      if (code) {
        try { context.response.setHeader({ name: "X-Status-Code", value: String(code) }); } catch (e) { }
      }
      context.response.write({ output: JSON.stringify(body) });
    }

    return { onRequest: onRequest };
  });
