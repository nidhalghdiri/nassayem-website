import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PricingIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const cards = [
    {
      href: `/${locale}/admin/pricing/import`,
      titleEn: "Bulk Import",
      titleAr: "استيراد جماعي",
      descEn: "Upload a CSV of Building, Unit Type, Date, Daily Price.",
      descAr: "حمّل ملف CSV يحتوي المبنى ونوع الوحدة والتاريخ والسعر اليومي.",
      icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12",
      tone: "bg-blue-50 text-blue-700",
    },
    {
      href: `/${locale}/admin/pricing/calendar`,
      titleEn: "Calendar (Grid Editor)",
      titleAr: "التقويم (محرر شبكي)",
      descEn: "Edit daily prices for a building and unit type, month by month.",
      descAr: "حرّر الأسعار اليومية لمبنى ونوع وحدة، شهرًا بشهر.",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      href: `/${locale}/admin/pricing/period`,
      titleEn: "Period Pricing",
      titleAr: "التسعير حسب المدة",
      descEn: "Set one daily price for every day in a date range, per building + unit type.",
      descAr: "حدّد سعراً يومياً واحداً لكل يوم ضمن مدة، حسب المبنى ونوع الوحدة.",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM9 16h6",
      tone: "bg-purple-50 text-purple-700",
    },
    {
      href: `/${locale}/admin/pricing/overrides`,
      titleEn: "Per-Unit Overrides",
      titleAr: "استثناءات الوحدات",
      descEn: "Override the base price for a specific unit on specific dates.",
      descAr: "استثنِ السعر الأساسي لوحدة محددة في تواريخ محددة.",
      icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z",
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Pricing" : "التسعير"}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isEn
            ? "Manage base daily prices per unit type and per-unit overrides."
            : "إدارة الأسعار اليومية الأساسية حسب نوع الوحدة والاستثناءات لكل وحدة."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${card.tone}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={card.icon} />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {isEn ? card.titleEn : card.titleAr}
            </h3>
            <p className="text-sm text-gray-500">
              {isEn ? card.descEn : card.descAr}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
