import Link from "next/link";
import prisma from "@/lib/prisma";
import DeletePromotionButton from "@/components/admin/DeletePromotionButton";

type PageProps = {
  params: Promise<{ locale: string }>;
};

function formatDate(d: Date, isEn: boolean) {
  return new Date(d).toLocaleDateString(isEn ? "en-GB" : "ar-OM");
}

export default async function PromotionsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const promotions = await prisma.promotion.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { rows: true } } },
  });

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Promotions" : "العروض"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? `${promotions.length} ${promotions.length === 1 ? "promotion" : "promotions"} total`
              : `${promotions.length} عرض إجمالاً`}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/promotions/new`}
          className="w-full sm:w-auto text-center bg-nassayem text-white hover:bg-nassayem-dark px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {isEn ? "Add Promotion" : "إضافة عرض"}
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {promotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No promotions yet" : "لا توجد عروض بعد"}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs mb-6">
              {isEn ? "Create your first promotion to display on the home page." : "أنشئ أول عرض ليُعرض على الصفحة الرئيسية."}
            </p>
            <Link
              href={`/${locale}/admin/promotions/new`}
              className="bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white px-5 py-2.5 rounded-xl font-semibold transition-all text-sm"
            >
              {isEn ? "Add First Promotion" : "إضافة أول عرض"}
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Title" : "العنوان"}</th>
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Period" : "الفترة"}</th>
                    <th className="px-6 py-4 font-semibold text-center">{isEn ? "Conditions" : "الشروط"}</th>
                    <th className="px-6 py-4 font-semibold text-center">{isEn ? "Status" : "الحالة"}</th>
                    <th className="px-6 py-4 font-semibold text-end">{isEn ? "Actions" : "الإجراءات"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {promotions.map((p) => {
                    const isLive = p.isActive && p.startDate <= now && p.endDate >= now;
                    const isUpcoming = p.isActive && p.startDate > now;
                    const isExpired = p.endDate < now;

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 text-sm">
                            {isEn ? p.titleEn : p.titleAr}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            #{p.id.split("-")[0].toUpperCase()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(p.startDate, isEn)} → {formatDate(p.endDate, isEn)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                            {p._count.rows}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {!p.isActive ? (
                            <span className="inline-flex bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                              {isEn ? "Disabled" : "موقوف"}
                            </span>
                          ) : isLive ? (
                            <span className="inline-flex bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                              {isEn ? "Live" : "نشط"}
                            </span>
                          ) : isUpcoming ? (
                            <span className="inline-flex bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">
                              {isEn ? "Upcoming" : "قادم"}
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">
                              {isEn ? "Expired" : "منتهي"}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-end">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/${locale}/admin/promotions/${p.id}/edit`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              {isEn ? "Edit" : "تعديل"}
                            </Link>
                            <DeletePromotionButton id={p.id} locale={locale} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {promotions.map((p) => {
                const isLive = p.isActive && p.startDate <= now && p.endDate >= now;
                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">
                          {isEn ? p.titleEn : p.titleAr}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(p.startDate, isEn)} → {formatDate(p.endDate, isEn)}
                        </p>
                      </div>
                      {isLive && (
                        <span className="shrink-0 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold">
                          {isEn ? "Live" : "نشط"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        {p._count.rows} {isEn ? "rows" : "شروط"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${locale}/admin/promotions/${p.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          {isEn ? "Edit" : "تعديل"}
                        </Link>
                        <DeletePromotionButton id={p.id} locale={locale} />
                      </div>
                    </div>
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
