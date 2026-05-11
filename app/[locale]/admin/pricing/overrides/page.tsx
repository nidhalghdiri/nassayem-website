import Link from "next/link";
import prisma from "@/lib/prisma";
import PricingOverridesClient from "@/components/admin/pricing/PricingOverridesClient";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ buildingId?: string; unitId?: string; date?: string }>;
};

export default async function PricingOverridesPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
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
          {isEn ? "Per-Unit Overrides" : "استثناءات الوحدات"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Override the base type price for a specific unit on specific dates. Leave a row empty to remove the override."
            : "استثنِ السعر الأساسي لنوع الوحدة في تواريخ محددة. اترك الصف فارغًا لإزالة الاستثناء."}
        </p>
      </div>

      <PricingOverridesClient
        locale={locale}
        buildings={buildings}
        units={units}
        initial={{
          buildingId: sp.buildingId,
          unitId: sp.unitId,
          focusDate: sp.date,
        }}
      />
    </div>
  );
}
