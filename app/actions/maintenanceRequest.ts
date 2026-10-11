"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser, getBuildingScopeFilter } from "@/lib/adminAuth";
import { canCreateTasks, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
import { isKnownIssue, isOtherIssue } from "@/lib/maintenance/issues";
import { notifyTaskAssigned } from "@/lib/whatsapp";
import type { TStaffRole } from "@/lib/tasks/constants";
import type { AdminUser, TaskStatus } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// "New maintenance request" — a manager / supervisor / receptionist reports a
// faulty piece of equipment (picked by QR code, or building → unit → equipment)
// and sends it to a maintenance technician as a MAINTENANCE task.
//
// Receptionists are limited to equipment in their assigned buildings, enforced
// here (the picker is only a convenience).
// ─────────────────────────────────────────────────────────────────────────────

export type MaintenanceRequestError =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "EQUIPMENT_NOT_FOUND"
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

export type MaintenanceRequestOptions = {
  requester: { name: string; role: string };
  buildings: { id: string; nameEn: string; nameAr: string; shortName: string | null }[];
  equipments: EquipmentOption[];
  technicians: { id: string; name: string; openCount: number }[];
  /** Technician with the fewest open tasks — pre-selected in the form. */
  defaultTechnicianId: string | null;
};

const TERMINAL_STATUSES: TaskStatus[] = [
  "CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED",
];

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
    const [buildings, equipments, technicians, openCounts] = await Promise.all([
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
export async function createEquipmentMaintenanceRequest(input: {
  equipmentId: string;
  assignedToId: string;
  issue: string;
  details?: string;
  locale: string;
}): Promise<
  { ok: true; taskId: string; technicianName: string } | { ok: false; error: MaintenanceRequestError }
> {
  try {
    const requester = await getRequester();
    if ("error" in requester) return { ok: false, error: requester.error };
    const { user } = requester;

    const locale = input.locale === "ar" ? "ar" : "en";
    const issue = (input.issue ?? "").trim();
    const details = (input.details ?? "").trim().slice(0, 1000);

    if (!input.equipmentId || !input.assignedToId || !issue || !isKnownIssue(issue)) {
      return { ok: false, error: "INVALID_INPUT" };
    }
    // "Other" has no meaning without the written details
    if (isOtherIssue(issue) && details.length < 2) return { ok: false, error: "INVALID_INPUT" };

    const equipment = await prisma.equipment.findUnique({
      where: { id: input.equipmentId },
      select: {
        id: true, qrCode: true, buildingId: true, unitNumber: true,
        type: { select: { nameEn: true, nameAr: true } },
        building: { select: { nameEn: true } },
      },
    });
    if (!equipment) return { ok: false, error: "EQUIPMENT_NOT_FOUND" };

    // Receptionists: only equipment in their own buildings
    const scope = await getBuildingScopeFilter(user);
    if (scope && !scope.buildingId.in.includes(equipment.buildingId)) {
      return { ok: false, error: "EQUIPMENT_NOT_FOUND" };
    }

    const technician = await prisma.adminUser.findUnique({
      where: { id: input.assignedToId },
      select: { id: true, name: true, email: true, role: true, whatsappNumber: true, preferredLanguage: true },
    });
    if (!technician || technician.role !== "MAINTENANCE") return { ok: false, error: "TECHNICIAN_INVALID" };
    const technicianName = technician.name || technician.email.split("@")[0];

    // Link the structured unit when it exists (the units grid reads it)
    const unit = equipment.unitNumber
      ? await prisma.buildingUnit.findUnique({
          where: { buildingId_name: { buildingId: equipment.buildingId, name: equipment.unitNumber } },
          select: { id: true },
        })
      : null;

    const typeName = locale === "ar" ? equipment.type.nameAr : (equipment.type.nameEn || equipment.type.nameAr);
    const title = `${typeName} — ${equipment.qrCode}`;
    const description = isOtherIssue(issue) ? details : details ? `${issue} — ${details}` : issue;
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const task = await prisma.task.create({
      data: {
        type: "MAINTENANCE",
        title,
        description,
        buildingId: equipment.buildingId,
        unitId: unit?.id ?? null,
        unitNumber: equipment.unitNumber,
        priority: "MEDIUM",
        status: "ASSIGNED",
        createdById: user.id,
        assignedToId: technician.id,
        dueDate,
        activities: {
          create: {
            userId: user.id,
            action: "task_created",
            details: `Maintenance request for ${equipment.qrCode} sent to ${technicianName}.`,
          },
        },
      },
      select: { id: true },
    });

    // WhatsApp the technician (non-blocking)
    notifyTaskAssigned({
      assignee: {
        name: technician.name,
        whatsappNumber: technician.whatsappNumber ?? null,
        preferredLanguage: technician.preferredLanguage,
      },
      taskTitle: title,
      buildingName: equipment.building.nameEn,
      unitName: equipment.unitNumber ?? "",
      dueDate,
      priority: "MEDIUM",
      taskId: task.id,
    }).catch(console.error);

    revalidatePath(`/${locale}/admin/tasks`, "layout");
    return { ok: true, taskId: task.id, technicianName };
  } catch (err) {
    console.error("createEquipmentMaintenanceRequest failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
