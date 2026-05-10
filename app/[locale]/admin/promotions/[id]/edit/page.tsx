import PromotionForm from "@/components/admin/PromotionForm";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const [promotion, buildings] = await Promise.all([
    prisma.promotion.findUnique({
      where: { id },
      include: { rows: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.building.findMany({
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameAr: true },
    }),
  ]);

  if (!promotion) return notFound();

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
          {isEn ? "Edit Promotion" : "تعديل العرض"}
        </h1>
      </div>

      <PromotionForm
        locale={locale}
        buildings={buildings}
        initialData={promotion}
      />
    </div>
  );
}
