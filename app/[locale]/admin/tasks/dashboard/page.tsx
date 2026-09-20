import { getCurrentAdminUser } from "@/lib/adminAuth";
import DirectorDashboard from "@/components/admin/tasks/dashboard/DirectorDashboard";

export default async function TasksDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  return <DirectorDashboard locale={locale} currentUserId={adminUser.id} currentUserRole={adminUser.role} />;
}
