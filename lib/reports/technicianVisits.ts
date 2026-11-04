import prisma from "@/lib/prisma";
import type { EquipmentVisitStatus, Prisma } from "@prisma/client";

// Barcode visits ("زيارة بالباركود") logged from /admin/maintenance/scan.
// Each scan writes one EquipmentVisit row (see logMaintenanceVisit in
// app/actions/maintenance.ts). The Maintenance dashboard shows one technician's
// visits; the Manager dashboard shows every technician's.

export type TechnicianVisit = {
  id: string;
  visitDate: string;
  issueDescription: string;
  actionTaken: string;
  status: EquipmentVisitStatus;
  technicianName: string;
  equipment: {
    id: string;
    qrCode: string;
    unitNumber: string | null;
    brandModel: string | null;
    /** EquipmentType.nameEn is optional in the schema; nameAr is always set. */
    typeNameEn: string | null;
    typeNameAr: string;
    buildingId: string;
    buildingNameEn: string;
    buildingNameAr: string;
  };
};

export type VisitFilters = {
  /** Omitted = every technician (Manager dashboard). */
  technicianId?: string;
  /** Oman calendar days, "YYYY-MM-DD", inclusive. */
  from?: string;
  to?: string;
  buildingId?: string;
  unitNumber?: string;
};

export type TechnicianVisitsData = {
  visits: TechnicianVisit[];
  /** KPIs over every visit matching the filters, not just the capped list. */
  stats: {
    total: number;
    resolved: number;
    needsParts: number;
    unresolved: number;
    /** resolved / total, as a whole percentage (0 when there are no visits). */
    resolutionRate: number;
    devicesVisited: number;
    /** Devices visited more than once in the filtered period — recurring faults. */
    repeatDevices: number;
    techniciansActive: number;
  };
  /** Choices for the filter dropdowns: everything that has at least one visit in scope. */
  options: {
    buildings: { id: string; nameEn: string; nameAr: string }[];
    units: { buildingId: string; unitNumber: string }[];
    technicians: { id: string; name: string }[];
  };
};

// Oman is UTC+4 all year (no DST).
const omanDayStart = (day: string) => new Date(`${day}T00:00:00+04:00`);
const omanDayEnd = (day: string) => new Date(`${day}T23:59:59.999+04:00`);
const isDay = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Barcode visits matching the filters, newest first.
 * `limit` caps the list so a long history cannot bloat the payload.
 */
export async function getTechnicianVisits(
  filters: VisitFilters,
  limit = 300
): Promise<TechnicianVisitsData> {
  const scope: Prisma.EquipmentVisitWhereInput = filters.technicianId ? { technicianId: filters.technicianId } : {};

  const visitDate: Prisma.DateTimeFilter = {};
  if (isDay(filters.from)) visitDate.gte = omanDayStart(filters.from!);
  if (isDay(filters.to)) visitDate.lte = omanDayEnd(filters.to!);

  const where: Prisma.EquipmentVisitWhereInput = {
    ...scope,
    ...(Object.keys(visitDate).length ? { visitDate } : {}),
    ...(filters.buildingId || filters.unitNumber
      ? {
          equipment: {
            ...(filters.buildingId ? { buildingId: filters.buildingId } : {}),
            ...(filters.unitNumber ? { unitNumber: filters.unitNumber } : {}),
          },
        }
      : {}),
  };

  const [rows, byStatus, byDevice, byTechnician, scopeDevices, scopeTechnicians] = await Promise.all([
    prisma.equipmentVisit.findMany({
      where,
      orderBy: { visitDate: "desc" },
      take: limit,
      include: {
        technician: { select: { name: true, email: true } },
        equipment: {
          select: {
            id: true,
            qrCode: true,
            unitNumber: true,
            brandModel: true,
            buildingId: true,
            type: { select: { nameEn: true, nameAr: true } },
            building: { select: { nameEn: true, nameAr: true } },
          },
        },
      },
    }),
    prisma.equipmentVisit.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.equipmentVisit.groupBy({ by: ["equipmentId"], where, _count: { _all: true } }),
    prisma.equipmentVisit.groupBy({ by: ["technicianId"], where }),
    // Filter options come from the whole scope, so picking a building does not
    // empty the other dropdowns.
    prisma.equipment.findMany({
      where: { visits: { some: scope } },
      select: { buildingId: true, unitNumber: true, building: { select: { nameEn: true, nameAr: true } } },
    }),
    filters.technicianId
      ? Promise.resolve([])
      : prisma.adminUser.findMany({
          where: { equipmentVisits: { some: {} } },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
  ]);

  const countFor = (status: EquipmentVisitStatus) =>
    byStatus.find((g) => g.status === status)?._count._all ?? 0;
  const total = byStatus.reduce((sum, g) => sum + g._count._all, 0);
  const resolved = countFor("RESOLVED");

  const buildings = new Map<string, { id: string; nameEn: string; nameAr: string }>();
  const units = new Map<string, { buildingId: string; unitNumber: string }>();
  for (const d of scopeDevices) {
    buildings.set(d.buildingId, { id: d.buildingId, nameEn: d.building.nameEn, nameAr: d.building.nameAr });
    if (d.unitNumber) units.set(`${d.buildingId}|${d.unitNumber}`, { buildingId: d.buildingId, unitNumber: d.unitNumber });
  }

  return {
    visits: rows.map((v) => ({
      id: v.id,
      visitDate: v.visitDate.toISOString(),
      issueDescription: v.issueDescription,
      actionTaken: v.actionTaken,
      status: v.status,
      technicianName: v.technician.name || v.technician.email.split("@")[0],
      equipment: {
        id: v.equipment.id,
        qrCode: v.equipment.qrCode,
        unitNumber: v.equipment.unitNumber,
        brandModel: v.equipment.brandModel,
        typeNameEn: v.equipment.type.nameEn,
        typeNameAr: v.equipment.type.nameAr,
        buildingId: v.equipment.buildingId,
        buildingNameEn: v.equipment.building.nameEn,
        buildingNameAr: v.equipment.building.nameAr,
      },
    })),
    stats: {
      total,
      resolved,
      needsParts: countFor("NEEDS_PARTS"),
      unresolved: countFor("UNRESOLVED"),
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      devicesVisited: byDevice.length,
      repeatDevices: byDevice.filter((g) => g._count._all > 1).length,
      techniciansActive: byTechnician.length,
    },
    options: {
      buildings: [...buildings.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
      units: [...units.values()].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })),
      technicians: scopeTechnicians.map((u) => ({ id: u.id, name: u.name || u.email.split("@")[0] })),
    },
  };
}
