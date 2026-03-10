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

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-gray-100 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
          {isEn ? "Booking Requested!" : "تم طلب الحجز!"}
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          {isEn
            ? `Thank you, ${booking.guestName}. We have received your request for ${booking.unit.titleEn}. Our team will contact you shortly to confirm.`
            : `شكراً لك، ${booking.guestName}. لقد تلقينا طلبك لـ ${booking.unit.titleAr}. سيتواصل معك فريقنا قريباً للتأكيد.`}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 text-start mb-8 text-sm border border-gray-100">
          <p className="text-gray-500 mb-1">
            {isEn ? "Booking ID" : "رقم الحجز"}
          </p>
          <p className="font-mono font-bold text-gray-900 mb-4">{booking.id}</p>
          <div className="flex justify-between">
            <p className="text-gray-500">
              {isEn ? "Total Amount" : "المبلغ الإجمالي"}
            </p>
            <p className="font-bold text-nassayem">{booking.totalPrice} OMR</p>
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
