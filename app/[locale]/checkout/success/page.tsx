import Link from "next/link";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import GaPurchase from "@/components/analytics/GaPurchase";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function SuccessPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const isEn = locale === "en";

  const bookingId = resolvedSearchParams.bookingId;

  if (!bookingId) return notFound();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { unit: { include: { building: true } } },
  });

  if (!booking) return notFound();

  // EMERGENCY request-only mode: bookings are unpaid requests awaiting staff
  // confirmation. Mirrors the guard in app/actions/booking.ts.
  const requestOnly = process.env.NEXT_PUBLIC_PAYMENTS_DISABLED === "true";
  const CONTACT_PHONE = "+968 99551237";
  const CONTACT_WHATSAPP = "96899551237";

  const isCash = booking.paymentMethod === "CASH";
  const isAdvance =
    booking.paymentPlan === "ADVANCE_50" && booking.amountDueAtCheckIn > 0;
  const paidOnline = booking.amountPaid ?? 0;
  const dueAtCheckIn = booking.amountDueAtCheckIn;

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4 py-10">
      {/* Fire GA4 purchase only for confirmed online payments. Track the amount
          actually charged today, not the full stay value. */}
      {!isCash && (
        <GaPurchase
          transactionId={booking.bookingCode ?? booking.id}
          itemId={booking.unit.id}
          itemName={booking.unit.titleEn}
          itemCategory={booking.unit.rentType}
          value={isAdvance ? paidOnline : Number(booking.totalPrice)}
        />
      )}
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          {requestOnly
            ? isEn ? "Booking Request Received!" : "تم استلام طلب الحجز!"
            : isCash
            ? isEn ? "Booking Received!" : "تم استلام الحجز!"
            : isAdvance
              ? isEn ? "Deposit Received!" : "تم استلام العربون!"
              : isEn ? "Payment Successful!" : "تمت عملية الدفع!"}
        </h1>

        <p className="text-gray-500 mb-6 leading-relaxed">
          {requestOnly
            ? isEn
              ? `Thank you, ${booking.guestName}! We've received your booking request for ${booking.unit.titleEn}. Our customer service team will contact you shortly to confirm availability and arrange payment.`
              : `شكراً لك، ${booking.guestName}! تم استلام طلب حجزك في ${booking.unit.titleAr}. سيتواصل معك فريق خدمة العملاء قريباً لتأكيد التوفر وترتيب الدفع.`
            : isCash
            ? isEn
              ? `Thank you, ${booking.guestName}! Your booking request for ${booking.unit.titleEn} has been received. Our team will confirm it shortly. Please pay at the reception upon arrival.`
              : `شكراً لك، ${booking.guestName}! تم استلام طلب حجزك في ${booking.unit.titleAr}. سيقوم فريقنا بتأكيده قريباً. يرجى الدفع عند الاستقبال لدى وصولك.`
            : isAdvance
              ? isEn
                ? `Thank you, ${booking.guestName}! Your 50% deposit was received and your booking for ${booking.unit.titleEn} is confirmed. Please pay the remaining balance at the reception when you arrive.`
                : `شكراً لك، ${booking.guestName}! تم استلام دفعة 50% وتم تأكيد حجزك في ${booking.unit.titleAr}. يرجى دفع المبلغ المتبقي عند الاستقبال لدى وصولك.`
              : isEn
                ? `Thank you, ${booking.guestName}! Your payment was successful and your booking for ${booking.unit.titleEn} is now confirmed.`
                : `شكراً لك، ${booking.guestName}! تمت عملية الدفع بنجاح وتم تأكيد حجزك في ${booking.unit.titleAr}.`}
        </p>

        {/* Booking summary */}
        <div className="bg-gray-50 rounded-xl p-4 text-start mb-6 text-sm border border-gray-100 space-y-3">
          <div>
            <p className="text-gray-400 text-xs mb-0.5">{isEn ? "Booking #" : "رقم الحجز"}</p>
            <p className="font-mono font-bold text-nassayem text-lg tracking-wider">
              {booking.bookingCode ?? booking.id.slice(0, 10).toUpperCase()}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">
              {isEn ? "Keep this number for your records" : "احتفظ بهذا الرقم لسجلاتك"}
            </p>
          </div>

          {/* Payment plan badge */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <p className="text-gray-500">{isEn ? "Payment Plan" : "خطة الدفع"}</p>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                isCash
                  ? "bg-amber-100 text-amber-700"
                  : isAdvance
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
              }`}
            >
              {requestOnly
                ? isEn ? "Awaiting Confirmation" : "بانتظار التأكيد"
                : isCash
                ? isEn ? "Pay at Reception" : "الدفع عند الاستقبال"
                : isAdvance
                  ? isEn ? "50% Advance" : "دفعة 50%"
                  : isEn ? "Paid in Full" : "مدفوع بالكامل"}
            </span>
          </div>

          {/* Advance breakdown: paid + due + total */}
          {isAdvance ? (
            <>
              <div className="flex justify-between items-center">
                <p className="text-gray-500">{isEn ? "Paid Online" : "المدفوع إلكترونياً"}</p>
                <p className="font-bold text-emerald-700">
                  {paidOnline.toFixed(3)} {isEn ? "OMR" : "ر.ع"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-gray-500">{isEn ? "Due at Check-In" : "مستحق عند الوصول"}</p>
                <p className="font-bold text-amber-700">
                  {dueAtCheckIn.toFixed(3)} {isEn ? "OMR" : "ر.ع"}
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <p className="font-bold text-gray-700">{isEn ? "Total Stay" : "إجمالي الإقامة"}</p>
                <p className="font-extrabold text-nassayem">
                  {booking.totalPrice.toFixed(3)} {isEn ? "OMR" : "ر.ع"}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <p className="text-gray-500">
                  {requestOnly
                    ? isEn ? "Estimated Total" : "الإجمالي التقديري"
                    : isCash
                    ? isEn ? "Amount Due" : "المبلغ المستحق"
                    : isEn ? "Total Paid" : "المبلغ المدفوع"}
                </p>
                <p className="font-bold text-nassayem">
                  {booking.totalPrice.toFixed(3)} {isEn ? "OMR" : "ر.ع"}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-gray-500">{isEn ? "Status" : "الحالة"}</p>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isCash ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                  }`}
                >
                  {requestOnly
                    ? isEn ? "Awaiting Confirmation" : "بانتظار التأكيد"
                    : isCash
                    ? isEn ? "Pending Confirmation" : "بانتظار التأكيد"
                    : isEn ? "Paid" : "مدفوع"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Advance reminder banner */}
        {isAdvance && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs leading-relaxed mb-6 flex items-start gap-2">
            <svg
              className="w-4 h-4 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              />
            </svg>
            <span>
              {isEn
                ? `Please bring ${dueAtCheckIn.toFixed(3)} OMR with you — it's due at the reception when you check in.`
                : `يرجى إحضار ${dueAtCheckIn.toFixed(3)} ر.ع معك — مستحقة عند الاستقبال لدى تسجيل الوصول.`}
            </span>
          </div>
        )}

        {/* Request-only: let the guest reach customer service directly */}
        {requestOnly && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-start mb-6">
            <p className="text-sm font-bold text-gray-700 mb-3">
              {isEn ? "Need to reach us?" : "تريد التواصل معنا؟"}
            </p>
            <div className="space-y-2">
              <a
                href={`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
                  `${isEn ? "Booking" : "حجز"} ${booking.bookingCode ?? booking.id}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm font-bold text-green-700 hover:underline"
              >
                <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                </svg>
                {isEn ? "Chat on WhatsApp" : "تواصل عبر واتساب"}
              </a>
              <a
                href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}
                className="flex items-center gap-3 text-sm font-bold text-nassayem hover:underline"
                dir="ltr"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {CONTACT_PHONE}
              </a>
            </div>
          </div>
        )}

        <Link
          href={`/${locale}`}
          className="block w-full bg-nassayem text-white py-3.5 rounded-xl font-bold hover:bg-nassayem-dark transition-colors"
        >
          {isEn ? "Return to Home" : "العودة للرئيسية"}
        </Link>
      </div>
    </div>
  );
}
