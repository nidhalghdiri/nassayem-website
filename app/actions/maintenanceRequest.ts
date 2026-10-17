"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { canCreateTasks, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
import { isKnownIssue, isOtherIssue } from "@/lib/maintenance/issues";
import {
  CATEGORY_LABELS,
  EQUIPMENT_CATEGORY,
  OTHER_CATEGORIES,
  OTHER_JOB_KEY,
  ROOMS,
  findJob,
  type OtherCategoryKey,
} from "@/lib/maintenance/categories";
import { notifyTaskAssigned } from "@/lib/whatsapp";
import type { TStaffRole } from "@/lib/tasks/constants";
import type { AdminUser, TaskStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// "New maintenance request" — a manager / supervisor / receptionist reports
// something to fix and sends it to a maintenance technician as a MAINTENANCE
// task. Two kinds:
//   • EQUIPMENT — a registered device (picked by QR code or building → unit →
//     equipment); the location comes from the device.
//   • OTHER — anything else (plumbing, electrical, furniture, painting,
//     installation…): a category + job at an exact building and unit (or a
//     named place in a common area).
//
// Receptionists are limited to their assigned buildings, enforced here (the
// pickers are only a convenience).
// ─────────────────────────────────────────────────────────────────────────────

export type MaintenanceRequestError =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "EQUIPMENT_NOT_FOUND"
  | "LOCATION_INVALID"
  | "TECHNICIAN_INVALID"
  | "SERVER";

export type EquipmentOption = {
  id: string;
  qrCode: string;
  buildingId: string;
  /** null = common area */
  unitNumber: string | null;
  brandModel: string | null;
  typeEn: string;
  typeAr: string;
};

export type UnitOption = { id: string; buildingId: string; name: string };

export type MaintenanceRequestOptions = {
  requester: { name: string; role: string };
  buildings: { id: string; nameEn: string; nameAr: string; shortName: string | null }[];
  equipments: EquipmentOption[];
  units: UnitOption[];
  technicians: { id: string; name: string; openCount: number }[];
  /** Technician with the fewest open tasks — pre-selected in the form. */
  defaultTechnicianId: string | null;
};

export type MaintenanceRequestInput =
  | {
      kind: "EQUIPMENT";
      equipmentId: string;
      issue: string;
      details?: string;
      assignedToId: string;
      urgent?: boolean;
      locale: string;
    }
  | {
      kind: "OTHER";
      buildingId: string;
      /** null = a common area of the building (then `place` is required) */
      unitId: string | null;
      place?: string;
      room?: string;
      category: string;
      job?: string;
      details?: string;
      assignedToId: string;
      urgent?: boolean;
      locale: string;
    };

const TERMINAL_STATUSES: TaskStatus[] = [
  "CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED",
];

const HOUR_MS = 60 * 60 * 1000;

async function getRequester(): Promise<{ user: AdminUser } | { error: MaintenanceRequestError }> {
  const user = await getCurrentAdminUser();
  if (!user) return { error: "UNAUTHORIZED" };
  const role = user.role as TStaffRole;
  if (!canCreateTasks(role) || !ASSIGNABLE_ROLES[role].includes("MAINTENANCE")) {
    return { error: "FORBIDDEN" };
  }
  return { user };
}

// ── Load the form's options (called when the modal opens) ─────────────────────
export async function getMaintenanceRequestOptions(): Promise<
  { ok: true; data: MaintenanceRequestOptions } | { ok: false; error: MaintenanceRequestError }
> {
  try {
    const requester = await getRequester();
    if ("error" in requester) return { ok: false, error: requester.error };
    const { user } = requester;

    const scope = await getBuildingScopeFilter(user); // null = all buildings
    const [buildings, equipments, units, technicians, openCounts] = await Promise.all([
      prisma.building.findMany({
        where: scope ? { id: { in: scope.buildingId.in } } : {},
        select: { id: true, nameEn: true, nameAr: true, shortName: true },
        orderBy: { nameEn: "asc" },
      }),
      prisma.equipment.findMany({
        where: scope ? { buildingId: { in: scope.buildingId.in } } : {},
        select: {
          id: true, qrCode: true, buildingId: true, unitNumber: true, brandModel: true,
          type: { select: { nameEn: true, nameAr: true } },
        },
        orderBy: { qrCode: "asc" },
      }),
      prisma.buildingUnit.findMany({
        where: scope ? { buildingId: { in: scope.buildingId.in } } : {},
        select: { id: true, buildingId: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.adminUser.findMany({
        where: { role: "MAINTENANCE" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.task.groupBy({
        by: ["assignedToId"],
        where: { assignedTo: { role: "MAINTENANCE" }, status: { notIn: TERMINAL_STATUSES } },
        _count: { _all: true },
      }),
    ]);

    const openByTech = new Map(openCounts.map((c) => [c.assignedToId, c._count._all]));
    const techs = technicians.map((t) => ({
      id: t.id,
      name: t.name || t.email.split("@")[0],
      openCount: openByTech.get(t.id) ?? 0,
    }));
    const defaultTechnicianId =
      [...techs].sort((a, b) => a.openCount - b.openCount || a.name.localeCompare(b.name))[0]?.id ?? null;

    return {
      ok: true,
      data: {
        requester: { name: user.name || user.email.split("@")[0], role: user.role },
        buildings,
        equipments: equipments.map((e) => ({
          id: e.id,
          qrCode: e.qrCode,
          buildingId: e.buildingId,
          unitNumber: e.unitNumber,
          brandModel: e.brandModel,
          typeEn: e.type.nameEn || e.type.nameAr,
          typeAr: e.type.nameAr,
        })),
        units,
        technicians: techs,
        defaultTechnicianId,
      },
    };
  } catch (err) {
    console.error("getMaintenanceRequestOptions failed:", err);
    return { ok: false, error: "SERVER" };
  }
}

// ── Create the request ────────────────────────────────────────────────────────
export async function createMaintenanceRequest(input: MaintenanceRequestInput): Promise<
  | { ok: true; taskId: string; requestNumber: number; technicianName: string }
  | { ok: false; error: MaintenanceRequestError }
> {
  try {
    const requester = await getRequester();
    if ("error" in requester) return { ok: false, error: requester.error };
    const { user } = requester;

    const locale = input.locale === "ar" ? "ar" : "en";
    const details = (input.details ?? "").trim().slice(0, 1000);
    if (!input.assignedToId) return { ok: false, error: "INVALID_INPUT" };

    const technician = await prisma.adminUser.findUnique({
      where: { id: input.assignedToId },
      select: { id: true, name: true, email: true, role: true, whatsappNumber: true, preferredLanguage: true },
    });
    if (!technician || technician.role !== "MAINTENANCE") return { ok: false, error: "TECHNICIAN_INVALID" };
    const technicianName = technician.name || technician.email.split("@")[0];

    const scope = await getBuildingScopeFilter(user); // receptionists: their buildings only
    const inScope = (buildingId: string) => !scope || scope.buildingId.in.includes(buildingId);

    // What gets saved depends on the kind; everything else is shared below
    let title: string;
    let description: string | null;
    let category: string;
    let room: string | null = null;
    let buildingId: string;
    let buildingNameEn: string;
    let unitId: string | null = null;
    let unitNumber: string | null = null;

    if (input.kind === "EQUIPMENT") {
      const issue = (input.issue ?? "").trim();
      if (!input.equipmentId || !issue || !isKnownIssue(issue)) return { ok: false, error: "INVALID_INPUT" };
      // "Other" has no meaning without the written details
      if (isOtherIssue(issue) && details.length < 2) return { ok: false, error: "INVALID_INPUT" };

      const equipment = await prisma.equipment.findUnique({
        where: { id: input.equipmentId },
        select: {
          qrCode: true, buildingId: true, unitNumber: true,
          type: { select: { nameEn: true, nameAr: true } },
          building: { select: { nameEn: true } },
        },
      });
      if (!equipment || !inScope(equipment.buildingId)) return { ok: false, error: "EQUIPMENT_NOT_FOUND" };

      // Link the structured unit when it exists (the units grid reads it)
      const unit = equipment.unitNumber
        ? await prisma.buildingUnit.findUnique({
            where: { buildingId_name: { buildingId: equipment.buildingId, name: equipment.unitNumber } },
            select: { id: true },
          })
        : null;

      const typeName = locale === "ar" ? equipment.type.nameAr : (equipment.type.nameEn || equipment.type.nameAr);
      title = `${typeName} — ${equipment.qrCode}`;
      description = isOtherIssue(issue) ? details : details ? `${issue} — ${details}` : issue;
      category = EQUIPMENT_CATEGORY;
      buildingId = equipment.buildingId;
      buildingNameEn = equipment.building.nameEn;
      unitId = unit?.id ?? null;
      unitNumber = equipment.unitNumber;
    } else {
      // ── OTHER: a category + job at an exact building and unit ──────────────
      const cat = OTHER_CATEGORIES.find((c) => c.key === input.category);
      if (!cat || !input.buildingId) return { ok: false, error: "INVALID_INPUT" };

      const building = await prisma.building.findUnique({
        where: { id: input.buildingId },
        select: { id: true, nameEn: true },
      });
      if (!building || !inScope(building.id)) return { ok: false, error: "LOCATION_INVALID" };

      if (input.unitId) {
        const unit = await prisma.buildingUnit.findUnique({
          where: { id: input.unitId },
          select: { id: true, name: true, buildingId: true },
        });
        if (!unit || unit.buildingId !== building.id) return { ok: false, error: "LOCATION_INVALID" };
        unitId = unit.id;
        unitNumber = unit.name;
        room = ROOMS.some((r) => r.key === input.room) ? (input.room as string) : null;
      } else {
        // Common area: the place must be named
        const place = (input.place ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
        if (place.length < 2) return { ok: false, error: "LOCATION_INVALID" };
        room = place;
      }

      const job = cat.jobs.length > 0 ? findJob(cat.key, input.job ?? "") : undefined;
      if (cat.jobs.length > 0 && !job) return { ok: false, error: "INVALID_INPUT" };
      const needsDetails = cat.key === "OTHER" || job?.key === OTHER_JOB_KEY;
      if (needsDetails && details.length < 2) return { ok: false, error: "INVALID_INPUT" };

      const catLabel = CATEGORY_LABELS[cat.key as OtherCategoryKey][locale];
      const jobLabel =
        job && job.key !== OTHER_JOB_KEY
          ? job[locale]
          : (details.replace(/\s+/g, " ").length > 40 ? `${details.replace(/\s+/g, " ").slice(0, 40).trimEnd()}…` : details.replace(/\s+/g, " "));
      title = `${catLabel} — ${jobLabel}`;
      description = details || null;
      category = cat.key;
      buildingId = building.id;
      buildingNameEn = building.nameEn;
    }

    // Urgent: top priority, due in 4 hours (otherwise medium, due in 24 hours)
    const urgent = input.urgent === true;
    const dueDate = new Date(Date.now() + (urgent ? 4 : 24) * HOUR_MS);

    const task = await prisma.task.create({
      data: {
        type: "MAINTENANCE",
        title,
        description,
        category,
        room,
        buildingId,
        unitId,
        unitNumber,
        priority: urgent ? "URGENT" : "MEDIUM",
        status: "ASSIGNED",
        createdById: user.id,
        assignedToId: technician.id,
        dueDate,
        activities: {
          create: {
            userId: user.id,
            action: "task_created",
            details: `Maintenance request (${CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS].en}) sent to ${technicianName}.`,
          },
        },
      },
      select: { id: true, requestNumber: true },
    });

    // WhatsApp the technician (non-blocking)
    notifyTaskAssigned({
      assignee: {
        name: technician.name,
        whatsappNumber: technician.whatsappNumber ?? null,
        preferredLanguage: technician.preferredLanguage,
      },
      taskTitle: title,
      buildingName: buildingNameEn,
      unitName: unitNumber ?? "",
      dueDate,
      priority: urgent ? "URGENT" : "MEDIUM",
      taskId: task.id,
    }).catch(console.error);

    revalidatePath(`/${locale}/admin/tasks`, "layout");
    return { ok: true, taskId: task.id, requestNumber: task.requestNumber, technicianName };
  } catch (err) {
    console.error("createMaintenanceRequest failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
