import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import EquipmentDetail from "@/components/admin/maintenance/EquipmentDetail";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function AdminEquipmentDetailPage({ params }: PageProps) {
  const [{ locale, id }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      building: true,
      visits: {
        include: { technician: { select: { id: true, name: true, email: true } } },
        orderBy: { visitDate: "desc" },
      },
    },
  });

  if (!equipment) {
    notFound();
  }

  // Serialize Prisma Date objects
  const serializedEquipment = {
    ...equipment,
    createdAt: equipment.createdAt.toISOString(),
    updatedAt: equipment.updatedAt.toISOString(),
    visits: equipment.visits.map(v => ({
      ...v,
      visitDate: v.visitDate.toISOString(),
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }))
  };

  return (
    <EquipmentDetail 
      equipment={serializedEquipment} 
      locale={locale} 
      currentUserRole={adminUser.role}
    />
  );
}
