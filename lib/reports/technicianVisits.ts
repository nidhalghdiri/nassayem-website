import prisma from "@/lib/prisma";
import type { EquipmentVisitStatus } from "@prisma/client";

// Barcode visits ("زيارة بالباركود") logged from /admin/maintenance/scan.
// Each scan writes one EquipmentVisit row (see logMaintenanceVisit in
// app/actions/maintenance.ts); this is the flat per-technician list of them,
// which the equipment pages only ever showed one device at a time.

export type TechnicianVisit = {
  id: string;
  visitDate: string;
  issueDescription: string;
  actionTaken: string;
  status: EquipmentVisitStatus;
  equipment: {
    id: string;
    qrCode: string;
    unitNumber: string | null;
    brandModel: string | null;
    /** EquipmentType.nameEn is optional in the schema; nameAr is always set. */
    typeNameEn: string | null;
    typeNameAr: string;
    buildingNameEn: string;
    buildingNameAr: string;
  };
};

export type TechnicianVisitsData = {
  visits: TechnicianVisit[];
  stats: {
    total: number;
    resolved: number;
    needsParts: number;
    unresolved: number;
  };
};

/**
 * Visits logged by one maintenance technician, newest first.
 * `limit` caps the list so a long-serving technician cannot bloat the payload.
 */
export async function getTechnicianVisits(
  technicianId: string,
  limit = 200
): Promise<TechnicianVisitsData> {
  const [rows, grouped] = await Promise.all([
    prisma.equipmentVisit.findMany({
      where: { technicianId },
      orderBy: { visitDate: "desc" },
      take: limit,
      include: {
        equipment: {
          select: {
            id: true,
            qrCode: true,
            unitNumber: true,
            brandModel: true,
            type: { select: { nameEn: true, nameAr: true } },
            building: { select: { nameEn: true, nameAr: true } },
          },
        },
      },
    }),
    // Counts cover every visit, not just the capped page above.
    prisma.equipmentVisit.groupBy({
      by: ["status"],
      where: { technicianId },
      _count: { _all: true },
    }),
  ]);

  const countFor = (status: EquipmentVisitStatus) =>
    grouped.find((g) => g.status === status)?._count._all ?? 0;

  return {
    visits: rows.map((v) => ({
      id: v.id,
      visitDate: v.visitDate.toISOString(),
      issueDescription: v.issueDescription,
      actionTaken: v.actionTaken,
      status: v.status,
      equipment: {
        id: v.equipment.id,
        qrCode: v.equipment.qrCode,
        unitNumber: v.equipment.unitNumber,
        brandModel: v.equipment.brandModel,
        typeNameEn: v.equipment.type.nameEn,
        typeNameAr: v.equipment.type.nameAr,
        buildingNameEn: v.equipment.building.nameEn,
        buildingNameAr: v.equipment.building.nameAr,
      },
    })),
    stats: {
      total: grouped.reduce((sum, g) => sum + g._count._all, 0),
      resolved: countFor("RESOLVED"),
      needsParts: countFor("NEEDS_PARTS"),
      unresolved: countFor("UNRESOLVED"),
    },
  };
}
