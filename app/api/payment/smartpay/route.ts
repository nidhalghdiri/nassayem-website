import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decryptSmartPayResponse } from "@/lib/smartpay";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import { sendNetsuitePaymentReceipt } from "@/lib/email/sendNetsuitePaymentReceipt";
import { notifyNetsuitePaymentSucceeded } from "@/lib/netsuite";

export async function POST(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  try {
    const textBody = await req.text();
    console.log("RAW BANK RESPONSE:", textBody);

    const formData = new URLSearchParams(textBody);
    const encResponse =
      formData.get("encResp") ||
      formData.get("encResponse") ||
      formData.get("enc_response");

    if (!encResponse) {
      console.error("ERROR: No encrypted response received from bank.");
      return NextResponse.redirect(`${baseUrl}/en/checkout/error`);
    }

    const decryptedString = decryptSmartPayResponse(encResponse);
    console.log("DECRYPTED STRING:", decryptedString);

    const responseParams = new URLSearchParams(decryptedString);
    const orderStatus =
      responseParams.get("order_status") || formData.get("orderStatus");
    const refId = responseParams.get("merchant_param1");
    const locale = responseParams.get("merchant_param2") || "en";
    const kind = responseParams.get("merchant_param3") || "BOOKING";
    const bankAmount = responseParams.get("amount");
    const bankCurrency = responseParams.get("currency");
    const bankRefNo = responseParams.get("order_bank_ref_no") || null;

    console.log(
      `STATUS: ${orderStatus} | KIND: ${kind} | REF: ${refId} | LOCALE: ${locale}`,
    );

    if (!refId) {
      console.error("ERROR: merchant_param1 (record id) is missing!");
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    // ── Route by kind ──────────────────────────────────────────────────────
    if (kind === "NETSUITE") {
      return handleNetsuitePayment({
        baseUrl: baseUrl ?? "",
        paymentId: refId,
        orderStatus,
        bankAmount,
        bankCurrency,
        bankRefNo,
        locale,
        decryptedString,
      });
    }

    // Default: classic Booking flow
    return handleBookingPayment({
      baseUrl: baseUrl ?? "",
      bookingId: refId,
      orderStatus,
      bankAmount,
      bankCurrency,
      locale,
    });
  } catch (error) {
    console.error("WEBHOOK CRASHED:", error);
    return NextResponse.redirect(`${baseUrl}/en/checkout/error`);
  }
}

// ── Booking handler (existing flow) ─────────────────────────────────────────
async function handleBookingPayment(args: {
  baseUrl: string;
  bookingId: string;
  orderStatus: string | null;
  bankAmount: string | null;
  bankCurrency: string | null;
  locale: string;
}) {
  const { baseUrl, bookingId, orderStatus, bankAmount, bankCurrency, locale } =
    args;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    console.error("SECURITY ERROR: Booking not found in database.");
    return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
  }

  if (orderStatus === "Successful" || orderStatus === "Success") {
    if (bankCurrency !== "OMR") {
      console.error(
        `SECURITY ERROR: Currency mismatch. Expected OMR, got ${bankCurrency}`,
      );
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    const expectedAmount = Number(booking.totalPrice).toFixed(3);
    const receivedAmount = Number(bankAmount).toFixed(3);
    if (expectedAmount !== receivedAmount) {
      console.error(
        `SECURITY ERROR: Amount tampering. Expected ${expectedAmount}, got ${receivedAmount}`,
      );
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
      });
      return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    });
    console.log("SUCCESS: Booking Confirmed & Securely Validated!");

    sendBookingConfirmation(bookingId, locale);

    return NextResponse.redirect(
      `${baseUrl}/${locale}/checkout/success?bookingId=${bookingId}`,
    );
  }

  console.warn("PAYMENT DECLINED OR CANCELLED. Status:", orderStatus);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED" },
  });
  return NextResponse.redirect(`${baseUrl}/${locale}/checkout/error`);
}

// ── NetSuite payment handler ────────────────────────────────────────────────
async function handleNetsuitePayment(args: {
  baseUrl: string;
  paymentId: string;
  orderStatus: string | null;
  bankAmount: string | null;
  bankCurrency: string | null;
  bankRefNo: string | null;
  locale: string;
  decryptedString: string;
}) {
  const {
    baseUrl,
    paymentId,
    orderStatus,
    bankAmount,
    bankCurrency,
    bankRefNo,
    locale,
    decryptedString,
  } = args;

  const payment = await prisma.netsuitePayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) {
    console.error("SECURITY ERROR: NetsuitePayment not found:", paymentId);
    return NextResponse.redirect(`${baseUrl}/${locale}/pay/error`);
  }

  // Idempotent: if already PAID, just redirect to success
  if (payment.status === "PAID") {
    return NextResponse.redirect(
      `${baseUrl}/${locale}/pay/success?id=${payment.id}`,
    );
  }

  if (orderStatus === "Successful" || orderStatus === "Success") {
    // Currency check
    if (bankCurrency !== payment.currency) {
      console.error(
        `SECURITY ERROR (NS): currency mismatch. Expected ${payment.currency}, got ${bankCurrency}`,
      );
      return NextResponse.redirect(`${baseUrl}/${locale}/pay/error`);
    }

    // Amount check
    const expectedAmount = Number(payment.amount).toFixed(3);
    const receivedAmount = Number(bankAmount).toFixed(3);
    if (expectedAmount !== receivedAmount) {
      console.error(
        `SECURITY ERROR (NS): amount tampering. Expected ${expectedAmount}, got ${receivedAmount}`,
      );
      await prisma.netsuitePayment.update({
        where: { id: paymentId },
        data: { status: "FAILED" },
      });
      return NextResponse.redirect(`${baseUrl}/${locale}/pay/error`);
    }

    // Persist payment success
    const updated = await prisma.netsuitePayment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        smartpayBankRefNo: bankRefNo,
        smartpayRawResponse: decryptedString,
      },
    });
    console.log("SUCCESS (NS): payment", paymentId, "confirmed");

    // Fire-and-forget: NetSuite callback + emails
    notifyNetsuitePaymentSucceeded({
      netsuiteReservationId: updated.netsuiteReservationId,
      netsuiteReservationRef: updated.netsuiteReservationRef,
      amount: updated.amount,
      currency: updated.currency,
      paidAt: updated.paidAt!.toISOString(),
      smartpayOrderId: updated.smartpayOrderId ?? "",
      smartpayBankRefNo: updated.smartpayBankRefNo,
      customerEmail: updated.customerEmail,
      customerName: updated.customerName,
      paymentLinkId: updated.id,
    })
      .then(async (result) => {
        await prisma.netsuitePayment.update({
          where: { id: paymentId },
          data: {
            netsuiteSyncedAt: result.ok ? new Date() : null,
            netsuiteSyncError: result.ok ? null : (result.error ?? "Unknown"),
          },
        });
      })
      .catch((err) =>
        console.error("[netsuite] callback failed unexpectedly:", err),
      );

    sendNetsuitePaymentReceipt(updated.id, locale).catch((err) =>
      console.error("[email] receipt failed:", err),
    );

    return NextResponse.redirect(
      `${baseUrl}/${locale}/pay/success?id=${payment.id}`,
    );
  }

  // Failure
  console.warn("NS PAYMENT DECLINED. Status:", orderStatus);
  await prisma.netsuitePayment.update({
    where: { id: paymentId },
    data: { status: "FAILED" },
  });
  return NextResponse.redirect(
    `${baseUrl}/${locale}/pay/error?id=${payment.id}`,
  );
}
