import Image from "next/image";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import BookingWidget from "@/components/properties/BookingWidget";
import GaViewItem from "@/components/analytics/GaViewItem";

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
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/properties/${id}`,
      languages: {
        en: `https://www.nassayem.com/en/properties/${id}`,
        ar: `https://www.nassayem.com/ar/properties/${id}`,
      },
    },
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

  // 1. Build the JSON-LD Schema Object
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: isEn ? "Home" : "الرئيسية", item: `https://www.nassayem.com/${locale}` },
      { "@type": "ListItem", position: 2, name: isEn ? "Properties" : "العقارات", item: `https://www.nassayem.com/${locale}/properties` },
      { "@type": "ListItem", position: 3, name: isEn ? unit.titleEn : unit.titleAr, item: `https://www.nassayem.com/${locale}/properties/${unit.id}` },
    ],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: isEn ? unit.titleEn : unit.titleAr,
    description: isEn ? unit.descriptionEn : unit.descriptionAr,
    image: [
      unit.images[0]?.url || "https://www.nassayem.com/og-image.jpg",
      unit.images[1]?.url || "https://www.nassayem.com/og-image.jpg",
      unit.images[2]?.url || "https://www.nassayem.com/og-image.jpg",
      unit.images[3]?.url || "https://www.nassayem.com/og-image.jpg",
      unit.images[4]?.url || "https://www.nassayem.com/og-image.jpg",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Salalah",
      addressRegion: "Dhofar",
      addressCountry: "OM",
    },
    // The 'offers' block creates the price tag in Google Search
    offers: {
      "@type": "Offer",
      priceCurrency: "OMR",
      price: unit.dailyPrice, // e.g., 25.000
      availability: true
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://www.nassayem.com/${locale}/properties/${unit.id}`,
    },
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <GaViewItem
        itemId={unit.id}
        itemName={unit.titleEn}
        itemCategory={unit.rentType}
        price={unit.rentType === "MONTHLY" ? unit.monthlyPrice : unit.dailyPrice}
      />
      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
                alt={
                  isEn
                    ? `Spacious living room in ${unit.titleEn}, a premium Salalah apartment`
                    : `غرفة معيشة واسعة في ${unit.titleAr}، شقة مفروشة في صلالة`
                }
                fill
                priority
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(1)}
                alt={isEn ? `Bedroom in ${unit.titleEn} – Nassayem Salalah` : `غرفة نوم في ${unit.titleAr} – نسائم صلالة`}
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(2)}
                alt={isEn ? `Kitchen and dining area in ${unit.titleEn}` : `المطبخ وغرفة الطعام في ${unit.titleAr}`}
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(3)}
                alt={isEn ? `Bathroom in ${unit.titleEn} furnished apartment` : `الحمام في شقة ${unit.titleAr} المفروشة`}
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="hidden md:block relative h-full w-full cursor-pointer overflow-hidden">
              <Image
                src={getImageUrl(4)}
                alt={isEn ? `Balcony view from ${unit.titleEn}, ${unit.building.nameEn}` : `إطلالة الشرفة من ${unit.titleAr}، ${unit.building.nameAr}`}
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
                    icon: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
                    en: "Fast WiFi",
                    ar: "واي فاي سريع",
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
              unitName={unit.titleEn}
              priceDaily={unit.dailyPrice}
              priceMonthly={unit.monthlyPrice}
              rentType={unit.rentType}
              locale={locale}
            />
          </div>
        </div>
      </article>
    </div>
  );
}
