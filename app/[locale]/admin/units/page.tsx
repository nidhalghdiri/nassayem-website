import Link from "next/link";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
};

const unitTypeLabel = (type: string, isEn: boolean) => {
  const map: Record<string, { en: string; ar: string }> = {
    STUDIO: { en: "Studio", ar: "استوديو" },
    ONE_BEDROOM: { en: "1 Bedroom", ar: "غرفة وصالة" },
    TWO_BEDROOM: { en: "2 Bedrooms", ar: "غرفتين وصالة" },
    THREE_BEDROOM: { en: "3 Bedrooms", ar: "ثلاث غرف وصالة" },
    VILLA: { en: "Villa", ar: "فيلا" },
  };
  return isEn ? map[type]?.en : map[type]?.ar;
};

const rentTypeLabel = (type: string, isEn: boolean) => {
  const map: Record<string, { en: string; ar: string }> = {
    DAILY: { en: "Daily", ar: "يومي" },
    MONTHLY: { en: "Monthly", ar: "شهري" },
    BOTH: { en: "Daily & Monthly", ar: "يومي وشهري" },
  };
  return isEn ? map[type]?.en : map[type]?.ar;
};

export default async function UnitsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const units = await prisma.unit.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      building: { select: { nameEn: true, nameAr: true } },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Units" : "الوحدات"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? `${units.length} ${units.length === 1 ? "unit" : "units"} total`
              : `${units.length} وحدة إجمالاً`}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/units/new`}
          className="w-full sm:w-auto text-center bg-nassayem text-white hover:bg-nassayem-dark px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {isEn ? "Add Unit" : "إضافة وحدة"}
        </Link>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No units yet" : "لا توجد وحدات بعد"}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs mb-6">
              {isEn
                ? "Start adding apartments or villas to your buildings."
                : "ابدأ بإضافة شقق أو فيلات لمبانيك."}
            </p>
            <Link
              href={`/${locale}/admin/units/new`}
              className="bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white px-5 py-2.5 rounded-xl font-semibold transition-all text-sm"
            >
              {isEn ? "Add First Unit" : "إضافة أول وحدة"}
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Unit" : "الوحدة"}</th>
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Building" : "المبنى"}</th>
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Type" : "النوع"}</th>
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Pricing" : "السعر"}</th>
                    <th className="px-6 py-4 font-semibold text-center">{isEn ? "Status" : "الحالة"}</th>
                    <th className="px-6 py-4 font-semibold text-end">{isEn ? "Actions" : "الإجراءات"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {unit.unitCode && (
                            <span className="shrink-0 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-gray-200">
                              {unit.unitCode}
                            </span>
                          )}
                          <div className="font-bold text-gray-900 text-sm truncate max-w-[150px]">
                            {isEn ? unit.titleEn : unit.titleAr}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 pl-1">
                          {unit.bedrooms} {isEn ? "bed" : "غرفة"} · {unit.bathrooms} {isEn ? "bath" : "حمام"} · {unit.guests} {isEn ? "guests" : "ضيف"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {isEn ? unit.building.nameEn : unit.building.nameAr}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-800">
                          {unitTypeLabel(unit.unitType, isEn)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {rentTypeLabel(unit.rentType, isEn)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {unit.dailyPrice && (
                          <div className="text-sm">
                            <span className="font-bold text-nassayem">{unit.dailyPrice}</span>
                            <span className="text-xs text-gray-400 ml-1">{isEn ? "OMR/day" : "ر.ع/يوم"}</span>
                          </div>
                        )}
                        {unit.monthlyPrice && (
                          <div className="text-sm">
                            <span className="font-bold text-nassayem">{unit.monthlyPrice}</span>
                            <span className="text-xs text-gray-400 ml-1">{isEn ? "OMR/mo" : "ر.ع/شهر"}</span>
                          </div>
                        )}
                        {!unit.dailyPrice && !unit.monthlyPrice && (
                          <span className="text-xs text-gray-400 italic">{isEn ? "Not set" : "غير محدد"}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${unit.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {unit.isPublished ? (isEn ? "Published" : "منشور") : (isEn ? "Draft" : "مسودة")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/${locale}/admin/units/${unit.id}/images`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                            title={isEn ? "Images" : "الصور"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {isEn ? "Images" : "صور"}
                          </Link>
                          <Link
                            href={`/${locale}/admin/units/${unit.id}/edit`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {isEn ? "Edit" : "تعديل"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-gray-100 md:hidden">
              {units.map((unit) => (
                <div key={unit.id} className="p-4 space-y-3">
                  {/* Title + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {unit.unitCode && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-mono font-bold border border-gray-200 uppercase">
                            {unit.unitCode}
                          </span>
                        )}
                        <p className="font-bold text-gray-900 text-sm truncate">
                          {isEn ? unit.titleEn : unit.titleAr}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {isEn ? unit.building.nameEn : unit.building.nameAr}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${unit.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {unit.isPublished ? (isEn ? "Published" : "منشور") : (isEn ? "Draft" : "مسودة")}
                    </span>
                  </div>

                  {/* Type + pricing row */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{unitTypeLabel(unit.unitType, isEn)} · {rentTypeLabel(unit.rentType, isEn)}</span>
                    <span className="font-bold text-nassayem">
                      {unit.dailyPrice ? `${unit.dailyPrice} ${isEn ? "OMR/d" : "ر.ع/ي"}` : ""}
                      {unit.dailyPrice && unit.monthlyPrice ? " · " : ""}
                      {unit.monthlyPrice ? `${unit.monthlyPrice} ${isEn ? "OMR/mo" : "ر.ع/ش"}` : ""}
                      {!unit.dailyPrice && !unit.monthlyPrice ? (isEn ? "No price" : "بدون سعر") : ""}
                    </span>
                  </div>

                  {/* Specs + actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {unit.bedrooms}b · {unit.bathrooms}ba · {unit.guests} {isEn ? "guests" : "ضيف"}
                    </span>
                    <div className="flex gap-2">
                      <Link
                        href={`/${locale}/admin/units/${unit.id}/images`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isEn ? "Photos" : "صور"}
                      </Link>
                      <Link
                        href={`/${locale}/admin/units/${unit.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {isEn ? "Edit" : "تعديل"}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
