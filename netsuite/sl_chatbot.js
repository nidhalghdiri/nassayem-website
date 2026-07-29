/**
 * Nassayem — Suitelet powering the AI chatbot's real-time NetSuite access.
 *
 * Availability logic mirrors reservation_script.js (the reservation form's
 * client script) exactly:
 *   - Units   = service ITEMs in a building:  filter [location, is, building]
 *               columns itemid / custitem_ns_item_unit_type / custitem_ns_property_status
 *   - Busy    = customsale_ns_reservations overlapping the dates
 *               (startdate < requested checkOut AND enddate > requested checkIn,
 *                account 1388) whose status CODE ends in "A" (Pending Check-In)
 *               or "B" (Checked-In). "C"/"D" (Cancelled / Checked-Out) don't block.
 *   - Free    = units of the requested type − busy units.
 *
 * Two actions, both POST JSON:
 *   { action: "check_availability", netsuiteBuildingId, unitType, checkIn, checkOut }
 *     → { ok, totalUnits, freeUnits, freeUnitCodes: ["OK-305", ...] }
 *   { action: "create_reservation", netsuiteBuildingId, unitType, checkIn,
 *     checkOut, customerName, customerPhone, customerEmail?, totalAmount, notes? }
 *     → { ok, reservationId, reservationRef, unitCode }
 *
 * unitType arrives as the WEBSITE enum (STUDIO / ONE_BEDROOM / TWO_BEDROOM /
 * THREE_BEDROOM / VILLA) — mapped in CONFIG.UNIT_TYPE_MAP to the internal ids
 * of the custitem_ns_item_unit_type list. netsuiteBuildingId is the NetSuite
 * LOCATION internal id (= Building.netsuiteId on the website, the same id the
 * payment-link scripts send).
 *
 * Date semantics match the website: checkOut is the departure morning
 * (exclusive).
 *
 * Deployment notes:
 *   - Script type: Suitelet
 *   - Available Without Login: YES (external URL; auth is the Bearer token below)
 *   - Copy the external URL into the website env var NETSUITE_CHATBOT_RESTLET_URL
 *
 * Required script parameter (define on the Script record):
 *   custscript_nass_chatbot_token — long random string; same value as the
 *   website's NETSUITE_M2M_TOKEN env var. The website sends it as
 *   "Authorization: Bearer <token>".
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(["N/record", "N/search", "N/runtime", "N/format", "N/log"],
  function (record, search, runtime, format, log) {

    // ── CONFIG (matches the live schema used by reservation_script.js) ──────
    var CONFIG = {
      UNIT: {
        // Units are service items; the building is the item's location.
        fields: {
          code: "itemid",                           // human unit code
          unitType: "custitem_ns_item_unit_type",   // list field
          status: "custitem_ns_property_status",    // 1 Vacant / 2 Occupied / 3 Cleaning (informational)
        },
      },

      // Website unit type → internal id(s) of the custitem_ns_item_unit_type
      // list values. Arrays: several NetSuite values may map to one website type.
      UNIT_TYPE_MAP: {
        STUDIO: ["3"],
        ONE_BEDROOM: ["2"],   // 1BHK
        TWO_BEDROOM: ["1"],   // 2BHK
        THREE_BEDROOM: ["4"], // 3BHK
        VILLA: ["5"],
      },

      RESERVATION: {
        recordType: "customsale_ns_reservations",
        // Same account filter the reservation form's occupancy search uses.
        accountId: "1388",
        // Status CODES (trailing letter of the search "status" value) that
        // BLOCK a unit: A = Pending Check-In, B = Checked-In.
        // C = Cancelled and D = Checked-Out do NOT block.
        blockingStatusCodes: ["A", "B"],
        fields: {
          customerNameTxt: "custbody_ns_customer_name",
          customerPhone: "custbody_nass_customer_phone",
          customerEmail: "custbody_nass_customer_email",
          idPassport: "custbody_ns_id_passport_num",
          unitCode: "custbody_nass_unit_code",
          cycle: "custbody_ns_reservation_cycle", // "1" daily · "2" monthly
          period: "custbody_ns_res_period",
          memo: "memo",
          conversationId: "custbody_nass_chatbot_conv_id",
        },
        cycleDaily: "1",
        cycleMonthly: "2",
        // Item-line units of measure (same ids onAddUnits() uses).
        uomDaily: "86",
        uomMonthly: "87",
        // Stays of at least this many nights use the monthly cycle.
        monthlyThresholdNights: 30,
      },

      CUSTOMER: {
        subsidiary: "2",              // same subsidiary the reservation form searches
        fullNameField: "custentity38", // full-name custom field on customer
        // Fallback customer used when creating a new customer record fails
        // (e.g. an unrelated User Event script such as rm_ue_student_infos.js
        // blocks the save demanding a "Join Year"). Create ONE generic
        // customer in NetSuite (e.g. "WhatsApp Chatbot Guest") and put its
        // internal id here. The real guest name/phone still land on the
        // reservation's custbody fields. "" = no fallback (fail instead).
        fallbackCustomerId: "",
        // Same field the reservation form searches customers by.
        idPassportField: "custentity_ns_id_passport_num",
      },
    };
    // ── END CONFIG ───────────────────────────────────────────────────────────

    function json(response, body) {
      response.setHeader({ name: "Content-Type", value: "application/json" });
      response.write(JSON.stringify(body));
    }

    function authorized(request) {
      var expected = runtime.getCurrentScript().getParameter({
        name: "custscript_nass_chatbot_token",
      });
      if (!expected) return false;
      var header = request.headers["authorization"] || request.headers["Authorization"] || "";
      var provided = header.indexOf("Bearer ") === 0 ? header.substring(7) : header;
      // Fallback: token as a query parameter, in case a redirect in the
      // external-URL chain strips the Authorization header.
      if (!provided && request.parameters && request.parameters.token) {
        provided = request.parameters.token;
      }
      return !!provided && provided === expected;
    }

    /** "2026-07-20" → JS Date (local calendar day, no TZ shifting). */
    function isoToDate(isoDate) {
      var p = String(isoDate).split("-");
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }

    /** JS Date → date string in the account's format (for search filters). */
    function toNsDateString(d) {
      return format.format({ value: d, type: format.Type.DATE });
    }

    function nightsBetween(checkIn, checkOut) {
      var oneDay = 1000 * 60 * 60 * 24;
      return Math.round(
        (isoToDate(checkOut).getTime() - isoToDate(checkIn).getTime()) / oneDay,
      );
    }

    /**
     * All active unit items of the requested type in the building —
     * mirrors searchAllUnits() but filters the type in the search itself.
     */
    function findUnitsOfType(buildingId, unitType) {
      var typeIds = CONFIG.UNIT_TYPE_MAP[unitType];
      if (!typeIds || !typeIds.length) {
        throw new Error("Unmapped unit type: " + unitType);
      }
      var units = [];
      search.create({
        type: search.Type.ITEM,
        columns: ["internalid", CONFIG.UNIT.fields.code],
        filters: [
          ["location", "is", buildingId],
          "and",
          [CONFIG.UNIT.fields.unitType, "anyof", typeIds],
          "and",
          ["isinactive", "is", "F"],
        ],
      }).run().each(function (r) {
        units.push({
          id: r.getValue({ name: "internalid" }),
          code: r.getValue({ name: CONFIG.UNIT.fields.code }),
        });
        return units.length < 1000;
      });
      return units;
    }

    /**
     * Item internal ids taken by an overlapping ACTIVE reservation — mirrors
     * searchOccuipedUnits(): date overlap + account filter in the search, then
     * the status decided by the TRAILING code letter in JS (the "status"
     * search column returns forms like "<type>:A", never plain "statusA").
     */
    function searchOccupiedUnitIds(buildingId, checkIn, checkOut) {
      var occupied = {};
      search.create({
        type: CONFIG.RESERVATION.recordType,
        columns: ["tranid", "status", "item"],
        filters: [
          ["location", "is", buildingId],
          "and",
          ["account", "is", CONFIG.RESERVATION.accountId],
          "and",
          // reservation.startdate < requested checkOut (checkOut exclusive)
          ["startdate", "before", toNsDateString(isoToDate(checkOut))],
          "and",
          // reservation.enddate > requested checkIn
          ["enddate", "after", toNsDateString(isoToDate(checkIn))],
        ],
      }).run().each(function (r) {
        var statusCode = String(r.getValue({ name: "status" }) || "")
          .slice(-1)
          .toUpperCase();
        if (CONFIG.RESERVATION.blockingStatusCodes.indexOf(statusCode) !== -1) {
          var itemId = r.getValue({ name: "item" });
          if (itemId) occupied[String(itemId)] = true;
        }
        return true;
      });
      return occupied;
    }

    function availability(body) {
      if (!body.netsuiteBuildingId) {
        return { ok: false, error: "netsuiteBuildingId (NetSuite location id) is required" };
      }
      var buildingId = String(body.netsuiteBuildingId);
      var units = findUnitsOfType(buildingId, body.unitType);
      var occupied = searchOccupiedUnitIds(buildingId, body.checkIn, body.checkOut);
      var free = units.filter(function (u) { return !occupied[String(u.id)]; });
      return {
        ok: true,
        totalUnits: units.length,
        freeUnits: free.length,
        freeUnitCodes: free.slice(0, 5).map(function (u) { return u.code; }),
        _free: free, // internal use — stripped before responding
      };
    }

    /** Find a customer by ID/passport (like the reservation form) or phone, or create one. */
    function findOrCreateCustomer(name, phone, email, idPassport) {
      var found = null;

      // 1. ID/passport is the strongest identifier — same search the
      //    reservation form runs on custentity_ns_id_passport_num.
      if (idPassport && CONFIG.CUSTOMER.idPassportField) {
        try {
          search.create({
            type: search.Type.CUSTOMER,
            columns: ["internalid"],
            filters: [
              [CONFIG.CUSTOMER.idPassportField, "is", String(idPassport).trim()],
              "and",
              ["subsidiary", "anyof", CONFIG.CUSTOMER.subsidiary],
              "and",
              ["isinactive", "is", "F"],
            ],
          }).run().each(function (r) {
            found = r.getValue({ name: "internalid" });
            return false;
          });
        } catch (e) {
          log.debug("customer passport search failed", e);
        }
      }
      if (found) return { id: found, created: false };

      // 2. Phone fallback — match on the last 8 digits so "+968 9912 3456"
      //    and "96899123456" agree.
      var phoneTail = String(phone).replace(/\D/g, "").slice(-8);
      if (phoneTail.length >= 6) {
        try {
          search.create({
            type: search.Type.CUSTOMER,
            columns: ["internalid"],
            filters: [
              ["phone", "contains", phoneTail],
              "and",
              ["subsidiary", "anyof", CONFIG.CUSTOMER.subsidiary],
              "and",
              ["isinactive", "is", "F"],
            ],
          }).run().each(function (r) {
            found = r.getValue({ name: "internalid" });
            return false; // first match wins
          });
        } catch (e) {
          log.debug("customer phone search failed", e);
        }
      }
      if (found) return { id: found, created: false };

      var cust = record.create({ type: record.Type.CUSTOMER, isDynamic: true });
      try { cust.setValue({ fieldId: "isperson", value: "T" }); } catch (e) { /* ignore */ }
      try {
        var parts = String(name).trim().split(/\s+/);
        cust.setValue({ fieldId: "firstname", value: parts[0] || name });
        cust.setValue({ fieldId: "lastname", value: parts.slice(1).join(" ") || "-" });
      } catch (e) {
        try { cust.setValue({ fieldId: "companyname", value: name }); } catch (e2) { /* ignore */ }
      }
      cust.setValue({ fieldId: "subsidiary", value: CONFIG.CUSTOMER.subsidiary });
      try { cust.setValue({ fieldId: "phone", value: phone }); } catch (e) { /* ignore */ }
      if (email) { try { cust.setValue({ fieldId: "email", value: email }); } catch (e) { /* ignore */ } }
      if (CONFIG.CUSTOMER.fullNameField) {
        try { cust.setValue({ fieldId: CONFIG.CUSTOMER.fullNameField, value: name }); } catch (e) { /* ignore */ }
      }
      if (idPassport && CONFIG.CUSTOMER.idPassportField) {
        try { cust.setValue({ fieldId: CONFIG.CUSTOMER.idPassportField, value: String(idPassport).trim() }); } catch (e) { /* ignore */ }
      }
      try {
        var id = cust.save({ enableSourcing: true, ignoreMandatoryFields: true });
        log.audit("chatbot customer created", "id=" + id + " phone=" + phone);
        return { id: id, created: true };
      } catch (saveErr) {
        // Customer-record User Event scripts from other projects can block the
        // save (seen live: rm_ue_student_infos.js requiring a "Join Year").
        // Fall back to the generic chatbot customer so the booking survives.
        log.error("chatbot customer create blocked", saveErr);
        if (CONFIG.CUSTOMER.fallbackCustomerId) {
          return { id: CONFIG.CUSTOMER.fallbackCustomerId, created: false };
        }
        throw new Error(
          "Customer creation blocked by a customer-record script: " +
          ((saveErr && saveErr.message) || saveErr) +
          " — set CONFIG.CUSTOMER.fallbackCustomerId or fix that script.",
        );
      }
    }

    function createReservation(body) {
      var avail = availability(body);
      if (!avail.ok) return avail;
      if (avail.freeUnits < 1) {
        return { ok: false, error: "No free unit of this type for these dates." };
      }
      var unit = avail._free[0];

      var nights = nightsBetween(body.checkIn, body.checkOut);
      if (nights < 1) return { ok: false, error: "Invalid date range." };

      var R = CONFIG.RESERVATION;
      var F = R.fields;

      // Idempotency check: if we already have a reservation for this conversationId,
      // return it immediately instead of creating a duplicate.
      if (body.conversationId && F.conversationId) {
        var existing = null;
        search.create({
          type: R.recordType,
          columns: ["internalid", "tranid"],
          filters: [[F.conversationId, "is", String(body.conversationId)]]
        }).run().each(function (r) {
          existing = {
            id: r.getValue({ name: "internalid" }),
            ref: r.getValue({ name: "tranid" })
          };
          return false;
        });

        if (existing) {
          log.audit("chatbot reservation idempotent hit", "conversationId=" + body.conversationId + " returned existing res=" + existing.id);
          return { ok: true, reservationId: String(existing.id), reservationRef: String(existing.ref), unitCode: null };
        }
      }

      // forceDaily: Khareef stays are always daily-cycle, even at 30+ nights
      // (monthly rentals are not offered during Khareef).
      var forceDaily = String(body.forceDaily) === "true" || body.forceDaily === true;
      var isMonthly = nights >= R.monthlyThresholdNights && !forceDaily;
      var period = isMonthly ? Math.round(nights / 30) : nights;

      var customer = findOrCreateCustomer(
        body.customerName, body.customerPhone, body.customerEmail, body.idPassport,
      );

      var rec = record.create({ type: R.recordType, isDynamic: true });
      rec.setValue({ fieldId: "entity", value: customer.id });
      rec.setValue({ fieldId: "location", value: String(body.netsuiteBuildingId) });
      rec.setValue({ fieldId: "startdate", value: isoToDate(body.checkIn) });
      rec.setValue({ fieldId: "enddate", value: isoToDate(body.checkOut) });
      rec.setValue({ fieldId: F.cycle, value: isMonthly ? R.cycleMonthly : R.cycleDaily });
      try { rec.setValue({ fieldId: F.period, value: period }); } catch (e) { /* optional */ }
      // "A" = Pending Check-In (usually the default for a new reservation)
      try { rec.setValue({ fieldId: "transtatus", value: "A" }); } catch (e) { /* default ok */ }
      try { rec.setValue({ fieldId: F.customerNameTxt, value: body.customerName }); } catch (e) { }
      try { rec.setValue({ fieldId: F.customerPhone, value: body.customerPhone }); } catch (e) { }
      if (body.customerEmail) {
        try { rec.setValue({ fieldId: F.customerEmail, value: body.customerEmail }); } catch (e) { }
      }
      try { rec.setValue({ fieldId: F.unitCode, value: unit.code }); } catch (e) { }
      if (body.idPassport && F.idPassport) {
        try { rec.setValue({ fieldId: F.idPassport, value: String(body.idPassport).trim() }); } catch (e) { }
      }
      try {
        rec.setValue({
          fieldId: F.memo,
          value: body.notes || "Created by AI chatbot (unpaid — payment link sent)",
        });
      } catch (e) { }
      if (body.conversationId && F.conversationId) {
        try { rec.setValue({ fieldId: F.conversationId, value: String(body.conversationId) }); } catch (e) { }
      }

      // Item line — same shape onAddUnits() builds: unit item, quantity =
      // period, UOM 86 (day) / 87 (month). Rate comes from the website's
      // pricing engine total (custom price level) so NetSuite shows the same
      // amount the customer was quoted.
      rec.selectNewLine({ sublistId: "item" });
      rec.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: unit.id });
      rec.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: period });
      try {
        rec.setCurrentSublistValue({
          sublistId: "item",
          fieldId: "units",
          value: isMonthly ? R.uomMonthly : R.uomDaily,
        });
      } catch (e) { /* UOM optional */ }
      try {
        rec.setCurrentSublistValue({ sublistId: "item", fieldId: "price", value: "-1" }); // custom price level
        rec.setCurrentSublistValue({
          sublistId: "item",
          fieldId: "rate",
          value: Math.round((Number(body.totalAmount) / period) * 1000) / 1000,
        });
      } catch (e) { /* fall back to the item's own price */ }
      try {
        rec.setCurrentSublistValue({
          sublistId: "item",
          fieldId: "location",
          value: String(body.netsuiteBuildingId),
        });
      } catch (e) { }
      rec.commitLine({ sublistId: "item" });

      var id = rec.save({ enableSourcing: true, ignoreMandatoryFields: true });

      var ref = String(id);
      try {
        var saved = search.lookupFields({
          type: R.recordType, id: id, columns: ["tranid"],
        });
        if (saved && saved.tranid) ref = String(saved.tranid);
      } catch (e) { /* keep internal id */ }

      log.audit(
        "chatbot reservation created",
        "id=" + id + " ref=" + ref + " unit=" + unit.code +
        " customer=" + customer.id + (customer.created ? " (new)" : ""),
      );

      return { ok: true, reservationId: String(id), reservationRef: ref, unitCode: unit.code };
    }

    /**
     * Externally-called Suitelets can reject POST (405) depending on the URL
     * domain, so GET with query parameters is the primary transport; POST
     * with a JSON body is kept as a fallback for environments where it works.
     */
    function readParams(request) {
      if (request.method === "GET") {
        var p = request.parameters || {};
        return {
          action: p.action,
          netsuiteBuildingId: p.netsuiteBuildingId,
          unitType: p.unitType,
          checkIn: p.checkIn,
          checkOut: p.checkOut,
          customerName: p.customerName,
          customerPhone: p.customerPhone,
          customerEmail: p.customerEmail,
          idPassport: p.idPassport,
          totalAmount: p.totalAmount ? Number(p.totalAmount) : undefined,
          notes: p.notes,
          forceDaily: p.forceDaily,
          conversationId: p.conversationId,
        };
      }
      return JSON.parse(request.body || "{}");
    }

    function onRequest(context) {
      var request = context.request;
      var response = context.response;

      if (request.method !== "GET" && request.method !== "POST") {
        return json(response, { ok: false, error: "GET or POST only" });
      }
      if (!authorized(request)) {
        log.audit("chatbot suitelet", "unauthorized request rejected");
        return json(response, { ok: false, error: "Unauthorized" });
      }

      var body;
      try {
        body = readParams(request);
      } catch (e) {
        return json(response, { ok: false, error: "Invalid request payload" });
      }

      try {
        if (!body.unitType || !body.checkIn || !body.checkOut) {
          return json(response, { ok: false, error: "unitType, checkIn, checkOut are required" });
        }
        if (body.action === "check_availability") {
          var result = availability(body);
          delete result._free;
          return json(response, result);
        }
        if (body.action === "create_reservation") {
          if (!body.customerName || !body.customerPhone) {
            return json(response, { ok: false, error: "customerName and customerPhone are required" });
          }
          return json(response, createReservation(body));
        }
        return json(response, { ok: false, error: "Unknown action: " + body.action });
      } catch (e) {
        log.error("chatbot suitelet error", e);
        return json(response, { ok: false, error: (e && e.message) || String(e) });
      }
    }

    return { onRequest: onRequest };
  });
