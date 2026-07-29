"use server";

import prisma from "@/lib/prisma";
import { encryptSmartPayRequest } from "@/lib/smartpay";
import { revalidatePath } from "next/cache";
import { requireManager, getCurrentAdminUser } from "@/lib/adminAuth";
import { notifyNetsuitePaymentSucceeded } from "@/lib/netsuite";
import { sendWhatsAppDocument } from "@/lib/whatsapp";

/**
 * Confirms the customer details on the public payment page and prepares the
 * SmartPay redirect.
 *
 * The amount is taken FROM THE DATABASE (never trusted from the client).
 * The token from the URL is the only handle we accept — the client never
 * tells us the amount or reservation id.
 */
export async function startNetsuitePaymentCheckout(
  token: string,
  formData: FormData,
  locale: string,
) {
  // Email is OPTIONAL — used only for the receipt. Validate format only when
  // the customer actually entered one.
  const customerEmail = (formData.get("customerEmail") as string)?.trim() || "";

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error(
      locale === "ar"
        ? "يرجى إدخال بريد إلكتروني صحيح."
        : "Please enter a valid email address.",
    );
  }

  // Lookup by token. Status & expiry checked here to catch race conditions
  // (e.g. customer leaves the tab open past expiry, or pays twice).
  const payment = await prisma.netsuitePayment.findUnique({
    where: { token },
  });

  if (!payment) {
    throw new Error(
      locale === "ar" ? "رابط الدفع غير صالح." : "Payment link not found.",
    );
  }

  if (payment.status === "PAID") {
    throw new Error(
      locale === "ar"
        ? "تم دفع هذا الرابط بالفعل."
        : "This payment has already been completed.",
    );
  }

  if (payment.status === "VOIDED") {
    throw new Error(
      locale === "ar"
        ? "تم إلغاء رابط الدفع."
        : "This payment link has been cancelled.",
    );
  }

  if (payment.expiresAt.getTime() < Date.now()) {
    // Auto-mark as expired for hygiene
    await prisma.netsuitePayment.update({
      where: { id: payment.id },
      data: { status: "EXPIRED" },
    });
    throw new Error(
      locale === "ar" ? "انتهت صلاحية الرابط." : "This payment link has expired.",
    );
  }

  // Persist the email the customer entered (in case NetSuite didn't supply
  // one). Never overwrite an existing email with an empty value.
  if (customerEmail) {
    await prisma.netsuitePayment.update({
      where: { id: payment.id },
      data: { customerEmail },
    });
  }

  // Build SmartPay request — amount comes from DB, not from client
  const formattedAmount = Number(payment.amount).toFixed(3);
  // Short order id used as SmartPay's order_no — must fit in their 20-char limit
  const shortOrderId = `NSP${Date.now().toString().slice(-12)}`;
  const merchantId = process.env.SMARTPAY_MERCHANT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const redirectUrl = `${baseUrl}/api/payment/smartpay`;
  const cancelUrl = `${baseUrl}/api/payment/smartpay`;

  // merchant_param1 = our payment link id (used by webhook)
  // merchant_param2 = locale
  // merchant_param3 = "NETSUITE" (kind discriminator for the webhook)
  const requestString =
    `merchant_id=${merchantId}` +
    `&order_id=${shortOrderId}` +
    `&currency=${payment.currency}` +
    `&amount=${formattedAmount}` +
    `&redirect_url=${redirectUrl}` +
    `&cancel_url=${cancelUrl}` +
    `&merchant_param1=${payment.id}` +
    `&merchant_param2=${locale}` +
    `&merchant_param3=NETSUITE`;

  const encRequest = encryptSmartPayRequest(requestString);

  // Save the SmartPay order id so we can reconcile later
  await prisma.netsuitePayment.update({
    where: { id: payment.id },
    data: { smartpayOrderId: shortOrderId },
  });

  return {
    success: true,
    paymentUrl: process.env.SMARTPAY_TRANSACTION_URL,
    accessCode: process.env.SMARTPAY_ACCESS_CODE,
    encRequest,
  };
}

/**
 * Admin-only: void an unpaid payment link.
 */
export async function voidNetsuitePayment(id: string) {
  await prisma.netsuitePayment.update({
    where: { id },
    data: { status: "VOIDED" },
  });
  revalidatePath("/en/admin/netsuite-payments");
  revalidatePath("/ar/admin/netsuite-payments");
}

/**
 * Manager-only: soft-delete (deactivate) a payment record. Hides it from the
 * default list — it can still be viewed via the Inactive filter, and reversed
 * via reactivateNetsuitePayment.
 */
export async function deactivateNetsuitePayment(id: string) {
  await requireManager();
  await prisma.netsuitePayment.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/en/admin/netsuite-payments");
  revalidatePath("/ar/admin/netsuite-payments");
}

/**
 * Manager-only: undo a soft-delete.
 */
export async function reactivateNetsuitePayment(id: string) {
  await requireManager();
  await prisma.netsuitePayment.update({
    where: { id },
    data: { isActive: true },
  });
  revalidatePath("/admin/netsuite-payments");
  revalidatePath("/ar/admin/netsuite-payments");
  revalidatePath("/en/admin/netsuite-payments");
}

export async function simulateAdminPayment(id: string) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.email !== "ghdiri.nidhal@gmail.com") {
    throw new Error("Unauthorized: Only authorized admin can simulate payments.");
  }

  const payment = await prisma.netsuitePayment.findUnique({
    where: { id },
  });

  if (!payment) throw new Error("Payment not found");
  if (payment.status === "PAID") throw new Error("Payment already paid");

  const syncResult = await notifyNetsuitePaymentSucceeded({
    netsuiteReservationId: payment.netsuiteReservationId,
    netsuiteReservationRef: payment.netsuiteReservationRef,
    amount: Number(payment.amount),
    currency: "OMR",
    paidAt: new Date().toISOString(),
    smartpayOrderId: "SIM-ORD-" + Date.now(),
    customerEmail: payment.customerEmail,
    customerName: payment.customerName,
    paymentLinkId: payment.id,
  });

  await prisma.netsuitePayment.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      smartpayOrderId: "SIM-ORD-" + Date.now(),
      netsuiteSyncError: syncResult.ok ? null : syncResult.error,
    },
  });

  if (syncResult.ok && syncResult.paymentPdfUrl && payment.customerPhone) {
    await sendWhatsAppDocument(
      payment.customerPhone,
      syncResult.paymentPdfUrl,
      `PaymentReceipt_SIM.pdf`,
      "Thank you! Your payment has been received. Here is your receipt."
    ).catch((err) => console.error("[whatsapp] failed to send simulate payment PDF:", err));
  }

  revalidatePath("/admin/netsuite-payments");
  revalidatePath("/ar/admin/netsuite-payments");
  revalidatePath("/en/admin/netsuite-payments");
}
