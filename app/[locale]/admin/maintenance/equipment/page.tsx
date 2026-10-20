import { getCurrentAdminUser } from "@/lib/adminAuth";
import EquipmentBoard from "@/components/admin/maintenance/EquipmentBoard";
import { loadEquipmentBoardData } from "@/lib/maintenance/equipmentBoardData";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminEquipmentPage({ params }: PageProps) {
  const [{ locale }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null; // middleware redirects to login

  const { equipments, buildings, equipmentTypes } = await loadEquipmentBoardData();

  return (
    <EquipmentBoard
      equipments={equipments}
      equipmentTypes={equipmentTypes}
      buildings={buildings}
      locale={locale}
      currentUserRole={adminUser.role}
    />
  );
}
