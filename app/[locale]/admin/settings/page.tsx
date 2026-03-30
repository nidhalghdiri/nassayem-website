import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import InspectionSettings from "@/components/admin/settings/InspectionSettings";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: PageProps) {
  const { locale } = await params;
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (adminUser.role !== "MANAGER") redirect(`/${locale}/admin`);

  const isEn = locale === "en";

  const categories = await prisma.inspectionCategory.findMany({
    include: {
      items: {
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Settings" : "الإعدادات"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEn
            ? "Configure custom inspection categories and items for your team."
            : "قم بتكوين فئات وعناصر فحص مخصصة لفريقك."}
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
            {isEn ? "Inspection Checklist" : "قائمة فحص الوحدات"}
          </h2>
          <InspectionSettings categories={categories} locale={locale} />
        </section>
      </div>
    </div>
  );
}
