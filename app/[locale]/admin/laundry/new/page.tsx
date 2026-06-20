import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { canCreateLaundryOrder } from "@/lib/laundry/permissions";
import CreateLaundryOrderForm from "@/components/admin/laundry/CreateLaundryOrderForm";
import type { TStaffRole } from "@/lib/tasks/constants";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewLaundryOrderPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) redirect(`/${locale}/admin/login`);
  const role = adminUser.role as TStaffRole;
  if (!canCreateLaundryOrder(role)) redirect(`/${locale}/admin/laundry`);

  // Scope is keyed by buildingId (for building-owned rows); for the Building
  // model itself we filter on its own id.
  const scope = await getBuildingScopeFilter(adminUser);
  const buildingWhere = scope ? { id: { in: scope.buildingId.in } } : {};

  const [buildings, itemTypes] = await Promise.all([
    prisma.building.findMany({
      where: buildingWhere,
      select: { id: true, nameEn: true, nameAr: true, shortName: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.laundryItemType.findMany({
      where: { isActive: true },
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href={`/${locale}/admin/laundry`} className="hover:text-gray-800 transition-colors">
          {isEn ? "Laundry" : "المغسلة"}
        </Link>
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium">{isEn ? "New Request" : "طلب جديد"}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Request Laundry" : "طلب غسيل"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEn
            ? "List every item and how many pieces you are sending. Fields marked with * are required."
            : "أدرج كل صنف وعدد القطع التي ترسلها. الحقول المميزة بـ * مطلوبة."}
        </p>
      </div>

      <CreateLaundryOrderForm buildings={buildings} itemTypes={itemTypes} locale={locale} />
    </div>
  );
}
