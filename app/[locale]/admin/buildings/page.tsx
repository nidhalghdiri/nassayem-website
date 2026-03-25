import Link from "next/link";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function BuildingsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const buildings = await prisma.building.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { units: true } },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Buildings" : "المباني"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? `${buildings.length} ${buildings.length === 1 ? "property" : "properties"} total`
              : `${buildings.length} عقار إجمالاً`}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/buildings/new`}
          className="w-full sm:w-auto text-center bg-nassayem text-white hover:bg-nassayem-dark px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {isEn ? "Add Building" : "إضافة مبنى"}
        </Link>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {buildings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {isEn ? "No buildings yet" : "لا توجد مباني بعد"}
            </h3>
            <p className="text-gray-500 text-sm max-w-xs mb-6">
              {isEn
                ? "Add your first property to get started."
                : "أضف عقارك الأول للبدء."}
            </p>
            <Link
              href={`/${locale}/admin/buildings/new`}
              className="bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white px-5 py-2.5 rounded-xl font-semibold transition-all text-sm"
            >
              {isEn ? "Add First Building" : "إضافة أول مبنى"}
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Building" : "المبنى"}</th>
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Location" : "الموقع"}</th>
                    <th className="px-6 py-4 font-semibold text-center">{isEn ? "Units" : "الوحدات"}</th>
                    <th className="px-6 py-4 font-semibold text-start">{isEn ? "Added" : "تاريخ الإضافة"}</th>
                    <th className="px-6 py-4 font-semibold text-end">{isEn ? "Actions" : "الإجراءات"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {buildings.map((building) => (
                    <tr key={building.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-sm">
                          {isEn ? building.nameEn : building.nameAr}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          #{building.id.split("-")[0].toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {isEn ? building.locationEn : building.locationAr}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                          {building._count.units}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(building.createdAt).toLocaleDateString(isEn ? "en-US" : "ar-OM")}
                      </td>
                      <td className="px-6 py-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/${locale}/admin/buildings/${building.id}/edit`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
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
              {buildings.map((building) => (
                <div key={building.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {isEn ? building.nameEn : building.nameAr}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {isEn ? building.locationEn : building.locationAr}
                      </div>
                    </div>
                    <span className="shrink-0 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold">
                      {building._count.units} {isEn ? "units" : "وحدة"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {new Date(building.createdAt).toLocaleDateString(isEn ? "en-US" : "ar-OM")}
                    </span>
                    <Link
                      href={`/${locale}/admin/buildings/${building.id}/edit`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {isEn ? "Edit" : "تعديل"}
                    </Link>
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
