import Link from "next/link";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

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

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          {isCash
            ? isEn ? "Booking Confirmed!" : "تم تأكيد الحجز!"
            : isEn ? "Payment Successful!" : "تمت عملية الدفع!"}
        </h1>

        <p className="text-gray-500 mb-8 leading-relaxed">
          {isCash
            ? isEn
              ? `Thank you, ${booking.guestName}! Your booking for ${booking.unit.titleEn} is confirmed. Please pay at the reception upon arrival.`
              : `شكراً لك، ${booking.guestName}! تم تأكيد حجزك في ${booking.unit.titleAr}. يرجى الدفع عند الاستقبال لدى وصولك.`
            : isEn
              ? `Thank you, ${booking.guestName}! Your payment was successful and your booking for ${booking.unit.titleEn} is now confirmed.`
              : `شكراً لك، ${booking.guestName}! تمت عملية الدفع بنجاح وتم تأكيد حجزك في ${booking.unit.titleAr}.`}
        </p>

        {/* Booking summary */}
        <div className="bg-gray-50 rounded-xl p-4 text-start mb-6 text-sm border border-gray-100 space-y-3">
          <div>
            <p className="text-gray-400 text-xs mb-0.5">{isEn ? "Booking ID" : "رقم الحجز"}</p>
            <p className="font-mono font-bold text-gray-900 text-xs">{booking.id}</p>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <p className="text-gray-500">{isEn ? "Total Amount" : "المبلغ الإجمالي"}</p>
            <p className="font-bold text-nassayem">{booking.totalPrice} {isEn ? "OMR" : "ر.ع"}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-gray-500">{isEn ? "Payment" : "الدفع"}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isCash ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
            }`}>
              {isCash
                ? isEn ? "Cash at Reception" : "نقداً عند الاستقبال"
                : isEn ? "Online — Paid" : "إلكتروني — مدفوع"}
            </span>
          </div>
        </div>

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
