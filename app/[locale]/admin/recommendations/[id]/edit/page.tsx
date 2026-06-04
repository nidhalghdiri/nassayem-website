import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import RecommendationForm from "@/components/admin/RecommendationForm";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditRecommendationPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const recommendation = await prisma.recommendation.findUnique({ where: { id } });
  if (!recommendation) return notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href={`/${locale}/admin/recommendations`}
          className="text-sm font-bold text-gray-500 hover:text-nassayem mb-4 inline-flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {isEn ? "Back to Recommendations" : "العودة إلى التوصيات"}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Edit Recommendation" : "تعديل التوصية"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? `Editing "${recommendation.titleEn}".`
            : `تعديل "${recommendation.titleAr}".`}
        </p>
      </div>

      <RecommendationForm locale={locale} initialData={recommendation} />
    </div>
  );
}
