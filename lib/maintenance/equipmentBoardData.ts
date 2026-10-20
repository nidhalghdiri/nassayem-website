import prisma from "@/lib/prisma";

// Data for the equipment list (EquipmentBoard): every device with its latest
// visit, plus the buildings and device types for the filters and forms. Dates
// are ISO strings so the result can be passed to a client component.
// Used by /admin/maintenance/equipment and the dashboards' "Equipment list" tab.

export async function loadEquipmentBoardData() {
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
      orderBy: { nameAr: "asc" },
    }),
  ]);

  return {
    equipments: equipments.map((eq) => ({
      ...eq,
      createdAt: eq.createdAt.toISOString(),
      updatedAt: eq.updatedAt.toISOString(),
      type: { ...eq.type, createdAt: eq.type.createdAt.toISOString(), updatedAt: eq.type.updatedAt.toISOString() },
      visits: eq.visits.map((v) => ({
        ...v,
        visitDate: v.visitDate.toISOString(),
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    })),
    buildings,
    equipmentTypes: equipmentTypes.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

export type EquipmentBoardData = Awaited<ReturnType<typeof loadEquipmentBoardData>>;
