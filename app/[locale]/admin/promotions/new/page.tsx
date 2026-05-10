import PromotionForm from "@/components/admin/PromotionForm";
import prisma from "@/lib/prisma";
import Link from "next/link";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewPromotionPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const buildings = await prisma.building.findMany({
    orderBy: { nameEn: "asc" },
    select: { id: true, nameEn: true, nameAr: true },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href={`/${locale}/admin/promotions`}
          className="text-sm font-bold text-gray-500 hover:text-nassayem mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {isEn ? "Back to Promotions" : "العودة إلى العروض"}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Add New Promotion" : "إضافة عرض جديد"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Define the period, image, and condition rows for this promotion."
            : "حدد الفترة والصورة وصفوف الشروط لهذا العرض."}
        </p>
      </div>

      <PromotionForm locale={locale} buildings={buildings} />
    </div>
  );
}
