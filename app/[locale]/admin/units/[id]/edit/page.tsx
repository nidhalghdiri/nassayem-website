import UnitForm from "@/components/admin/UnitForm";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const [unit, buildings] = await Promise.all([
    prisma.unit.findUnique({ where: { id } }),
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!unit) return notFound();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
          {isEn ? "Edit Unit" : "تعديل الوحدة"}
        </h1>
      </div>

      {/* Pass initialData to your existing UnitForm */}
      {/* <UnitForm locale={locale} buildings={buildings} initialData={unit} /> */}

      {/* NOTE: Just like the BuildingForm, update your UnitForm to check for `initialData`.
        If it's present, set defaultValues and trigger the `updateUnit` Server Action on submit!
      */}
      <UnitForm locale={locale} buildings={buildings} initialData={unit} />
    </div>
  );
}
