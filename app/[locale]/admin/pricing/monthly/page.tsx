import Link from "next/link";
import prisma from "@/lib/prisma";
import MonthlyPricingClient from "@/components/admin/pricing/MonthlyPricingClient";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function MonthlyPricingPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const buildings = await prisma.building.findMany({
    select: { id: true, nameEn: true, nameAr: true },
    orderBy: { nameEn: "asc" },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
          {isEn ? "Monthly Pricing (Bulk Edit)" : "التسعير الشهري (تعديل جماعي)"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Set a Monthly Price for all units of a specific type in a building at once."
            : "قم بتعيين سعر شهري لجميع الوحدات من نوع معين في المبنى دفعة واحدة."}
        </p>
      </div>

      <MonthlyPricingClient locale={locale} buildings={buildings} />
    </div>
  );
}
