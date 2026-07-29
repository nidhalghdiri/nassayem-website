/**
 * Nassayem — Suitelet powering the NetSuite Payment Sync Webhook.
 *
 * This script receives a POST request from the website whenever a payment
 * link is successfully paid via SmartPay. It creates a Customer Deposit 
 * in NetSuite linked to the customer and the reservation.
 *
 * Deployment notes:
 *   - Script type: Suitelet
 *   - Available Without Login: YES (external URL; auth is the Bearer token)
 *   - Copy the external URL into the website env var NETSUITE_OUTBOUND_URL
 *
 * Required script parameter (define on the Script record):
 *   custscript_nass_outbound_token — long random string; same value as the
 *   website's NETSUITE_M2M_TOKEN env var. The website sends it as
 *   "Authorization: Bearer <token>".
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(["N/record", "N/search", "N/runtime", "N/format", "N/log"],
  function (record, search, runtime, format, log) {

    function json(response, body) {
      response.setHeader({ name: "Content-Type", value: "application/json" });
      response.write(JSON.stringify(body));
    }

    function authorized(request) {
      var expected = runtime.getCurrentScript().getParameter({
        name: "custscript_nass_outbound_token",
      });
      if (!expected) return false;
      var header = request.headers["authorization"] || request.headers["Authorization"] || "";
      var provided = header.indexOf("Bearer ") === 0 ? header.substring(7) : header;
      return !!provided && provided === expected;
    }

    function onRequest(context) {
      var request = context.request;
      var response = context.response;

      if (request.method !== "POST") {
        return json(response, { ok: false, error: "POST only" });
      }

      if (!authorized(request)) {
        log.audit("payment sync suitelet", "unauthorized request rejected");
        return json(response, { ok: false, error: "Unauthorized" });
      }

      var body;
      try {
        body = JSON.parse(request.body || "{}");
      } catch (e) {
        return json(response, { ok: false, error: "Invalid JSON payload" });
      }

      try {
        if (!body.netsuiteReservationId || !body.amount) {
          return json(response, { ok: false, error: "netsuiteReservationId and amount are required" });
        }

        // 1. Update the reservation to mark the payment link as paid
        // We assume you create a custom Free-Form text field called 'custbody_nass_payment_link_status'
        var refNo = body.smartpayBankRefNo || body.smartpayOrderId || ("LINK-" + body.paymentLinkId);
        var statusText = "PAID (Ref: " + String(refNo).substring(0, 30) + " - " + body.amount + " OMR)";
        
        var id = record.submitFields({
          type: "customsale_ns_reservations",
          id: body.netsuiteReservationId,
          values: {
            "custbody_nass_payment_link_status": statusText
          },
          options: {
            enableSourcing: false,
            ignoreMandatoryFields: true
          }
        });

        log.audit(
          "payment synced to reservation",
          "Reservation ID=" + id + " Status=" + statusText
        );

        return json(response, { 
          ok: true, 
          reservationId: String(id)
        });

      } catch (e) {
        log.error("payment sync suitelet error", e);
        return json(response, { ok: false, error: (e && e.message) || String(e) });
      }
    }

    return { onRequest: onRequest };
  });
