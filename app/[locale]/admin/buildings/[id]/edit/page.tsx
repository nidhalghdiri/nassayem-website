import BuildingForm from "@/components/admin/BuildingForm";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditBuildingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const building = await prisma.building.findUnique({ where: { id } });
  if (!building) return notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Edit Building" : "تعديل المبنى"}
          </h1>
          <Link
            href={`/${locale}/admin/buildings/${id}/units`}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 text-sm font-medium rounded-xl hover:bg-purple-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {isEn ? "Manage Units" : "إدارة الوحدات"}
          </Link>
        </div>
      </div>

      {/* Pass initialData to your existing BuildingForm (make sure to update the form to use it) */}
      {/* <BuildingForm locale={locale} initialData={building} /> */}

      {/* NOTE: You will need to update your BuildingForm component to:
        1. Accept `initialData` as a prop.
        2. Set `defaultValue={initialData?.nameEn}` on all inputs.
        3. Switch the action from `createBuilding` to `updateBuilding` if `initialData` exists.
      */}
      <BuildingForm locale={locale} initialData={building} />
    </div>
  );
}
