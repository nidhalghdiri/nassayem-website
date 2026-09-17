import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import BuildingUnitsManager from "@/components/admin/buildings/BuildingUnitsManager";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function BuildingUnitsPage({ params }: PageProps) {
  const { locale, id } = await params;
  const isEn = locale === "en";

  const admin = await getCurrentAdminUser();
  if (!admin) redirect(`/${locale}/admin/login`);
  // Only Managers and Supervisors should probably manage units, but keeping it simple for now based on building edit permissions
  if (admin.role !== "MANAGER" && admin.role !== "SUPERVISOR") {
    redirect(`/${locale}/admin/buildings`);
  }

  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      buildingUnits: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { tasks: true } }
        }
      }
    }
  });

  if (!building) return notFound();

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href={`/${locale}/admin/buildings`} className="hover:text-gray-800 transition-colors">
          {isEn ? "Buildings" : "المباني"}
        </Link>
        <svg className="w-4 h-4 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <Link href={`/${locale}/admin/buildings/${id}/edit`} className="hover:text-gray-800 transition-colors">
          {isEn ? building.nameEn : building.nameAr}
        </Link>
        <svg className="w-4 h-4 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium">{isEn ? "Manage Units" : "إدارة الوحدات"}</span>
      </nav>

      <BuildingUnitsManager 
        buildingId={id} 
        units={building.buildingUnits} 
        locale={locale} 
      />
    </div>
  );
}
