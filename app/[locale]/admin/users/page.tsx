import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { createClient } from "@/utils/supabase/server";
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

  // Get session user to mark "You"
  const supabase = await createClient();
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const adminUsers = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
  });

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
        users={adminUsers}
        currentSupabaseId={sessionUser?.id ?? ""}
        locale={locale}
      />
    </div>
  );
}
