import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set.");
  return new Resend(key);
}

type EmailVars = {
  customerName: string;
  reservationRef: string | null;
  unitCode: string | null;
  checkIn: string | null;
  checkOut: string | null;
  amount: string;
  currency: string;
  paidAt: string;
  bankRefNo: string | null;
  description: string | null;
  locale: string;
  isReceptionist: boolean;
};

function buildEmail(v: EmailVars) {
  const isEn = v.locale !== "ar";

  const subject = v.isReceptionist
    ? isEn
      ? `Payment received — ${v.amount} ${v.currency}${v.reservationRef ? ` (${v.reservationRef})` : ""}`
      : `تم استلام الدفع — ${v.amount} ${v.currency}${v.reservationRef ? ` (${v.reservationRef})` : ""}`
    : isEn
      ? `Your payment was successful — ${v.amount} ${v.currency}`
      : `تمت عملية الدفع بنجاح — ${v.amount} ${v.currency}`;

  const headline = v.isReceptionist
    ? isEn
      ? "A payment has been received"
      : "تم استلام دفعة جديدة"
    : isEn
      ? "Thank you — your payment was received"
      : "شكراً لك — تم استلام دفعتك";

  const intro = v.isReceptionist
    ? isEn
      ? `A NetSuite reservation payment was just completed by <strong>${v.customerName}</strong>. NetSuite has been updated automatically.`
      : `تم استلام دفعة من العميل <strong>${v.customerName}</strong> بنجاح. تم تحديث NetSuite تلقائياً.`
    : isEn
      ? `Dear <strong>${v.customerName}</strong>, we've received your payment. Below is your receipt for your records.`
      : `عزيزنا <strong>${v.customerName}</strong>، تم استلام دفعتك. فيما يلي إيصال للحفظ في سجلاتك.`;

  const rows: Array<[string, string]> = [];
  if (v.reservationRef)
    rows.push([isEn ? "Reservation" : "الحجز", v.reservationRef]);
  if (v.unitCode) rows.push([isEn ? "Unit" : "الوحدة", v.unitCode]);
  if (v.checkIn) rows.push([isEn ? "Check-in" : "تسجيل الدخول", v.checkIn]);
  if (v.checkOut)
    rows.push([isEn ? "Check-out" : "تسجيل الخروج", v.checkOut]);
  rows.push([isEn ? "Paid on" : "تاريخ الدفع", v.paidAt]);
  if (v.bankRefNo) rows.push([isEn ? "Bank Ref" : "مرجع البنك", v.bankRefNo]);
  if (v.description) rows.push([isEn ? "Description" : "الوصف", v.description]);

  const detailRows = rows
    .map(
      ([k, val]) => `
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:13px;">${k}</td>
          <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:${isEn ? "right" : "left"};">${val}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html dir="${isEn ? "ltr" : "rtl"}" lang="${isEn ? "en" : "ar"}">
<head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr><td style="background:#2a7475;padding:28px 32px;">
        <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Nassayem Salalah</p>
        <p style="margin:4px 0 0;font-size:12px;color:#b2d8d8;">${isEn ? "Premium Furnished Apartments · Dhofar, Oman" : "شقق مفروشة فاخرة · ظفار، عُمان"}</p>
      </td></tr>

      <!-- Amount banner -->
      <tr><td style="background:#1d5455;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#b2d8d8;letter-spacing:2px;text-transform:uppercase;">${isEn ? "Amount Paid" : "المبلغ المدفوع"}</p>
        <p style="margin:6px 0 0;font-size:32px;font-weight:800;color:#ffffff;">${v.amount} <span style="font-size:18px;color:#b2d8d8;">${v.currency}</span></p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px;">
        <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">${headline}</h2>
        <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6;">${intro}</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:16px 20px;">
          ${detailRows}
        </table>

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">${
          isEn
            ? "Bank Muscat SmartPay · This is a confirmation receipt."
            : "بنك مسقط SmartPay · هذا إيصال تأكيد دفع."
        }</p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#2a7475;padding:16px 32px;">
        <p style="margin:0;font-size:11px;color:#b2d8d8;">+968 99551237 · nassayem.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html };
}

/**
 * Sends two emails after a successful NetSuite payment:
 *   1. Receipt to the customer (if we have their email).
 *   2. Notification to the receptionist (if we have their email).
 *
 * Never throws — failures are logged but should not break the payment flow.
 */
export async function sendNetsuitePaymentReceipt(
  paymentId: string,
  locale: string,
) {
  try {
    const payment = await prisma.netsuitePayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status !== "PAID") return;

    const isEn = locale !== "ar";
    const dateLocale = isEn ? enUS : ar;
    const fmt = (d: Date | null) =>
      d ? format(d, "EEE, d MMM yyyy", { locale: dateLocale }) : null;

    const baseVars: Omit<EmailVars, "isReceptionist"> = {
      customerName: payment.customerName,
      reservationRef: payment.netsuiteReservationRef,
      unitCode: payment.unitCode,
      checkIn: fmt(payment.checkIn),
      checkOut: fmt(payment.checkOut),
      amount: payment.amount.toFixed(3),
      currency: payment.currency,
      paidAt: payment.paidAt
        ? format(payment.paidAt, "d MMM yyyy, HH:mm", { locale: dateLocale })
        : "—",
      bankRefNo: payment.smartpayBankRefNo,
      description: payment.description,
      locale,
    };

    const resend = getResend();
    const fromAddress =
      process.env.EMAIL_FROM ?? "Nassayem Salalah <bookings@nassayem.com>";

    // 1. Customer receipt
    if (payment.customerEmail) {
      const { subject, html } = buildEmail({
        ...baseVars,
        isReceptionist: false,
      });
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: payment.customerEmail,
        subject,
        html,
      });
      if (error) {
        console.error(
          "[email] customer receipt failed:",
          payment.customerEmail,
          error,
        );
      } else {
        console.log("[email] customer receipt sent to", payment.customerEmail);
      }
    }

    // 2. Receptionist notification (always English for staff)
    if (payment.receptionistEmail) {
      const { subject, html } = buildEmail({
        ...baseVars,
        locale: "en",
        isReceptionist: true,
      });
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: payment.receptionistEmail,
        subject,
        html,
      });
      if (error) {
        console.error(
          "[email] receptionist notify failed:",
          payment.receptionistEmail,
          error,
        );
      } else {
        console.log(
          "[email] receptionist notified at",
          payment.receptionistEmail,
        );
      }
    }
  } catch (err) {
    console.error("[email] sendNetsuitePaymentReceipt failed:", err);
  }
}
