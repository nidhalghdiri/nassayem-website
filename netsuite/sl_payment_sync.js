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
define(["N/record", "N/search", "N/runtime", "N/format", "N/log", "N/render", "N/file"],
  function (record, search, runtime, format, log, render, file) {

    function json(response, body) {
      response.setHeader({ name: "Content-Type", value: "application/json" });
      response.write(JSON.stringify(body));
    }

    function authorized(request) {
      var expected = runtime.getCurrentScript().getParameter({
        name: "custscript_nass_outbound_token",
      });
      if (!expected) {
        log.error("Auth Failed", "The script parameter 'custscript_nass_outbound_token' is missing or empty on the deployment.");
        return false;
      }
      var header = request.headers["authorization"] || request.headers["Authorization"] || request.parameters.token || "";
      var provided = header.indexOf("Bearer ") === 0 ? header.substring(7) : header;

      if (provided !== expected) {
        log.error("Auth Failed", "Provided token did not match expected token. Provided length: " + (provided ? provided.length : 0));
        return false;
      }
      return true;
    }

    function onRequest(context) {
      var request = context.request;
      var response = context.response;

      if (request.method !== "GET") {
        return json(response, { ok: false, error: "GET only" });
      }

      if (!authorized(request)) {
        log.audit("payment sync suitelet", "unauthorized request rejected");
        return json(response, { ok: false, error: "Unauthorized" });
      }

      var body = request.parameters || {};

      try {
        if (!body.netsuiteReservationId || !body.amount) {
          return json(response, { ok: false, error: "netsuiteReservationId and amount are required" });
        }

        // Internal IDs for PDF generation and storage
        var PAYMENT_PDF_TEMPLATE_ID = 124;
        var FILE_CABINET_FOLDER_ID = 17410;
        var RESERVATION_PAYMENTS_FIELD_ID = "custbody_ns_related_payments"; // The multiselect field on the Reservation

        var refNo = body.smartpayBankRefNo || body.smartpayOrderId || ("LINK-" + body.paymentLinkId);
        var statusText = "PAID (Ref: " + String(refNo).substring(0, 30) + " - " + body.amount + " OMR)";
        var paymentPdfUrl = null;
        var paymentId = null;

        // 1. Get the Customer ID from the Reservation
        var resLookup = search.lookupFields({
          type: "customsale_ns_reservations",
          id: body.netsuiteReservationId,
          columns: ["custbody_ns_reservation_customer", RESERVATION_PAYMENTS_FIELD_ID]
        });
        
        var customerId = null;
        if (resLookup.custbody_ns_reservation_customer && resLookup.custbody_ns_reservation_customer.length > 0) {
          customerId = resLookup.custbody_ns_reservation_customer[0].value;
        }

        if (customerId) {
          // 2. Create the unapplied Customer Payment
          var paymentRec = record.create({
            type: record.Type.CUSTOMER_PAYMENT,
            isDynamic: true
          });
          paymentRec.setValue({ fieldId: "customer", value: customerId });
          paymentRec.setValue({ fieldId: "payment", value: body.amount });
          paymentRec.setValue({ fieldId: "autoapply", value: false });
          paymentRec.setValue({ fieldId: "memo", value: "SmartPay: " + refNo });
          
          paymentId = paymentRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
          log.audit("Customer Payment Created", "Payment ID: " + paymentId);

          // 3. Generate the Payment PDF
          try {
            var pdfRenderer = render.create();
            pdfRenderer.setTemplateById(PAYMENT_PDF_TEMPLATE_ID);
            pdfRenderer.addRecord({ templateName: 'record', record: record.load({ type: record.Type.CUSTOMER_PAYMENT, id: paymentId }) });
            
            var pdf = pdfRenderer.renderAsPdf();
            pdf.name = "PaymentReceipt_" + paymentId + ".pdf";
            pdf.folder = FILE_CABINET_FOLDER_ID;
            pdf.isOnline = true;
            
            var fileId = pdf.save();
            var savedFile = file.load({ id: fileId });
            paymentPdfUrl = savedFile.url;
            log.audit("Payment PDF generated", "URL=" + paymentPdfUrl);
          } catch (pdfErr) {
            log.error("Failed to generate Payment PDF", pdfErr);
          }
        } else {
          log.error("Customer Payment Skipped", "No customer found on Reservation " + body.netsuiteReservationId);
        }

        // 4. Update the Reservation record
        // We append the new payment to the multiselect field if it was created
        var existingPayments = [];
        if (resLookup[RESERVATION_PAYMENTS_FIELD_ID]) {
          existingPayments = resLookup[RESERVATION_PAYMENTS_FIELD_ID].map(function(obj) { return obj.value; });
        }
        if (paymentId) {
          existingPayments.push(paymentId);
        }

        var updateValues = {
          "custbody_nass_payment_link_status": statusText
        };
        // Only update the multiselect field if the user actually created it in NetSuite
        if (paymentId) {
          updateValues[RESERVATION_PAYMENTS_FIELD_ID] = existingPayments;
        }

        try {
          var id = record.submitFields({
            type: "customsale_ns_reservations",
            id: body.netsuiteReservationId,
            values: updateValues,
            options: { enableSourcing: false, ignoreMandatoryFields: true }
          });
          log.audit("payment synced to reservation", "Reservation ID=" + id + " Status=" + statusText);
        } catch (updateErr) {
          log.error("Failed to link payment to reservation", "Check if field " + RESERVATION_PAYMENTS_FIELD_ID + " exists. " + updateErr);
          // Fallback: just update the status text if the multiselect field fails
          record.submitFields({
            type: "customsale_ns_reservations",
            id: body.netsuiteReservationId,
            values: { "custbody_nass_payment_link_status": statusText },
            options: { enableSourcing: false, ignoreMandatoryFields: true }
          });
        }

        return json(response, {
          ok: true,
          reservationId: String(body.netsuiteReservationId),
          paymentId: paymentId ? String(paymentId) : null,
          paymentPdfUrl: paymentPdfUrl
        });

      } catch (e) {
        log.error("payment sync suitelet error", e);
        return json(response, { ok: false, error: (e && e.message) || String(e) });
      }
    }

    return { onRequest: onRequest };
  });
