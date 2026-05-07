/**
 * DEV-ONLY simulator for the SmartPay success callback.
 *
 * Lets you verify the full post-payment flow without spending real money:
 *   - marks a NetsuitePayment as PAID
 *   - fires the NetSuite outbound callback (with sync trace persisted)
 *   - sends customer + receptionist receipt emails
 *   - returns the success-page URL the bank would normally redirect to
 *
 * Hard-disabled in production. Also requires the x-netsuite-secret header,
 * the same shared secret used for the real inbound endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyNetsuiteInboundSecret, notifyNetsuitePaymentSucceeded } from "@/lib/netsuite";
import { sendNetsuitePaymentReceipt } from "@/lib/email/sendNetsuitePaymentReceipt";

export async function POST(req: NextRequest) {
  // Hard guard: never run in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Disabled in production" },
      { status: 403 },
    );
  }

  // Same shared secret as the real inbound endpoint
  const providedSecret = req.headers.get("x-netsuite-secret");
  if (!verifyNetsuiteInboundSecret(providedSecret)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: {
    token?: string;
    paymentLinkId?: string;
    customerEmail?: string;
    locale?: "en" | "ar";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { token, paymentLinkId, customerEmail, locale = "en" } = body;

  if (!token && !paymentLinkId) {
    return NextResponse.json(
      { ok: false, error: "Provide either 'token' or 'paymentLinkId'" },
      { status: 400 },
    );
  }

  const payment = await prisma.netsuitePayment.findFirst({
    where: token ? { token } : { id: paymentLinkId },
  });

  if (!payment) {
    return NextResponse.json(
      { ok: false, error: "Payment link not found" },
      { status: 404 },
    );
  }

  if (payment.status === "PAID") {
    return NextResponse.json({
      ok: true,
      alreadyPaid: true,
      paymentLinkId: payment.id,
      successUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/pay/success?id=${payment.id}`,
      payment,
    });
  }

  if (payment.status !== "PENDING") {
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot simulate payment for status=${payment.status}`,
      },
      { status: 400 },
    );
  }

  // If the public page wasn't visited, the email may be empty — accept one here.
  const finalEmail = customerEmail?.trim() || payment.customerEmail;
  if (!finalEmail) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Customer email is missing on the record. Either visit the public /pay/[token] page first, or pass 'customerEmail' in the body.",
      },
      { status: 400 },
    );
  }

  // 1. Mark as PAID with fake bank trace
  const fakeOrderId = `TEST${Date.now().toString().slice(-12)}`;
  const fakeBankRef = `TEST-BANKREF-${Date.now()}`;
  const updated = await prisma.netsuitePayment.update({
    where: { id: payment.id },
    data: {
      customerEmail: finalEmail,
      status: "PAID",
      paidAt: new Date(),
      smartpayOrderId: payment.smartpayOrderId ?? fakeOrderId,
      smartpayBankRefNo: fakeBankRef,
      smartpayRawResponse: "{\"simulated\":true}",
    },
  });

  // 2. NetSuite callback (await so we can return the result for inspection)
  const syncResult = await notifyNetsuitePaymentSucceeded({
    netsuiteReservationId: updated.netsuiteReservationId,
    netsuiteReservationRef: updated.netsuiteReservationRef,
    amount: updated.amount,
    currency: updated.currency,
    paidAt: updated.paidAt!.toISOString(),
    smartpayOrderId: updated.smartpayOrderId ?? fakeOrderId,
    smartpayBankRefNo: updated.smartpayBankRefNo,
    customerEmail: updated.customerEmail,
    customerName: updated.customerName,
    paymentLinkId: updated.id,
  });

  await prisma.netsuitePayment.update({
    where: { id: updated.id },
    data: {
      netsuiteSyncedAt: syncResult.ok ? new Date() : null,
      netsuiteSyncError: syncResult.ok ? null : (syncResult.error ?? "Unknown"),
    },
  });

  // 3. Emails (await so we can surface failures in the test response)
  await sendNetsuitePaymentReceipt(updated.id, locale);

  return NextResponse.json({
    ok: true,
    simulated: true,
    paymentLinkId: updated.id,
    successUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/pay/success?id=${updated.id}`,
    netsuiteCallback: syncResult,
    notes: [
      "If 'netsuiteCallback.ok' is false, NETSUITE_OUTBOUND_URL or NETSUITE_M2M_TOKEN is not configured — that's expected for now and does NOT block the customer-facing flow.",
      "Check your inbox at the customer email and the receptionist email for the receipts.",
      "Open 'successUrl' in a browser to see the customer-facing success page.",
    ],
  });
}
