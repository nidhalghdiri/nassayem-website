import Image from "next/image";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { calculateBookingPrice } from "@/app/actions/booking";
import CheckoutForm from "@/components/properties/CheckoutForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps) {
  const { locale, id } = await params;
  const resolvedSearchParams = await searchParams;
  const isEn = locale === "en";

  const checkIn = resolvedSearchParams.checkIn;
  const checkOut = resolvedSearchParams.checkOut;

  // If no dates are provided in the URL, bounce them back to the property page
  if (!checkIn || !checkOut) {
    redirect(`/${locale}/properties/${id}`);
  }

  // Fetch unit details
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      images: { orderBy: { displayOrder: "asc" }, take: 1 },
      building: true,
    },
  });

  if (!unit) return notFound();

  // Calculate pricing server-side for the summary
  let pricing;
  try {
    pricing = await calculateBookingPrice(unit.id, checkIn, checkOut);
  } catch (error) {
    // If dates are invalid (e.g., minimum 30 days not met for Monthly), bounce back
    redirect(`/${locale}/properties/${id}`);
  }

  const coverImage =
    unit.images[0]?.url ||
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=800";

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/${locale}/properties/${id}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-nassayem transition-colors mb-4"
          >
            <svg
              className="w-5 h-5 rtl:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {isEn ? "Back to Property" : "العودة للعقار"}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {isEn ? "Request to Book" : "طلب حجز"}
          </h1>
        </div>

        <div className="flex flex-col-reverse lg:flex-row gap-12">
          {/* Left Column: Checkout Form */}
          <div className="w-full lg:w-2/3">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
                {isEn ? "Your Trip" : "رحلتك"}
              </h2>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {isEn ? "Dates" : "التواريخ"}
                  </h3>
                  <p className="text-gray-600">
                    {checkIn} — {checkOut}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-900">
                    {isEn ? "Guests" : "الضيوف"}
                  </h3>
                  <p className="text-gray-600">
                    {resolvedSearchParams.guests || 1}{" "}
                    {isEn ? "Guest(s)" : "ضيف"}
                  </p>
                </div>
              </div>
            </div>

            {/* The Form */}
            <CheckoutForm
              unitId={unit.id}
              checkIn={checkIn}
              checkOut={checkOut}
              locale={locale}
            />
          </div>

          {/* Right Column: Order Summary */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl sticky top-28">
              <div className="flex gap-4 border-b border-gray-100 pb-6 mb-6">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0">
                  <Image
                    src={coverImage}
                    alt="Unit"
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold mb-1">
                    {isEn ? unit.building.nameEn : unit.building.nameAr}
                  </p>
                  <h3 className="font-bold text-gray-900 text-sm line-clamp-2">
                    {isEn ? unit.titleEn : unit.titleAr}
                  </h3>
                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    4.96 (24 {isEn ? "reviews" : "تقييم"})
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {isEn ? "Price Details" : "تفاصيل السعر"}
              </h3>

              <div className="space-y-3 text-gray-600 text-sm">
                <div className="flex justify-between">
                  <span>{pricing.calculationMethod}</span>
                  <span>
                    {pricing.baseRent} {isEn ? "OMR" : "ر.ع"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-100 font-extrabold text-gray-900 text-xl">
                <span>{isEn ? "Total (OMR)" : "المجموع (ر.ع)"}</span>
                <span>{pricing.grandTotal}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
