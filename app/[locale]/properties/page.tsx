import { Metadata } from "next";
import FilterSidebar from "@/components/properties/FilterSidebar";
import PropertyCard from "@/components/properties/PropertyCard";
import prisma from "@/lib/prisma";
import { calculateBookingPrice } from "@/app/actions/booking";

// Price computed for a single unit against the selected stay. `null` when the
// dates can't be priced for that unit (e.g. Khareef without a promo, or a
// monthly-only unit with a short range) — the card falls back to "Show Price".
type CardPrice = {
  dailyAverage: number;
  grandTotal: number;
  totalNights: number;
  hasPromotion: boolean;
};

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
    "3br": "THREE_BEDROOM",
    villa: "VILLA",
  };
  const unitTypeFilter = resolvedSearchParams.unitType
    ? unitTypeMap[resolvedSearchParams.unitType]
    : undefined;

  // Stay dates carried over from the home-page search (or the sidebar). Both
  // must be present and valid (YYYY-MM-DD, check-out after check-in) before we
  // attempt to price each card.
  const checkIn = resolvedSearchParams.checkIn || "";
  const checkOut = resolvedSearchParams.checkOut || "";
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasValidDates =
    datePattern.test(checkIn) &&
    datePattern.test(checkOut) &&
    checkOut > checkIn;

  // Sidebar price-range filter. Applied against the unit's base rate for the
  // active rental mode (monthlyPrice when browsing monthly, dailyPrice otherwise).
  const minPrice = resolvedSearchParams.min
    ? parseFloat(resolvedSearchParams.min)
    : undefined;
  const maxPrice = resolvedSearchParams.max
    ? parseFloat(resolvedSearchParams.max)
    : undefined;
  const priceField = rentTypeFilter === "MONTHLY" ? "monthlyPrice" : "dailyPrice";
  const priceRangeFilter =
    (minPrice !== undefined && !isNaN(minPrice)) ||
    (maxPrice !== undefined && !isNaN(maxPrice))
      ? {
          [priceField]: {
            ...(minPrice !== undefined && !isNaN(minPrice) && { gte: minPrice }),
            ...(maxPrice !== undefined && !isNaN(maxPrice) && { lte: maxPrice }),
          },
        }
      : undefined;

  // Fetch properties dynamically based on filters
  const units = await prisma.unit.findMany({
    where: {
      isPublished: true,
      ...(rentTypeFilter && {
        OR: [{ rentType: rentTypeFilter }, { rentType: "BOTH" }],
      }),
      ...(unitTypeFilter && { unitType: unitTypeFilter }),
      ...priceRangeFilter,
    },
    include: {
      images: { orderBy: { displayOrder: "asc" } },
      building: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // When the visitor picked dates, price every unit for that exact stay so the
  // card shows a real number instead of a generic "Show Price". Pricing runs
  // through the same engine used on the details page (promo > per-day module >
  // base rate), so the listing and the booking widget always agree. Units that
  // can't be priced for the range (Khareef-without-promo, monthly-only units on
  // a short range, etc.) resolve to null and keep the "Show Price" button.
  const priceMap: Record<string, CardPrice> = {};
  if (hasValidDates) {
    const priced = await Promise.all(
      units.map(async (unit) => {
        try {
          const p = await calculateBookingPrice(unit.id, checkIn, checkOut);
          return [
            unit.id,
            {
              dailyAverage: p.dailyAverage,
              grandTotal: p.grandTotal,
              totalNights: p.totalNights,
              hasPromotion: !!p.promotion,
            } as CardPrice,
          ] as const;
        } catch {
          return [unit.id, null] as const;
        }
      }),
    );
    for (const [id, price] of priced) {
      if (price) priceMap[id] = price;
    }
  }

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
                  <PropertyCard
                    key={unit.id}
                    unit={unit}
                    locale={locale}
                    checkIn={hasValidDates ? checkIn : undefined}
                    checkOut={hasValidDates ? checkOut : undefined}
                    price={priceMap[unit.id] ?? null}
                  />
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
