import Image from "next/image";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import BookingWidget from "@/components/properties/BookingWidget";
import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

// This function runs on the server BEFORE the page renders
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id, locale } = await params;

  // Fetch the specific unit from your database (Adjust 'unit' to match your Prisma schema)
  const unit = await prisma.unit.findUnique({
    where: { id: id },
    include: {
      images: {
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!unit) {
    return { title: "Property Not Found" };
  }

  // Choose the correct language title/description based on the locale
  const isEn = locale === "en";
  const unitTitle = isEn ? unit.titleEn : unit.titleAr; // Adjust to your actual DB fields
  const unitDescription = isEn ? unit.descriptionEn : unit.descriptionAr;

  return {
    title: unitTitle,
    description: unitDescription?.substring(0, 160), // SEO descriptions should be ~160 chars
    openGraph: {
      title: unitTitle,
      description: unitDescription?.substring(0, 160),
      images: [
        {
          url: unit.images[0]?.url || "https://www.nassayem.com/og-image.jpg",
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

export default async function PropertyDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  // Fetch exact unit
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      building: true,
      amenities: true,
    },
  });

  if (!unit) {
    return notFound();
  }

  // Ensure we have at least 5 images for the bento layout, falling back to placeholders
  const getImageUrl = (index: number) => {
    if (unit.images[index]) return unit.images[index].url;
    return "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=1200&auto=format&fit=crop";
  };

  const currentPrice =
    unit.rentType === "MONTHLY" ? unit.monthlyPrice : unit.dailyPrice;

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* 1. Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {isEn ? unit.titleEn : unit.titleAr}
          </h1>
          <div className="flex items-center justify-between text-sm font-medium text-gray-700">
            <div className="flex items-center gap-4">
              <span className="underline cursor-pointer">
                {isEn ? unit.building.locationEn : unit.building.locationAr}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="hidden md:flex gap-4">
              <button className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                {isEn ? "Share" : "مشاركة"}
              </button>
              <button className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {isEn ? "Save" : "حفظ"}
              </button>
            </div>
          </div>
        </div>

        {/* 2. Bento Box Image Gallery */}
        <div className="relative w-full h-[30vh] md:h-[60vh] rounded-2xl overflow-hidden mb-10 group">
          <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-2 h-full w-full">
            <div className="col-span-1 md:col-span-2 md:row-span-2 relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(0)}
                alt="Main View"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(1)}
                alt="View 2"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(2)}
                alt="View 3"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(3)}
                alt="View 4"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(4)}
                alt="View 5"
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>

        {/* 3. Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
          <div className="lg:col-span-2">
            {/* Hosting Details */}
            <div className="flex justify-between items-start pb-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                  {isEn
                    ? `Managed by Nassayem Salalah in ${unit.building.nameEn}`
                    : `بإدارة نسائم صلالة في ${unit.building.nameAr}`}
                </h2>
                <ol className="flex flex-wrap items-center gap-1 text-gray-600">
                  <li>
                    {unit.guests} {isEn ? "guests" : "ضيوف"}
                  </li>
                  <li className="px-1 text-gray-400">•</li>
                  <li>
                    {unit.bedrooms} {isEn ? "bedrooms" : "غرف نوم"}
                  </li>
                  <li className="px-1 text-gray-400">•</li>
                  <li>
                    {unit.beds} {isEn ? "beds" : "أسرة"}
                  </li>
                  <li className="px-1 text-gray-400">•</li>
                  <li>
                    {unit.bathrooms} {isEn ? "baths" : "حمامات"}
                  </li>
                </ol>
              </div>
              <div className="w-14 h-14 bg-nassayem text-white rounded-full flex items-center justify-center text-xl font-bold shadow-sm">
                N
              </div>
            </div>

            {/* Description Area */}
            <div className="py-8 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {isEn ? "About this space" : "عن هذا المكان"}
              </h3>
              <p className="text-gray-600 leading-relaxed text-lg whitespace-pre-line">
                {isEn ? unit.descriptionEn : unit.descriptionAr}
              </p>
            </div>

            {/* Amenities Grid */}
            <div className="py-8 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                {isEn ? "What this place offers" : "ما يوفره هذا المكان"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
                    en: "Private Pool",
                    ar: "مسبح خاص",
                  },
                  {
                    icon: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
                    en: "Fast WiFi",
                    ar: "واي فاي سريع",
                  },
                  {
                    icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
                    en: "Sea View",
                    ar: "إطلالة بحرية",
                  },
                  {
                    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
                    en: "Dedicated Workspace",
                    ar: "مساحة عمل مخصصة",
                  },
                  {
                    icon: "M13 10V3L4 14h7v7l9-11h-7z",
                    en: "Central AC",
                    ar: "تكييف مركزي",
                  },
                  {
                    icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
                    en: "Free Parking",
                    ar: "موقف سيارات مجاني",
                  },
                ].map((amenity, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 text-gray-700"
                  >
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d={amenity.icon}
                      />
                    </svg>
                    <span className="text-lg">
                      {isEn ? amenity.en : amenity.ar}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-6 border border-gray-900 text-gray-900 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">
                {isEn ? "Show all 24 amenities" : "عرض كل الـ 24 مرفق"}
              </button>
            </div>
          </div>

          {/* Right Column (Interactive Sticky Booking Widget) */}
          <div className="relative lg:col-span-1">
            <BookingWidget
              unitId={unit.id}
              priceDaily={unit.dailyPrice}
              priceMonthly={unit.monthlyPrice}
              rentType={unit.rentType}
              locale={locale}
            />
          </div>
        </div>
        {/* Mobile Fixed Bottom Booking Bar (You can also convert this to use the widget logic later) */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex justify-between items-center z-50">
          <div>
            <div className="flex items-end gap-1">
              <span className="text-xl font-extrabold text-gray-900">
                {currentPrice}
              </span>
              <span className="text-gray-500 font-medium text-sm pb-0.5">
                {isEn
                  ? unit.rentType === "MONTHLY"
                    ? "OMR / month"
                    : "OMR / night"
                  : unit.rentType === "MONTHLY"
                    ? "ر.ع / شهر"
                    : "ر.ع / ليلة"}
              </span>
            </div>
          </div>
          {/* Navigates directly to checkout for mobile users. We'll refine mobile date picking later */}
          <Link
            href={`/${locale}/properties/${unit.id}/checkout`}
            className="bg-nassayem text-white px-8 py-3 rounded-xl font-bold hover:bg-nassayem-dark transition-colors"
          >
            {isEn ? "Reserve" : "احجز"}
          </Link>
        </div>
      </div>
    </div>
  );
}
