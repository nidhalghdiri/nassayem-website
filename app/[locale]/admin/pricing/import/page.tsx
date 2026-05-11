import Link from "next/link";
import prisma from "@/lib/prisma";
import PricingImportClient from "@/components/admin/pricing/PricingImportClient";
import PeriodPreview from "@/components/admin/pricing/PeriodPreview";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PricingImportPage({ params }: PageProps) {
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
    <div className="space-y-6 max-w-5xl mx-auto">
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
          {isEn ? "Bulk Import Pricing" : "استيراد الأسعار جماعيًا"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Upload a CSV file with the columns: Building, Unit Type, Date, Daily Price."
            : "حمّل ملف CSV يحتوي على الأعمدة: المبنى، نوع الوحدة، التاريخ، السعر اليومي."}
        </p>
      </div>

      <PricingImportClient locale={locale} buildings={buildings} />

      <PeriodPreview locale={locale} buildings={buildings} units={units} />
    </div>
  );
}
