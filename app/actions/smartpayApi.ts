"use server";

import {
  encryptSmartPayRequest,
  decryptSmartPayResponse,
} from "@/lib/smartpay";
import prisma from "@/lib/prisma";

// Use the production API URL when live, or UAT URL when testing
const SMARTPAY_API_URL = process.env.SMARTPAY_API_URL || "";
const MERCHANT_ID = process.env.SMARTPAY_MERCHANT_ID || "";
const ACCESS_CODE = process.env.SMARTPAY_ACCESS_CODE || "";

/**
 * 1. INQUIRY API (Order Status Tracker)
 * Used to verify a transaction's status directly with the bank.
 */
export async function checkOrderStatus(shortOrderId: string) {
  const jsonRequest = JSON.stringify({
    order_no: shortOrderId,
  });

  const encRequest = encryptSmartPayRequest(jsonRequest);

  const requestBody = new URLSearchParams({
    enc_request: encRequest,
    access_code: ACCESS_CODE,
    command: "orderStatusTracker",
    request_type: "JSON",
    response_type: "JSON",
    version: "1.2",
  });

  try {
    const response = await fetch(SMARTPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    const data = await response.text();
    const responseParams = new URLSearchParams(data);
    const status = responseParams.get("status");
    const encResponse = responseParams.get("enc_response");

    if (status === "1" || !encResponse) {
      return {
        success: false,
        error: responseParams.get("enc_error_code") || "Inquiry failed",
      };
    }

    const decryptedJsonString = decryptSmartPayResponse(encResponse);
    const orderData = JSON.parse(decryptedJsonString);

    return {
      success: true,
      orderStatus: orderData.order_status,
      bankRefNo: orderData.order_bank_ref_no,
    };
  } catch (error) {
    console.error("Failed to check order status:", error);
    return { success: false, error: "API connection failed" };
  }
}

/**
 * 2. REFUND API
 * Issues a full or partial refund for a captured transaction.
 */
export async function refundBooking(
  bookingId: string,
  amountToRefund: number,
  bankReferenceNo: string,
) {
  const formattedAmount = Number(amountToRefund).toFixed(3);
  const refundRefNo = `REF-${bookingId.substring(0, 8)}-${Date.now()}`;

  const jsonRequest = JSON.stringify({
    reference_no: bankReferenceNo,
    refund_amount: formattedAmount,
    refund_ref_no: refundRefNo,
  });

  const encRequest = encryptSmartPayRequest(jsonRequest);

  const requestBody = new URLSearchParams({
    enc_request: encRequest,
    access_code: ACCESS_CODE,
    command: "refundOrder",
    request_type: "JSON",
    response_type: "JSON",
    version: "1.1",
  });

  try {
    const response = await fetch(SMARTPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    const data = await response.text();
    const responseParams = new URLSearchParams(data);
    const status = responseParams.get("status");
    const encResponse = responseParams.get("enc_response");

    if (status === "1" || !encResponse) {
      return { success: false, error: "Refund failed at bank level" };
    }

    const decryptedJsonString = decryptSmartPayResponse(encResponse);
    const refundData = JSON.parse(decryptedJsonString);

    if (refundData.refund_status === 0) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "REFUNDED" },
      });
      return { success: true };
    } else {
      return { success: false, error: refundData.reason };
    }
  } catch (error) {
    console.error("Refund API Error:", error);
    return { success: false, error: "API connection failed" };
  }
}

/**
 * 3. ORDER LOOKUP API
 * Fetches a list of transactions between two dates for reporting.
 */
export async function lookupOrders(
  fromDate: string,
  toDate: string,
  pageNumber: number = 1,
) {
  const jsonRequest = JSON.stringify({
    from_date: fromDate, // Format must be dd-mm-yyyy
    to_date: toDate, // Format must be dd-mm-yyyy
    page_number: pageNumber,
  });

  const encRequest = encryptSmartPayRequest(jsonRequest);

  const requestBody = new URLSearchParams({
    enc_request: encRequest,
    access_code: ACCESS_CODE,
    command: "orderLookup",
    request_type: "JSON",
    response_type: "JSON",
    version: "1.2",
  });

  try {
    const response = await fetch(SMARTPAY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: requestBody.toString(),
    });

    const data = await response.text();
    const responseParams = new URLSearchParams(data);
    const status = responseParams.get("status");
    const encResponse = responseParams.get("enc_response");

    if (status === "1" || !encResponse) {
      return { success: false, error: "Lookup failed" };
    }

    const decryptedJsonString = decryptSmartPayResponse(encResponse);
    const lookupData = JSON.parse(decryptedJsonString);

    return {
      success: true,
      orders: lookupData.order_Status_List || [],
      totalPages: lookupData.page_count,
      totalRecords: lookupData.total_records,
    };
  } catch (error) {
    console.error("Lookup API Error:", error);
    return { success: false, error: "API connection failed" };
  }
}
