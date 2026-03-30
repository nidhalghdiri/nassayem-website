import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canCreateMaintenanceRequest } from "@/lib/tasks/permissions";
import prisma from "@/lib/prisma";
import MaintenanceRequestForm from "@/components/admin/tasks/MaintenanceRequestForm";
import type { TStaffRole } from "@/lib/tasks/constants";

type PageProps = { params: Promise<{ locale: string }> };

export default async function MaintenanceRequestPage({ params }: PageProps) {
  const { locale } = await params;
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) redirect(`/${locale}/admin/login`);

  // Non-HK staff use the regular create form
  if (!canCreateMaintenanceRequest(adminUser.role as TStaffRole)) {
    redirect(`/${locale}/admin/tasks/new`);
  }

  const isEn = locale === "en";

  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      units: {
        select: { id: true, unitCode: true, titleEn: true, titleAr: true },
        orderBy: { unitCode: "asc" },
      },
    },
    orderBy: { nameEn: "asc" },
  });

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link
          href={`/${locale}/admin/tasks`}
          className="hover:text-gray-800 transition-colors"
        >
          {isEn ? "Tasks" : "المهام"}
        </Link>
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-gray-800 font-medium">
          {isEn ? "Maintenance Request" : "طلب صيانة"}
        </span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEn ? "Submit Maintenance Request" : "تقديم طلب صيانة"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isEn
            ? "Report a maintenance issue. Your request will be reviewed and approved before work is assigned."
            : "أبلغ عن مشكلة صيانة. سيُراجَع طلبك ويُوافَق عليه قبل تكليف أحد بالعمل."}
        </p>
      </div>

      <MaintenanceRequestForm buildings={buildings} locale={locale} />
    </div>
  );
}
