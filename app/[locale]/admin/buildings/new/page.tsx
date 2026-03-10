import BuildingForm from "@/components/admin/BuildingForm";
import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewBuildingPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb / Header */}
      <div>
        <Link
          href={`/${locale}/admin/buildings`}
          className="text-sm font-bold text-gray-500 hover:text-nassayem mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg
            className="w-4 h-4 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {isEn ? "Back to Buildings" : "العودة إلى المباني"}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Add New Building" : "إضافة مبنى جديد"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Enter the details for the new property location."
            : "أدخل تفاصيل موقع العقار الجديد."}
        </p>
      </div>

      {/* Render the Client Form */}
      <BuildingForm locale={locale} />
    </div>
  );
}
