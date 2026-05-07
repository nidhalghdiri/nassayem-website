/**
 * Nassayem — Client Script for the "Online Payment" button.
 *
 * This version makes the request to the website DIRECTLY from the browser
 * using fetch(), instead of going through a Suitelet that uses N/https.
 * Doing so avoids the issue where N/https mutated the secret header.
 *
 * Trade-off: WEBSITE_BASE_URL and INBOUND_SECRET live in this client-side
 * script, so anyone who can open the reservation form and view its sources
 * in browser DevTools can see them. This is acceptable because: (1) the
 * shared secret only authorises creating payment links — it cannot read
 * existing payments or charge anyone, and (2) the secret can be rotated
 * at any time by editing this file plus NETSUITE_INBOUND_SECRET on Vercel.
 *
 * Required NetSuite "Allowed Domain" list:
 *   Setup → Company → Setup Tasks → Allowed Domain List
 *   Add: nassayem.com  (or whatever WEBSITE_BASE_URL hostname is)
 * Without this entry, NetSuite's Content Security Policy will block the
 * fetch() call.
 *
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(["N/currentRecord", "N/search", "N/runtime", "N/ui/dialog"],
function (currentRecord, search, runtime, dialog) {

  // ── EDIT ME ────────────────────────────────────────────────────────────────
  var WEBSITE_BASE_URL = "https://www.nassayem.com";
  var INBOUND_SECRET = "nidhalghdiri98590405";

  // Field-id map for the reservation record. Replace with your actual ids.
  var FIELD_IDS = {
    reservationRef:  "tranid",                       // human-readable id
    customerEntity:  "entity",                       // standard customer link
    customerNameTxt: "custbody_ns_customer_name",    // free-text fallback
    customerPhone:   "custbody_nass_customer_phone",
    customerEmail:   "custbody_nass_customer_email",
    checkIn:         "custbody_nass_check_in",
    checkOut:        "custbody_nass_check_out",
    unitCode:        "custbody_nass_unit_code",
    description:     "custbody_nass_payment_note",
  };
  // ────────────────────────────────────────────────────────────────────────────

  function pageInit() {
    // No-op. Required by Client Script type.
  }

  function showPaymentLinkDialog() {
    var rec = currentRecord.get();

    if (!rec.id) {
      dialog.alert({
        title: "Save first",
        message: "Please save the reservation before creating a payment link.",
      });
      return;
    }

    // Step 1 — ask for amount
    var raw = window.prompt("Enter the amount to charge the customer (OMR):", "");
    if (raw === null) return;
    var amount = parseFloat(String(raw).replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      dialog.alert({
        title: "Invalid amount",
        message: "Please enter a positive number, e.g. 40 or 12.500",
      });
      return;
    }

    // Optional note
    var description = window.prompt(
      "Add a short note for the customer (optional — press OK to skip):",
      ""
    );
    if (description === null) return;
    description = description ? String(description).trim() : "";

    // Step 2 — collect reservation data from the current form (+ customer fallback)
    var payload;
    try {
      payload = buildPayload(rec, amount, description);
    } catch (e) {
      dialog.alert({ title: "Error", message: e.message || String(e) });
      return;
    }

    if (!payload.customerName) {
      dialog.alert({
        title: "Customer missing",
        message: "Could not resolve a customer name. Set the customer link or fill the customer-name field on the reservation.",
      });
      return;
    }

    // Step 3 — POST to website API directly
    fetch(WEBSITE_BASE_URL + "/api/netsuite/payment-link", {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-netsuite-secret": INBOUND_SECRET,
      },
      body: JSON.stringify(payload),
    })
    .then(function (resp) {
      return resp.text().then(function (text) {
        var data;
        try { data = JSON.parse(text); } catch (e) {
          throw new Error("Website returned non-JSON (HTTP " + resp.status + "): " + text.slice(0, 200));
        }
        if (!resp.ok || !data.ok) {
          throw new Error(data.error || ("HTTP " + resp.status));
        }
        return data;
      });
    })
    .then(function (data) {
      showLinkDialog(data.url, payload.customerPhone, data.reused, amount);
    })
    .catch(function (err) {
      var msg = err && err.message ? err.message : String(err);
      // CSP / network failures show as "Failed to fetch" — give the user a hint.
      if (/failed to fetch/i.test(msg)) {
        msg += "\n\nIf this is a fresh deployment, ensure your NetSuite account has " +
               new URL(WEBSITE_BASE_URL).hostname +
               " on the Allowed Domain List (Setup → Company → Setup Tasks → Allowed Domain List).";
      }
      dialog.alert({ title: "Could not create link", message: msg });
    });
  }

  // ── Reservation data extraction ────────────────────────────────────────────

  function buildPayload(rec, amount, description) {
    var reservationRef = safeGet(rec, FIELD_IDS.reservationRef) || ("ID-" + rec.id);

    // Customer name: prefer linked customer, fall back to text field
    var customerName = "";
    var customerEntityId = safeGet(rec, FIELD_IDS.customerEntity);
    if (customerEntityId) {
      customerName = safeGetText(rec, FIELD_IDS.customerEntity) || "";
    }
    if (!customerName) {
      customerName = safeGet(rec, FIELD_IDS.customerNameTxt) || "";
    }

    var customerPhone = safeGet(rec, FIELD_IDS.customerPhone);
    var customerEmail = safeGet(rec, FIELD_IDS.customerEmail);

    // If linked customer, lookup the customer record for missing fields
    if (customerEntityId && (!customerPhone || !customerEmail || !customerName)) {
      try {
        var fields = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: customerEntityId,
          columns: ["companyname", "entityid", "phone", "mobilephone", "email"],
        });
        if (!customerPhone) customerPhone = fields.phone || fields.mobilephone || null;
        if (!customerEmail) customerEmail = fields.email || null;
        if (!customerName) customerName = fields.companyname || fields.entityid || "";
      } catch (e) {
        // Non-fatal — continue with whatever we already have
        console && console.warn && console.warn("Customer lookup failed:", e);
      }
    }

    var unitCode = safeGet(rec, FIELD_IDS.unitCode);
    var checkIn = isoDate(rec.getValue({ fieldId: FIELD_IDS.checkIn }));
    var checkOut = isoDate(rec.getValue({ fieldId: FIELD_IDS.checkOut }));
    var recordDescription = safeGet(rec, FIELD_IDS.description);

    var finalDescription = description || recordDescription || null;
    if (!finalDescription) {
      var bits = [];
      if (unitCode) bits.push("Unit " + unitCode);
      if (checkIn && checkOut) bits.push(checkIn + " → " + checkOut);
      if (bits.length) finalDescription = "Reservation: " + bits.join(" · ");
    }

    var user = runtime.getCurrentUser();

    return {
      netsuiteReservationId: String(rec.id),
      netsuiteReservationRef: reservationRef,
      unitCode: unitCode || null,
      checkIn: checkIn,
      checkOut: checkOut,
      customerName: String(customerName).trim(),
      customerPhone: customerPhone ? String(customerPhone).trim() : null,
      customerEmail: customerEmail ? String(customerEmail).trim() : null,
      amount: Number(amount.toFixed(3)),
      currency: "OMR",
      description: finalDescription,
      receptionistEmail: user.email || null,
      receptionistName: user.name || null,
      locale: "en",
    };
  }

  function safeGet(rec, fieldId) {
    if (!fieldId) return null;
    try {
      var v = rec.getValue({ fieldId: fieldId });
      return v === "" || v === undefined || v === null ? null : v;
    } catch (e) {
      return null;
    }
  }

  function safeGetText(rec, fieldId) {
    if (!fieldId) return null;
    try {
      var v = rec.getText({ fieldId: fieldId });
      return v === "" || v === undefined || v === null ? null : v;
    } catch (e) {
      return null;
    }
  }

  function isoDate(d) {
    if (!d) return null;
    if (typeof d === "string") return d;
    try {
      var year = d.getFullYear();
      var month = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return year + "-" + month + "-" + day;
    } catch (e) {
      return null;
    }
  }

  // ── Result dialog ──────────────────────────────────────────────────────────

  function showLinkDialog(linkUrl, customerPhone, reused, amount) {
    copyToClipboard(linkUrl);

    var lines = [];
    lines.push(reused ? "An active link already exists for this reservation:" : "Payment link created.");
    lines.push("");
    lines.push("Amount: " + Number(amount).toFixed(3) + " OMR");
    lines.push("");
    lines.push("Link (copied to clipboard):");
    lines.push(linkUrl);
    if (customerPhone) {
      lines.push("");
      lines.push("Click \"Send WhatsApp\" to open WhatsApp prefilled for " + customerPhone + ".");
    }

    var buttons = [];
    if (customerPhone) buttons.push({ label: "Send WhatsApp", value: "whatsapp" });
    buttons.push({ label: "Copy again", value: "copy" });
    buttons.push({ label: "Close", value: "close" });

    dialog.create({
      title: reused ? "Existing payment link" : "Payment link ready",
      message: lines.join("\n"),
      buttons: buttons,
    }).then(function (action) {
      if (action === "copy") {
        copyToClipboard(linkUrl);
        dialog.alert({ title: "Copied", message: "Link copied to clipboard." });
      } else if (action === "whatsapp" && customerPhone) {
        var phone = String(customerPhone).replace(/[^0-9]/g, "");
        var text = encodeURIComponent(
          "Hello, please complete your payment for Nassayem Salalah here:\n" + linkUrl
        );
        window.open("https://wa.me/" + phone + "?text=" + text, "_blank");
      }
    });
  }

  function copyToClipboard(text) {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return;
      }
    } catch (e) { /* fall through */ }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) { /* nothing else we can do */ }
  }

  return {
    pageInit: pageInit,
    showPaymentLinkDialog: showPaymentLinkDialog,
  };
});
