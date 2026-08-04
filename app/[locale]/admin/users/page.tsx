import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import UserManagement from "@/components/admin/UserManagement";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminUsersPage({ params }: PageProps) {
  const { locale } = await params;
  const isEn = locale === "en";

  // MANAGER only
  const currentAdmin = await getCurrentAdminUser();
  if (!currentAdmin || currentAdmin.role !== "MANAGER") {
    redirect(`/${locale}/admin`);
  }

  const [adminUsers, buildings] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      include: { assignedBuildings: { select: { buildingId: true } } },
    }),
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {isEn ? "Admin Users" : "المستخدمون"}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isEn
              ? "Manage who has access to this admin panel."
              : "إدارة من يملك صلاحية الوصول إلى لوحة التحكم."}
          </p>
        </div>
      </div>

      <UserManagement
        users={adminUsers.map((u) => ({
          ...u,
          assignedBuildingIds: u.assignedBuildings.map((b) => b.buildingId),
        }))}
        buildings={buildings}
        currentAdminId={currentAdmin.id}
        currentSupabaseId={currentAdmin.supabaseId ?? ""}
        locale={locale}
      />
    </div>
  );
}
