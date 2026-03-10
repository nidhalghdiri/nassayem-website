import Link from "next/link";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function BuildingsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Fetch buildings from the database, including the count of associated units
  const buildings = await prisma.building.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { units: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Buildings Management" : "إدارة المباني"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEn
              ? "Manage your properties and locations."
              : "إدارة عقاراتك ومواقعك."}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/buildings/new`}
          className="bg-nassayem text-white hover:bg-nassayem-dark px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all text-sm flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          {isEn ? "Add New Building" : "إضافة مبنى جديد"}
        </Link>
      </div>

      {/* Buildings Table / Empty State */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {buildings.length === 0 ? (
          // Empty State UI
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {isEn ? "No buildings found" : "لم يتم العثور على مباني"}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              {isEn
                ? "Get started by adding your first property to the Nassayem portfolio."
                : "ابدأ بإضافة عقارك الأول إلى محفظة نسائم."}
            </p>
            <Link
              href={`/${locale}/admin/buildings/new`}
              className="bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white px-6 py-2.5 rounded-xl font-bold transition-all"
            >
              {isEn ? "Add First Building" : "إضافة أول مبنى"}
            </Link>
          </div>
        ) : (
          // Data Table
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Building Name" : "اسم المبنى"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Location" : "الموقع"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-center">
                    {isEn ? "Total Units" : "إجمالي الوحدات"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Added On" : "تاريخ الإضافة"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-end">
                    {isEn ? "Actions" : "الإجراءات"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {buildings.map((building) => (
                  <tr
                    key={building.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Building Name */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">
                        {isEn ? building.nameEn : building.nameAr}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">
                        ID: {building.id.split("-")[0]}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2 mt-1">
                      <svg
                        className="w-4 h-4 text-gray-400 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {isEn ? building.locationEn : building.locationAr}
                    </td>

                    {/* Total Units Count (Fetched natively via Prisma relations) */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                        {building._count.units} {isEn ? "Units" : "وحدات"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(building.createdAt).toLocaleDateString(
                        isEn ? "en-US" : "ar-OM",
                      )}
                    </td>

                    {/* Actions (Edit / Delete) */}
                    <td className="px-6 py-4 text-end space-x-2 space-x-reverse">
                      <Link
                        href={`/${locale}/admin/buildings/${building.id}/edit`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title={isEn ? "Edit" : "تعديل"}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </Link>
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title={isEn ? "Delete" : "حذف"}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
