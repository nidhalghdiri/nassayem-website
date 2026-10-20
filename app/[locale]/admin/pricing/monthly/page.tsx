import Link from "next/link";
import { getMonthlyPricingGrid } from "@/app/actions/monthlyPricing";
import MonthlyPricingClient from "@/components/admin/pricing/MonthlyPricingClient";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function MonthlyPricingPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const grid = await getMonthlyPricingGrid();

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
          {isEn ? "Monthly Pricing" : "التسعير الشهري"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "One monthly rate per building and unit type. Set the \"utilities included\" rate, the \"not included\" rate, or both — guests choose when both exist."
            : "سعر شهري واحد لكل مبنى ونوع وحدة. حدّد السعر الشامل (الماء والكهرباء)، أو غير الشامل، أو كليهما — ويختار الضيف عند توفر الاثنين."}
        </p>
      </div>

      <div className="rounded-2xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-sky-900 leading-relaxed">
        {isEn
          ? "Rules: monthly stays are 30+ nights and never include a night in July or August (monthly runs until 30/06). The total is the monthly rate × nights ÷ 30; online payment collects the first month and the rest is paid at reception."
          : "القواعد: الإقامة الشهرية 30 ليلة فأكثر ولا تشمل أي ليلة في يوليو أو أغسطس (الشهري متاح حتى 30/06). الإجمالي = السعر الشهري × عدد الليالي ÷ 30؛ ويُحصّل الشهر الأول عند الدفع الإلكتروني والباقي عند الاستقبال."}
      </div>

      <MonthlyPricingClient locale={locale} grid={grid} />
    </div>
  );
}
