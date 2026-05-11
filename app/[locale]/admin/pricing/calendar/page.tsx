import Link from "next/link";
import prisma from "@/lib/prisma";
import PricingCalendarClient from "@/components/admin/pricing/PricingCalendarClient";
import PeriodPreview from "@/components/admin/pricing/PeriodPreview";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PricingCalendarPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const [buildings, units] = await Promise.all([
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.unit.findMany({
      select: {
        id: true,
        buildingId: true,
        unitType: true,
        unitCode: true,
        titleEn: true,
        titleAr: true,
      },
      orderBy: { titleEn: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <Link
          href={`/${locale}/admin/pricing`}
          className="text-sm font-bold text-gray-500 hover:text-nassayem mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {isEn ? "Back to Pricing" : "العودة إلى التسعير"}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Calendar Editor" : "محرر التقويم"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Inline-edit base prices for a building and unit type. Click any cell to set or clear."
            : "حرّر الأسعار الأساسية لمبنى ونوع وحدة بشكل مباشر. اضغط على أي خلية لتعيين أو مسح السعر."}
        </p>
      </div>

      <PricingCalendarClient locale={locale} buildings={buildings} />

      <PeriodPreview locale={locale} buildings={buildings} units={units} />
    </div>
  );
}
