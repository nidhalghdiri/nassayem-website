import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptSmartPayResponse } from "@/lib/smartpay";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    // 1. Safely parse the raw text body (Bank gateways send x-www-form-urlencoded)
    const textBody = await req.text();
    console.log("RAW BANK RESPONSE:", textBody);
    // Read the form data sent by the bank
    const formData = new URLSearchParams(textBody);
    const orderId = formData.get("order_id") as string; // [cite: 117]
    const encResponse =
      formData.get("encResp") ||
      formData.get("encResponse") ||
      formData.get("enc_response");
    if (!encResponse) {
      console.error("ERROR: No encrypted response received from bank.");
      return NextResponse.redirect(`${baseUrl}/en/checkout/error`);
    }
    // 1. Decrypt the response string [cite: 124, 125]
    const decryptedString = decryptSmartPayResponse(encResponse);
    console.log("DECRYPTED STRING:", decryptedString);
    // 2. Parse the decrypted string into an object (it's formatted like key=value&key2=value2)
    const responseParams = new URLSearchParams(decryptedString);
    const orderStatus =
      responseParams.get("order_status") || formData.get("orderStatus");
    // NEW: Extract the real Prisma booking ID from merchant_param1
    const realBookingId = responseParams.get("merchant_param1");
    const locale = responseParams.get("merchant_param2") || "en";
    console.log(
      `STATUS: ${orderStatus} | BOOKING ID: ${realBookingId} | LOCALE: ${locale}`,
    );

    // NEW: Extract security parameters for Phase 2 validation
    const bankAmount = responseParams.get("amount");
    const bankCurrency = responseParams.get("currency");

    if (!realBookingId) {
      console.error("ERROR: merchant_param1 (Booking ID) is missing!");
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: realBookingId },
    });
    if (!booking) {
      console.error("SECURITY ERROR: Booking not found in database.");
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    // 3. Update the Prisma database based on the order status [cite: 126, 127]
    if (orderStatus === "Successful" || orderStatus === "Success") {
      // PHASE 2 SECURITY VALIDATION 1: Currency Match
      if (bankCurrency !== "OMR") {
        console.error(
          `SECURITY ERROR: Currency mismatch. Expected OMR, got ${bankCurrency}`,
        );
        return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
      }

      // Format the database price to 3 decimal places to exactly match the bank's format
      const expectedAmount = Number(booking.totalPrice).toFixed(3);
      const receivedAmount = Number(bankAmount).toFixed(3);
      if (expectedAmount !== receivedAmount) {
        console.error(
          `SECURITY ERROR: Amount tampering detected! Expected ${expectedAmount}, got ${receivedAmount}`,
        );
        // Cancel the booking because the payment amounts do not match
        await prisma.booking.update({
          where: { id: realBookingId },
          data: { status: "CANCELLED" },
        });
        return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
      }

      // [cite: 162]
      await prisma.booking.update({
        where: { id: realBookingId },
        data: { status: "CONFIRMED" },
      });
      console.log("SUCCESS: Booking Confirmed & Securely Validated!");

      // Send booking confirmation email with PDF (fire-and-forget)
      sendBookingConfirmation(realBookingId, locale);

      return NextResponse.redirect(
        `${baseUrl}/${locale}/checkout/success?bookingId=${realBookingId}`,
      );
    } else {
      // Handle actual payment failures (Declined, Insufficient Funds, etc.)
      console.warn("PAYMENT DECLINED OR CANCELLED. Status:", orderStatus);
      await prisma.booking.update({
        where: { id: realBookingId },
        data: { status: "CANCELLED" },
      });
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }
  } catch (error) {
    console.error("WEBHOOK CRASHED:", error);
    return NextResponse.redirect(`${baseUrl}/en/checkout/error`);
  }
}
