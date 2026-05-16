import Link from "next/link";
import prisma from "@/lib/prisma";
import PeriodPricingClient from "@/components/admin/pricing/PeriodPricingClient";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PeriodPricingPage({ params }: PageProps) {
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
          {isEn ? "Period Pricing" : "التسعير حسب المدة"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Apply a single daily price to every day in a date range, for a specific building and unit type."
            : "طبّق سعراً يومياً واحداً لكل يوم ضمن مدة معينة، لمبنى ونوع وحدة محددين."}
        </p>
      </div>

      <PeriodPricingClient locale={locale} buildings={buildings} />
    </div>
  );
}
