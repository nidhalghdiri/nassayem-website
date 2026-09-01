import { getCurrentAdminUser } from "@/lib/adminAuth";
import TechnicianScanFlow from "@/components/admin/maintenance/TechnicianScanFlow";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminMaintenanceScanPage({ params }: PageProps) {
  const [{ locale }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  return (
    <TechnicianScanFlow 
      locale={locale} 
      currentUserId={adminUser.id}
    />
  );
}
