import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

const UNIT_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  STUDIO: { en: "Studio", ar: "استوديو" },
  ONE_BEDROOM: { en: "1 Bedroom", ar: "غرفة وصالة" },
  TWO_BEDROOM: { en: "2 Bedrooms", ar: "غرفتين وصالة" },
  THREE_BEDROOM: { en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
  VILLA: { en: "Villa", ar: "فيلا" },
};

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const isEn = locale === "en";
  const promotion = await prisma.promotion.findUnique({ where: { id } });
  if (!promotion) return { title: "Not found" };
  const title = isEn ? promotion.titleEn : promotion.titleAr;
  const description = isEn
    ? promotion.descriptionEn ?? "Special promotion at Nassayem Salalah"
    : promotion.descriptionAr ?? "عرض خاص من نسائم صلالة";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: promotion.imageUrl ? [{ url: promotion.imageUrl }] : undefined,
    },
  };
}

function formatDate(d: Date, isEn: boolean) {
  return new Date(d).toLocaleDateString(isEn ? "en-GB" : "ar-OM", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function PromotionDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const promotion = await prisma.promotion.findUnique({
    where: { id },
    include: {
      rows: {
        include: { building: { select: { nameEn: true, nameAr: true } } },
        orderBy: { promoPrice: "asc" },
      },
    },
  });

  if (!promotion) return notFound();

  const now = new Date();
  const isLive = promotion.isActive && promotion.startDate <= now && promotion.endDate >= now;
  const isUpcoming = promotion.isActive && promotion.startDate > now;
  const isExpired = promotion.endDate < now;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero image */}
      <div className="relative w-full aspect-[16/7] min-h-[260px] max-h-[520px] overflow-hidden bg-gray-200">
        {promotion.imageUrl ? (
          <Image
            src={promotion.imageUrl}
            alt={isEn ? promotion.titleEn : promotion.titleAr}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2a7475] to-[#1d5455]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-10 max-w-6xl mx-auto">
          <Link
            href={`/${locale}`}
            className="text-white/90 hover:text-white text-sm font-bold inline-flex items-center gap-1 mb-3 transition-colors"
          >
            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            {isEn ? "Back to home" : "العودة للرئيسية"}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-white/95 text-[#2a7475] px-3 py-1.5 rounded-full text-xs font-bold">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
              </svg>
              {isEn ? "Promotion" : "عرض"}
            </span>
            {isLive && (
              <span className="bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                {isEn ? "Live now" : "نشط الآن"}
              </span>
            )}
            {isUpcoming && (
              <span className="bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-full text-xs font-bold">
                {isEn ? "Coming soon" : "قريبًا"}
              </span>
            )}
            {isExpired && (
              <span className="bg-gray-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                {isEn ? "Ended" : "منتهي"}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight">
            {isEn ? promotion.titleEn : promotion.titleAr}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Period */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <h2 className="text-xs font-bold text-[#2a7475] tracking-widest uppercase mb-3">
              {isEn ? "Promotion Period" : "فترة العرض"}
            </h2>
            <p className="text-lg sm:text-xl font-bold text-gray-900">
              {formatDate(promotion.startDate, isEn)} → {formatDate(promotion.endDate, isEn)}
            </p>
          </div>

          {/* Description */}
          {(isEn ? promotion.descriptionEn : promotion.descriptionAr) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {isEn ? "About this offer" : "عن هذا العرض"}
              </h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {isEn ? promotion.descriptionEn : promotion.descriptionAr}
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="bg-gradient-to-br from-[#2a7475] to-[#1d5455] text-white rounded-2xl p-6 sm:p-8 shadow-lg">
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              {isEn ? "Ready to book?" : "جاهز للحجز؟"}
            </h3>
            <p className="text-white/85 mb-5 text-sm sm:text-base">
              {isEn
                ? "Browse our properties and the promotion will be applied automatically when your dates fall within the period."
                : "تصفح وحداتنا وسيتم تطبيق العرض تلقائيًا عندما تقع تواريخ إقامتك ضمن الفترة."}
            </p>
            <Link
              href={`/${locale}/properties`}
              className="inline-flex items-center gap-2 bg-white text-[#1d5455] px-5 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              {isEn ? "Browse Properties" : "تصفح الوحدات"}
              <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Pricing rows */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {isEn ? "Promotion prices" : "أسعار العرض"}
            </h2>
            <div className="space-y-3">
              {promotion.rows.map((row) => {
                const buildingLabel = row.building
                  ? isEn ? row.building.nameEn : row.building.nameAr
                  : isEn ? "All buildings" : "جميع المباني";
                const typeLabel = row.unitType
                  ? UNIT_TYPE_LABELS[row.unitType][isEn ? "en" : "ar"]
                  : isEn ? "All types" : "جميع الأنواع";
                const savings = Math.max(0, row.regularPrice - row.promoPrice);

                return (
                  <div
                    key={row.id}
                    className="border border-gray-100 rounded-xl p-4 bg-gray-50/40"
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 font-medium">
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded">
                        {buildingLabel}
                      </span>
                      <span>·</span>
                      <span className="bg-white border border-gray-200 px-2 py-0.5 rounded">
                        {typeLabel}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-extrabold text-[#2a7475]">
                        {row.promoPrice}
                      </span>
                      <span className="text-xs font-bold text-gray-500">
                        {isEn ? "OMR / night" : "ر.ع / ليلة"}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      <span className="line-through">
                        {row.regularPrice} {isEn ? "OMR" : "ر.ع"}
                      </span>
                      {savings > 0 && (
                        <span className="ms-2 text-green-600 font-bold">
                          {isEn ? `Save ${savings} OMR` : `وفر ${savings} ر.ع`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
