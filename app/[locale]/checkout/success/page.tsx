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
          {isCash
            ? isEn ? "Booking Received!" : "تم استلام الحجز!"
            : isAdvance
              ? isEn ? "Deposit Received!" : "تم استلام العربون!"
              : isEn ? "Payment Successful!" : "تمت عملية الدفع!"}
        </h1>

        <p className="text-gray-500 mb-6 leading-relaxed">
          {isCash
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
              {isCash
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
                  {isCash
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
                  {isCash
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
