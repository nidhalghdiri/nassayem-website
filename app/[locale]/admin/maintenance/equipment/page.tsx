import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import EquipmentBoard from "@/components/admin/maintenance/EquipmentBoard";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AdminEquipmentPage({ params }: PageProps) {
  const [{ locale }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null; // middleware redirects to login

  const [equipments, buildings, equipmentTypes] = await Promise.all([
    prisma.equipment.findMany({
      include: {
        building: { select: { id: true, nameEn: true, nameAr: true, shortName: true } },
        type: true,
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
        },
        _count: { select: { visits: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true, shortName: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.equipmentType.findMany({
      orderBy: { nameAr: "asc" }
    })
  ]);

  // Serialize Prisma Date objects for client component props
  const serializedEquipments = equipments.map((eq) => ({
    ...eq,
    createdAt: eq.createdAt.toISOString(),
    updatedAt: eq.updatedAt.toISOString(),
    visits: eq.visits.map(v => ({
      ...v,
      visitDate: v.visitDate.toISOString(),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }))
  }));

  return (
    <EquipmentBoard
      equipments={serializedEquipments}
      equipmentTypes={equipmentTypes}
      buildings={buildings}
      locale={locale}
      currentUserRole={adminUser.role}
    />
  );
}
