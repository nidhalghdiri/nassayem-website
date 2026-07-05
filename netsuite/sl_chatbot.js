/**
 * Nassayem — Suitelet powering the AI chatbot's real-time NetSuite access.
 *
 * Two actions, both POST JSON:
 *   { action: "check_availability", netsuiteBuildingId?, unitType, checkIn, checkOut }
 *     → { ok, totalUnits, freeUnits, freeUnitCodes: ["OK-305", ...] }
 *   { action: "create_reservation", netsuiteBuildingId?, unitType, checkIn,
 *     checkOut, customerName, customerPhone, customerEmail?, totalAmount, notes? }
 *     → { ok, reservationId, reservationRef, unitCode }
 *
 * unitType arrives as the WEBSITE enum (STUDIO / ONE_BEDROOM / TWO_BEDROOM /
 * THREE_BEDROOM / VILLA) — map it to your NetSuite values in CONFIG.UNIT_TYPE_MAP.
 *
 * Date semantics match the website: checkOut is the departure morning
 * (exclusive). A reservation blocks a unit when
 *   reservation.checkIn < requested.checkOut AND reservation.checkOut > requested.checkIn
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

    // ── EDIT ME: your NetSuite schema ────────────────────────────────────────
    var CONFIG = {
      UNIT: {
        recordType: "customrecord_nass_unit",       // your unit custom record
        fields: {
          code:      "name",                        // human unit code, e.g. "OK-305"
          unitType:  "custrecord_nass_unit_type",   // list/select field
          building:  "custrecord_nass_unit_building", // link to building record
          inactive:  "isinactive",                  // standard inactive flag
        },
      },

      // Website unit type → NetSuite unit-type value(s).
      // Use the INTERNAL IDs of your unit-type list values (open the list in
      // NetSuite to see them). Several NetSuite values may map to one website
      // type (e.g. two flavours of 2BHK) — hence arrays.
      UNIT_TYPE_MAP: {
        STUDIO:        ["1"],
        ONE_BEDROOM:   ["2"],   // 1BHK
        TWO_BEDROOM:   ["3"],   // 2BHK
        THREE_BEDROOM: ["4"],   // 3BHK
        VILLA:         ["5"],
      },

      RESERVATION: {
        recordType: "customrecord_nass_reservation", // your reservation record
        fields: {
          unit:          "custrecord_nass_res_unit",       // link to unit record
          checkIn:       "custrecord_nass_res_check_in",   // date
          checkOut:      "custrecord_nass_res_check_out",  // date
          status:        "custrecord_nass_res_status",     // list/select
          customerName:  "custrecord_nass_res_customer",   // free text (or entity — adjust setValue below)
          customerPhone: "custrecord_nass_res_phone",
          customerEmail: "custrecord_nass_res_email",
          amount:        "custrecord_nass_res_amount",
          notes:         "custrecord_nass_res_notes",
          source:        "custrecord_nass_res_source",     // optional; "" to skip
        },
        // Status internal ids that BLOCK availability (booked/confirmed/checked-in…).
        // Cancelled / no-show statuses must NOT be listed here.
        blockingStatusIds: ["1", "2", "3"],
        // Status internal id for a new, unpaid chatbot reservation.
        newStatusId: "1",
        // Optional value for the source field (internal id or text). "" to skip.
        chatbotSourceValue: "",
      },
    };
    // ── END EDIT ME ──────────────────────────────────────────────────────────

    function json(response, status, body) {
      response.setHeader({ name: "Content-Type", value: "application/json" });
      response.write(JSON.stringify(body));
      // Suitelets can't set arbitrary status codes reliably; ok:false carries it.
      void status;
    }

    function authorized(request) {
      var expected = runtime.getCurrentScript().getParameter({
        name: "custscript_nass_chatbot_token",
      });
      if (!expected) return false;
      var header = request.headers["authorization"] || request.headers["Authorization"] || "";
      var provided = header.indexOf("Bearer ") === 0 ? header.substring(7) : header;
      return !!provided && provided === expected;
    }

    function toNsDate(isoDate) {
      // "2026-07-20" → NetSuite date string in the account's format
      var parts = isoDate.split("-");
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return format.format({ value: d, type: format.Type.DATE });
    }

    /** All active unit ids+codes of the requested type (optionally one building). */
    function findUnits(unitType, buildingId) {
      var typeIds = CONFIG.UNIT_TYPE_MAP[unitType];
      if (!typeIds || !typeIds.length) {
        throw new Error("Unmapped unit type: " + unitType);
      }
      var filters = [
        [CONFIG.UNIT.fields.unitType, "anyof", typeIds],
        "and",
        [CONFIG.UNIT.fields.inactive, "is", "F"],
      ];
      if (buildingId) {
        filters.push("and");
        filters.push([CONFIG.UNIT.fields.building, "anyof", [String(buildingId)]]);
      }
      var units = [];
      search.create({
        type: CONFIG.UNIT.recordType,
        filters: filters,
        columns: [CONFIG.UNIT.fields.code],
      }).run().each(function (r) {
        units.push({ id: r.id, code: r.getValue(CONFIG.UNIT.fields.code) });
        return units.length < 500;
      });
      return units;
    }

    /** Unit ids busy (blocking reservation overlapping the range) among unitIds. */
    function findBusyUnitIds(unitIds, checkIn, checkOut) {
      if (!unitIds.length) return {};
      var F = CONFIG.RESERVATION.fields;
      var busy = {};
      search.create({
        type: CONFIG.RESERVATION.recordType,
        filters: [
          [F.unit, "anyof", unitIds],
          "and",
          [F.status, "anyof", CONFIG.RESERVATION.blockingStatusIds],
          "and",
          // reservation.checkIn < requested.checkOut (checkOut exclusive)
          [F.checkIn, "before", toNsDate(checkOut)],
          "and",
          // reservation.checkOut > requested.checkIn
          [F.checkOut, "after", toNsDate(checkIn)],
        ],
        columns: [F.unit],
      }).run().each(function (r) {
        busy[String(r.getValue(F.unit))] = true;
        return true;
      });
      return busy;
    }

    function availability(body) {
      var units = findUnits(body.unitType, body.netsuiteBuildingId);
      var busy = findBusyUnitIds(units.map(function (u) { return u.id; }),
        body.checkIn, body.checkOut);
      var free = units.filter(function (u) { return !busy[String(u.id)]; });
      return {
        ok: true,
        totalUnits: units.length,
        freeUnits: free.length,
        freeUnitCodes: free.slice(0, 5).map(function (u) { return u.code; }),
        _freeUnitIds: free.map(function (u) { return u.id; }), // internal use
      };
    }

    function createReservation(body) {
      var avail = availability(body);
      if (avail.freeUnits < 1) {
        return { ok: false, error: "No free unit of this type for these dates." };
      }
      var chosen = avail._freeUnitIds[0];
      var chosenCode = avail.freeUnitCodes[0];

      var F = CONFIG.RESERVATION.fields;
      var rec = record.create({ type: CONFIG.RESERVATION.recordType });
      rec.setValue({ fieldId: F.unit, value: chosen });
      rec.setValue({
        fieldId: F.checkIn,
        value: format.parse({ value: toNsDate(body.checkIn), type: format.Type.DATE }),
      });
      rec.setValue({
        fieldId: F.checkOut,
        value: format.parse({ value: toNsDate(body.checkOut), type: format.Type.DATE }),
      });
      rec.setValue({ fieldId: F.status, value: CONFIG.RESERVATION.newStatusId });
      rec.setValue({ fieldId: F.customerName, value: body.customerName || "" });
      if (F.customerPhone) rec.setValue({ fieldId: F.customerPhone, value: body.customerPhone || "" });
      if (F.customerEmail && body.customerEmail) rec.setValue({ fieldId: F.customerEmail, value: body.customerEmail });
      if (F.amount) rec.setValue({ fieldId: F.amount, value: body.totalAmount || 0 });
      if (F.notes) rec.setValue({ fieldId: F.notes, value: body.notes || "Created by AI chatbot" });
      if (F.source && CONFIG.RESERVATION.chatbotSourceValue) {
        rec.setValue({ fieldId: F.source, value: CONFIG.RESERVATION.chatbotSourceValue });
      }
      var id = rec.save();

      // Best-effort human ref (name/tranid of the saved record)
      var ref = String(id);
      try {
        var saved = search.lookupFields({
          type: CONFIG.RESERVATION.recordType,
          id: id,
          columns: ["name"],
        });
        if (saved && saved.name) ref = String(saved.name);
      } catch (e) { /* keep numeric id */ }

      return { ok: true, reservationId: String(id), reservationRef: ref, unitCode: chosenCode };
    }

    function onRequest(context) {
      var request = context.request;
      var response = context.response;

      if (request.method !== "POST") {
        return json(response, 405, { ok: false, error: "POST only" });
      }
      if (!authorized(request)) {
        log.audit("chatbot suitelet", "unauthorized request rejected");
        return json(response, 401, { ok: false, error: "Unauthorized" });
      }

      var body;
      try {
        body = JSON.parse(request.body || "{}");
      } catch (e) {
        return json(response, 400, { ok: false, error: "Invalid JSON" });
      }

      try {
        if (!body.unitType || !body.checkIn || !body.checkOut) {
          return json(response, 400, { ok: false, error: "unitType, checkIn, checkOut are required" });
        }
        if (body.action === "check_availability") {
          var result = availability(body);
          delete result._freeUnitIds;
          return json(response, 200, result);
        }
        if (body.action === "create_reservation") {
          if (!body.customerName || !body.customerPhone) {
            return json(response, 400, { ok: false, error: "customerName and customerPhone are required" });
          }
          return json(response, 200, createReservation(body));
        }
        return json(response, 400, { ok: false, error: "Unknown action: " + body.action });
      } catch (e) {
        log.error("chatbot suitelet error", e);
        return json(response, 500, { ok: false, error: e.message || String(e) });
      }
    }

    return { onRequest: onRequest };
  });
