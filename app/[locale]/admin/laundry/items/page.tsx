import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import LaundryItemsManager from "@/components/admin/laundry/LaundryItemsManager";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LaundryItemsPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  const adminUser = await getCurrentAdminUser();
  if (!adminUser) redirect(`/${locale}/admin/login`);
  if (adminUser.role !== "MANAGER") redirect(`/${locale}/admin/laundry`);

  const items = await prisma.laundryItemType.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { orderItems: true } } },
  });

  const serialized = items.map((i) => ({
    id: i.id,
    nameEn: i.nameEn,
    nameAr: i.nameAr,
    isActive: i.isActive,
    usageCount: i._count.orderItems,
  }));

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href={`/${locale}/admin/laundry`} className="hover:text-gray-800 transition-colors">
          {isEn ? "Laundry" : "المغسلة"}
        </Link>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium">{isEn ? "Manage Items" : "إدارة الأصناف"}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Laundry Items" : "أصناف الغسيل"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEn
            ? "The catalog receptionists pick from when requesting laundry."
            : "قائمة الأصناف التي يختار منها موظفو الاستقبال عند طلب الغسيل."}
        </p>
      </div>

      <LaundryItemsManager items={serialized} locale={locale} />
    </div>
  );
}
