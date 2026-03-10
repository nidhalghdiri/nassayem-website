import UnitForm from "@/components/admin/UnitForm";
import Link from "next/link";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewUnitPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // Fetch only the necessary fields for the dropdown to keep it fast
  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb / Header */}
      <div>
        <Link
          href={`/${locale}/admin/units`}
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
          {isEn ? "Back to Units" : "العودة إلى الوحدات"}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEn ? "Add New Unit" : "إضافة وحدة جديدة"}
        </h1>
        <p className="text-gray-500 mt-1">
          {isEn
            ? "Create a new apartment, studio, or villa and assign it to a building."
            : "قم بإنشاء شقة، استوديو، أو فيلا جديدة وربطها بمبنى."}
        </p>
      </div>

      {/* Render the Client Form, passing in the fetched buildings */}
      <UnitForm locale={locale} buildings={buildings} />
    </div>
  );
}
