import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { RECOMMENDATION_CATEGORIES } from "@/lib/recommendations";
import RecommendationRowActions from "@/components/admin/RecommendationRowActions";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminRecommendationsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";
  const dateLocale = isEn ? enUS : ar;

  const recommendations = await prisma.recommendation.findMany({
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
  });

  // Resolve the public URL so we can show it as a copy target for the QR code.
  const reqHeaders = await headers();
  const host = reqHeaders.get("host") ?? "www.nassayem.com";
  const proto =
    reqHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const publicUrl = `${proto}://${host}/${locale}/recommendations`;

  const published = recommendations.filter((r) => r.isPublished).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Recommendations" : "التوصيات"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? `${published} published, ${recommendations.length - published} hidden`
              : `${published} منشور، ${recommendations.length - published} مخفي`}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/recommendations/new`}
          className="inline-flex items-center justify-center gap-2 bg-nassayem text-white px-5 py-2.5 rounded-xl font-bold hover:bg-nassayem-dark transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {isEn ? "New Recommendation" : "توصية جديدة"}
        </Link>
      </div>

      {/* Public URL / QR helper */}
      <div className="bg-nassayem/5 border border-nassayem/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 bg-nassayem text-white rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-nassayem uppercase tracking-wider mb-1">
            {isEn ? "Public URL (QR target)" : "الرابط العام (هدف رمز QR)"}
          </p>
          <p className="text-sm font-mono text-gray-900 break-all">{publicUrl}</p>
          <p className="text-xs text-gray-500 mt-1">
            {isEn
              ? "Paste this URL into any QR generator (qr-code-generator.com, etc.) to print on the brochure."
              : "ألصق هذا الرابط في أي مولّد رموز QR (مثل qr-code-generator.com) لطباعته على البروشور."}
          </p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-white border border-nassayem/30 text-nassayem hover:bg-nassayem hover:text-white transition-colors"
        >
          {isEn ? "Preview" : "معاينة"}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {recommendations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No recommendations yet" : "لا توجد توصيات بعد"}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              {isEn
                ? "Create the first item to start filling the public page."
                : "أنشئ أول عنصر لبدء تعبئة الصفحة العامة."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Item" : "العنصر"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Category" : "التصنيف"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Order" : "الترتيب"}</th>
                    <th className="px-4 py-4 font-semibold text-start">{isEn ? "Updated" : "تاريخ التحديث"}</th>
                    <th className="px-4 py-4 font-semibold text-end">{isEn ? "Actions" : "إجراءات"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recommendations.map((r) => {
                    const cfg = RECOMMENDATION_CATEGORIES[r.category];
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50/50 ${r.isPublished ? "" : "opacity-60"}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                              {r.imageUrl ? (
                                <Image src={r.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                              ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${cfg.accent} opacity-40`} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{isEn ? r.titleEn : r.titleAr}</p>
                              <p className="text-xs text-gray-400 truncate">{isEn ? r.titleAr : r.titleEn}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.tone}`}>
                            {isEn ? cfg.labelEn : cfg.labelAr}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-700">{r.displayOrder}</td>
                        <td className="px-4 py-4 text-xs text-gray-500 whitespace-nowrap">
                          {format(r.updatedAt, "d MMM yyyy", { locale: dateLocale })}
                        </td>
                        <td className="px-4 py-4">
                          <RecommendationRowActions
                            id={r.id}
                            locale={locale}
                            isPublished={r.isPublished}
                            isEn={isEn}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 lg:hidden">
              {recommendations.map((r) => {
                const cfg = RECOMMENDATION_CATEGORIES[r.category];
                return (
                  <div key={r.id} className={`p-4 space-y-3 ${r.isPublished ? "" : "opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {r.imageUrl ? (
                          <Image src={r.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${cfg.accent} opacity-40`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm">{isEn ? r.titleEn : r.titleAr}</p>
                        <p className="text-xs text-gray-400 truncate">{isEn ? r.titleAr : r.titleEn}</p>
                        <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.tone}`}>
                          {isEn ? cfg.labelEn : cfg.labelAr}
                        </span>
                      </div>
                    </div>
                    <RecommendationRowActions
                      id={r.id}
                      locale={locale}
                      isPublished={r.isPublished}
                      isEn={isEn}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
