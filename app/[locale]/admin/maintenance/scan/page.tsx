import { getCurrentAdminUser } from "@/lib/adminAuth";
import TechnicianScanFlow from "@/components/admin/maintenance/TechnicianScanFlow";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminMaintenanceScanPage({ params }: PageProps) {
  const [{ locale }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  const [buildings, equipments] = await Promise.all([
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.equipment.findMany({
      select: { 
        id: true, 
        buildingId: true, 
        unitNumber: true, 
        brandModel: true, 
        qrCode: true,
        type: { select: { nameEn: true, nameAr: true } }
      },
      orderBy: { qrCode: "asc" },
    })
  ]);

  return (
    <TechnicianScanFlow 
      locale={locale} 
      currentUserId={adminUser.id}
      buildings={buildings}
      equipments={equipments}
    />
  );
}
