import Link from "next/link";
import { Metadata } from "next";
import FilterSidebar from "@/components/properties/FilterSidebar";
import PropertyCard from "@/components/properties/PropertyCard";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return {
    title: isEn
      ? "Furnished Apartments & Vacation Rentals in Salalah | Nassayem"
      : "شقق مفروشة وإيجار قصير في صلالة | نسائم صلالة",
    description: isEn
      ? "Browse premium furnished apartments, studios, and villas in Salalah, Dhofar. Daily and monthly rates. Book your stay with Nassayem Salalah."
      : "تصفح شققنا المفروشة الفاخرة والاستوديوهات والفلل في صلالة، ظفار. أسعار يومية وشهرية. احجز إقامتك مع نسائم صلالة.",
    alternates: {
      canonical: `https://www.nassayem.com/${locale}/properties`,
      languages: {
        en: "https://www.nassayem.com/en/properties",
        ar: "https://www.nassayem.com/ar/properties",
      },
    },
    openGraph: {
      title: isEn ? "Furnished Apartments in Salalah | Nassayem" : "شقق مفروشة في صلالة | نسائم",
      description: isEn
        ? "Premium furnished apartments and vacation rentals in Salalah, Oman."
        : "شقق مفروشة فاخرة وإيجارات قصيرة في صلالة، عُمان.",
      images: [{ url: "https://www.nassayem.com/og-properties.jpg", width: 1200, height: 630 }],
    },
  };
}

export default async function PropertiesPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const isEn = locale === "en";

  const rentTypeFilter =
    resolvedSearchParams.type === "monthly"
      ? "MONTHLY"
      : resolvedSearchParams.type === "daily"
        ? "DAILY"
        : undefined;

  const unitTypeMap: { [key: string]: any } = {
    studio: "STUDIO",
    "1br": "ONE_BEDROOM",
    "2br": "TWO_BEDROOM",
    villa: "VILLA",
  };
  const unitTypeFilter = resolvedSearchParams.unitType
    ? unitTypeMap[resolvedSearchParams.unitType]
    : undefined;

  // Fetch properties dynamically based on filters
  const units = await prisma.unit.findMany({
    where: {
      isPublished: true,
      ...(rentTypeFilter && {
        OR: [{ rentType: rentTypeFilter }, { rentType: "BOTH" }],
      }),
      ...(unitTypeFilter && { unitType: unitTypeFilter }),
    },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      building: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const locationQuery =
    resolvedSearchParams.location || (isEn ? "Salalah" : "صلالة");

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-gray-200 pb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isEn
              ? `Stays in ${locationQuery}`
              : `أماكن الإقامة في ${locationQuery}`}
          </h1>
          <p className="text-gray-500">
            {isEn
              ? `${units.length} premium units matching your preferences.`
              : `${units.length} وحدة فاخرة تطابق تفضيلاتك.`}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="hidden lg:block w-full lg:w-1/4">
            <FilterSidebar locale={locale} />
          </aside>

          <main className="w-full lg:w-3/4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {units.length > 0 ? (
                units.map((unit) => (
                  <PropertyCard key={unit.id} unit={unit} locale={locale} />
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-gray-100">
                  <p className="text-gray-500 font-medium">
                    {isEn
                      ? "No properties match your exact filters. Try clearing them."
                      : "لا توجد عقارات تطابق عوامل التصفية بدقة. حاول مسحها."}
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
