import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { generateBookingPdf } from "./bookingPdf";
import { differenceInDays } from "date-fns";

// Initialise Resend lazily so missing env var only throws at send-time, not import-time
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set.");
  return new Resend(key);
}

// ── HTML email template ───────────────────────────────────────────────────────

function buildEmailHtml(params: {
  guestName: string;
  bookingCode: string;
  unitTitleEn: string;
  buildingNameEn: string;
  checkIn: string;
  checkOut: string;
  totalNights: number;
  totalPrice: number;
  paymentMethod: string;
  status: string;
  locale: string;
}) {
  const {
    guestName, bookingCode, unitTitleEn, buildingNameEn,
    checkIn, checkOut, totalNights, totalPrice, paymentMethod, status, locale,
  } = params;

  const isEn = locale !== "ar";
  const isCash = paymentMethod === "CASH";
  const isPending = status === "PENDING";
  const statusColor = isPending ? "#d97706" : "#059669";
  const statusLabel = isPending ? (isEn ? "Pending Confirmation" : "قيد الانتظار") : (isEn ? "Confirmed" : "مؤكد");

  const subjectLine = isEn
    ? `Your Booking Request — ${bookingCode}`
    : `طلب حجزك — ${bookingCode}`;

  const headline = isEn
    ? isCash ? "We've received your booking!" : "Your payment was successful!"
    : isCash ? "لقد استلمنا طلب حجزك!" : "تمت عملية الدفع بنجاح!";

  const intro = isEn
    ? isCash
      ? `Dear <strong>${guestName}</strong>, thank you for choosing Nassayem Salalah. Your booking request has been received and our team will confirm it shortly.`
      : `Dear <strong>${guestName}</strong>, your payment was processed successfully and your reservation is confirmed. We look forward to welcoming you!`
    : isCash
      ? `عزيزنا <strong>${guestName}</strong>، شكراً لاختيارك نسائم صلالة. تم استلام طلب حجزك وسيقوم فريقنا بتأكيده قريباً.`
      : `عزيزنا <strong>${guestName}</strong>، تمت معالجة دفعتك بنجاح وتم تأكيد حجزك. نتطلع إلى استقبالك!`;

  const footerNote = isEn
    ? isCash
      ? "Please bring this confirmation and pay the full amount at the reception upon check-in."
      : "Please present this confirmation email or the attached PDF at check-in."
    : isCash
      ? "يرجى إحضار هذا التأكيد ودفع المبلغ كاملاً عند الاستقبال لدى تسجيل الوصول."
      : "يرجى تقديم هذا التأكيد أو ملف PDF المرفق عند تسجيل الوصول.";

  return {
    subject: subjectLine,
    html: `<!DOCTYPE html>
<html dir="${isEn ? "ltr" : "rtl"}" lang="${isEn ? "en" : "ar"}">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subjectLine}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#2a7475;padding:28px 32px;">
            <table width="100%">
              <tr>
                <td>
                  <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Nassayem Salalah</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#b2d8d8;">Premium Furnished Apartments · Dhofar, Oman</p>
                </td>
                <td align="${isEn ? "right" : "left"}">
                  <p style="margin:0;font-size:11px;color:#b2d8d8;letter-spacing:1px;text-transform:uppercase;">Booking Confirmation</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Booking code banner -->
        <tr>
          <td style="background:#1d5455;padding:14px 32px;">
            <table width="100%">
              <tr>
                <td>
                  <p style="margin:0;font-size:10px;color:#b2d8d8;letter-spacing:1.5px;text-transform:uppercase;">${isEn ? "Booking Reference" : "رقم الحجز"}</p>
                  <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:3px;">${bookingCode}</p>
                </td>
                <td align="${isEn ? "right" : "left"}">
                  <span style="display:inline-block;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${isPending ? "#fef3c7" : "#d1fae5"};color:${statusColor};">${statusLabel}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <!-- Intro -->
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${intro}</p>

            <!-- Stay details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#2a7475;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr>
                <td align="center" style="padding:16px;border-right:1px solid #3b9293;">
                  <p style="margin:0;font-size:10px;color:#b2d8d8;letter-spacing:1px;text-transform:uppercase;">${isEn ? "Check-In" : "تسجيل الدخول"}</p>
                  <p style="margin:5px 0 0;font-size:14px;font-weight:700;color:#ffffff;">${checkIn}</p>
                </td>
                <td align="center" style="padding:16px;border-right:1px solid #3b9293;">
                  <p style="margin:0;font-size:10px;color:#b2d8d8;letter-spacing:1px;text-transform:uppercase;">${isEn ? "Check-Out" : "تسجيل الخروج"}</p>
                  <p style="margin:5px 0 0;font-size:14px;font-weight:700;color:#ffffff;">${checkOut}</p>
                </td>
                <td align="center" style="padding:16px;">
                  <p style="margin:0;font-size:10px;color:#b2d8d8;letter-spacing:1px;text-transform:uppercase;">${isEn ? "Duration" : "المدة"}</p>
                  <p style="margin:5px 0 0;font-size:14px;font-weight:700;color:#ffffff;">${totalNights} ${isEn ? (totalNights === 1 ? "Night" : "Nights") : "ليلة"}</p>
                </td>
              </tr>
            </table>

            <!-- Property + Payment in 2 cols -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td width="50%" style="padding-right:8px;vertical-align:top;">
                  <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:16px;">
                    <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#2a7475;letter-spacing:1.5px;text-transform:uppercase;">${isEn ? "Property" : "العقار"}</p>
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;">${unitTitleEn}</p>
                    <p style="margin:0;font-size:11px;color:#6b7280;">${buildingNameEn}</p>
                    <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">Salalah, Dhofar, Oman</p>
                  </div>
                </td>
                <td width="50%" style="padding-left:8px;vertical-align:top;">
                  <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:8px;padding:16px;">
                    <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#2a7475;letter-spacing:1.5px;text-transform:uppercase;">${isEn ? "Payment" : "الدفع"}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;">${isEn ? "Method" : "طريقة الدفع"}</p>
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#111827;">${isCash ? (isEn ? "Cash at Reception" : "نقدي عند الاستقبال") : (isEn ? "Online (Card)" : "إلكتروني (بطاقة)")}</p>
                    <p style="margin:0 0 4px;font-size:11px;color:#6b7280;">${isEn ? "Total Amount" : "المبلغ الإجمالي"}</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#2a7475;">${totalPrice.toFixed(3)} OMR</p>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Footer note -->
            <div style="background:${isCash ? "#fffbeb" : "#f0fdf4"};border:1px solid ${isCash ? "#fde68a" : "#bbf7d0"};border-radius:8px;padding:14px;margin-bottom:24px;">
              <p style="margin:0;font-size:12px;color:${isCash ? "#92400e" : "#065f46"};line-height:1.6;">${footerNote}</p>
            </div>

            <!-- PDF notice -->
            <p style="margin:0 0 24px;font-size:12px;color:#9ca3af;text-align:center;">${isEn ? "📎 A PDF copy of this confirmation is attached to this email." : "📎 نسخة PDF من هذا التأكيد مرفقة بهذا البريد الإلكتروني."}</p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="https://wa.me/96899551237" style="display:inline-block;background:#25D366;color:#ffffff;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
                    ${isEn ? "💬 Chat with us on WhatsApp" : "💬 تواصل معنا على واتساب"}
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#2a7475;padding:18px 32px;">
            <table width="100%">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#b2d8d8;">+968 99551237 · nassayem.com</p>
                  <p style="margin:3px 0 0;font-size:10px;color:#80b3b4;">Al Luban Street, Awqad, Salalah, Dhofar, Oman</p>
                </td>
                <td align="${isEn ? "right" : "left"}">
                  <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff;">Nassayem Salalah</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendBookingConfirmation(bookingId: string, locale = "en") {
  try {
    // 1. Fetch full booking data
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { unit: { include: { building: true } } },
    });
    if (!booking) {
      console.error(`[email] Booking ${bookingId} not found — skipping email`);
      return;
    }

    const totalNights = differenceInDays(booking.checkOut, booking.checkIn);
    const bookingCode = booking.bookingCode ?? booking.id.slice(0, 10).toUpperCase();

    const pdfData = {
      bookingCode,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      guestNationality: booking.guestNationality,
      guestNotes: booking.guestNotes,
      paymentMethod: booking.paymentMethod,
      status: booking.status,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalNights,
      totalPrice: booking.totalPrice,
      unitTitleEn: booking.unit.titleEn,
      buildingNameEn: booking.unit.building.nameEn,
      issuedAt: new Date(),
    };

    // 2. Generate PDF
    const pdfBuffer = await generateBookingPdf(pdfData);

    // 3. Build HTML email
    const { subject, html } = buildEmailHtml({
      guestName: booking.guestName,
      bookingCode,
      unitTitleEn: booking.unit.titleEn,
      buildingNameEn: booking.unit.building.nameEn,
      checkIn: pdfData.checkIn.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      checkOut: pdfData.checkOut.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      totalNights,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      status: booking.status,
      locale,
    });

    // 4. Send via Resend
    const resend = getResend();
    const fromAddress = process.env.EMAIL_FROM ?? "Nassayem Salalah <bookings@nassayem.com>";

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: booking.guestEmail,
      subject,
      html,
      attachments: [
        {
          filename: `Nassayem-Booking-${bookingCode}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error(`[email] Resend error for booking ${bookingCode}:`, error);
    } else {
      console.log(`[email] Confirmation sent to ${booking.guestEmail} for booking ${bookingCode}`);
    }
  } catch (err) {
    // Never let email failure break the booking flow
    console.error("[email] sendBookingConfirmation failed:", err);
  }
}
