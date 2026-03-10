import Link from "next/link";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
};

// Helper function to format enum values for display
const formatUnitType = (type: string, isEn: boolean) => {
  const typesEn: Record<string, string> = {
    STUDIO: "Studio",
    ONE_BEDROOM: "1 Bedroom",
    TWO_BEDROOM: "2 Bedrooms",
    VILLA: "Villa",
  };
  const typesAr: Record<string, string> = {
    STUDIO: "استوديو",
    ONE_BEDROOM: "غرفة وصالة",
    TWO_BEDROOM: "غرفتين وصالة",
    VILLA: "فيلا",
  };
  return isEn ? typesEn[type] : typesAr[type];
};

const formatRentType = (type: string, isEn: boolean) => {
  const typesEn: Record<string, string> = {
    DAILY: "Daily",
    MONTHLY: "Monthly",
    BOTH: "Daily & Monthly",
  };
  const typesAr: Record<string, string> = {
    DAILY: "يومي",
    MONTHLY: "شهري",
    BOTH: "يومي وشهري",
  };
  return isEn ? typesEn[type] : typesAr[type];
};

export default async function UnitsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Fetch units and include the connected building name
  const units = await prisma.unit.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      building: {
        select: {
          nameEn: true,
          nameAr: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Units Management" : "إدارة الوحدات"}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEn
              ? "Manage apartments, pricing, and availability."
              : "إدارة الشقق، الأسعار، والتوافر."}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/units/new`}
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
          {isEn ? "Add New Unit" : "إضافة وحدة جديدة"}
        </Link>
      </div>

      {/* Units Table / Empty State */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {units.length === 0 ? (
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {isEn ? "No units found" : "لم يتم العثور على وحدات"}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              {isEn
                ? "Start adding apartments or villas to your buildings."
                : "ابدأ بإضافة الشقق أو الفيلات إلى مبانيك."}
            </p>
            <Link
              href={`/${locale}/admin/units/new`}
              className="bg-nassayem/10 text-nassayem hover:bg-nassayem hover:text-white px-6 py-2.5 rounded-xl font-bold transition-all"
            >
              {isEn ? "Add First Unit" : "إضافة أول وحدة"}
            </Link>
          </div>
        ) : (
          // Data Table
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Unit Details" : "تفاصيل الوحدة"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Building" : "المبنى"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Type & Rent" : "النوع والإيجار"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-start">
                    {isEn ? "Pricing" : "التسعير"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-center">
                    {isEn ? "Status" : "الحالة"}
                  </th>
                  <th className="px-6 py-4 font-semibold text-end">
                    {isEn ? "Actions" : "الإجراءات"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {units.map((unit) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Unit Title */}
                    <td className="px-6 py-4 text-start">
                      <div className="font-bold text-gray-900">
                        {isEn ? unit.titleEn : unit.titleAr}
                      </div>
                      <div className="text-xs text-gray-500 font-medium flex gap-2 mt-1">
                        <span>
                          {unit.bedrooms} {isEn ? "Beds" : "غرف"}
                        </span>{" "}
                        •
                        <span>
                          {unit.bathrooms} {isEn ? "Baths" : "حمامات"}
                        </span>
                      </div>
                    </td>

                    {/* Building Name */}
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {isEn ? unit.building.nameEn : unit.building.nameAr}
                    </td>

                    {/* Type & Rent */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-800">
                        {formatUnitType(unit.unitType, isEn)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatRentType(unit.rentType, isEn)}
                      </div>
                    </td>

                    {/* Pricing */}
                    <td className="px-6 py-4">
                      {unit.dailyPrice && (
                        <div className="text-sm">
                          <span className="font-bold text-nassayem">
                            {unit.dailyPrice}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            {isEn ? "OMR/day" : "ر.ع/يوم"}
                          </span>
                        </div>
                      )}
                      {unit.monthlyPrice && (
                        <div className="text-sm">
                          <span className="font-bold text-nassayem">
                            {unit.monthlyPrice}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            {isEn ? "OMR/mo" : "ر.ع/شهر"}
                          </span>
                        </div>
                      )}
                      {!unit.dailyPrice && !unit.monthlyPrice && (
                        <span className="text-xs text-gray-400 italic">
                          {isEn ? "Not set" : "غير محدد"}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold ${
                          unit.isPublished
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {unit.isPublished
                          ? isEn
                            ? "Published"
                            : "منشور"
                          : isEn
                            ? "Draft"
                            : "مسودة"}
                      </span>
                    </td>

                    {/* Actions (Images / Edit / Delete) */}
                    <td className="px-6 py-4 text-end space-x-2 space-x-reverse">
                      {/* Button to manage images */}
                      <Link
                        href={`/${locale}/admin/units/${unit.id}/images`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                        title={isEn ? "Manage Images" : "إدارة الصور"}
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
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </Link>

                      {/* Button to edit details */}
                      <Link
                        href={`/${locale}/admin/units/${unit.id}/edit`}
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

                      {/* Button to delete */}
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
