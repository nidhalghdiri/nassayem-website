"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canCreateTasks, canCreateMaintenanceRequest, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
import { getInitialStatus } from "@/lib/tasks/statuses";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/tasks/inspection";
import { notifyTaskAssigned } from "@/lib/whatsapp";
import type { TStaffRole } from "@/lib/tasks/constants";
import type { TaskType, TaskPriority, StaffRole } from "@prisma/client";

// ── Create a new task ─────────────────────────────────────────────────────────
export async function createTask(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { error: "Unauthorized." };
  if (!canCreateTasks(adminUser.role as TStaffRole)) {
    return { error: "You do not have permission to create tasks." };
  }

  const locale = (formData.get("locale") as string) || "en";
  const type = formData.get("type") as TaskType;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const buildingId = formData.get("buildingId") as string;
  const unitNumber = (formData.get("unitNumber") as string)?.trim() || null;
  const priority = (formData.get("priority") as TaskPriority) || "MEDIUM";
  const assignedToId = formData.get("assignedToId") as string;
  const dueDate = formData.get("dueDate") as string;
  const requiresApproval = formData.get("requiresApproval") === "on";
  const parentTaskId = (formData.get("parentTaskId") as string) || null;

  if (!type || !title || !buildingId || !assignedToId || !dueDate) {
    return { error: "Please fill in all required fields." };
  }

  const assignee = await prisma.adminUser.findUnique({ where: { id: assignedToId } });
  if (!assignee) return { error: "Assignee not found." };

  const allowedRoles = ASSIGNABLE_ROLES[adminUser.role as TStaffRole] as StaffRole[];
  if (!allowedRoles.includes(assignee.role)) {
    return { error: `Your role cannot assign tasks to ${assignee.role}.` };
  }

  const initialStatus = getInitialStatus(type, requiresApproval);

  const task = await prisma.task.create({
    data: {
      type,
      title,
      description,
      buildingId,
      unitNumber,
      priority,
      status: initialStatus,
      createdById: adminUser.id,
      assignedToId,
      dueDate: new Date(dueDate),
      parentTaskId,
      requiresApproval,
      approvalStatus: requiresApproval ? "PENDING" : null,
    },
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      userId: adminUser.id,
      action: "task_created",
      details: requiresApproval
        ? "Task submitted for approval."
        : `Task created and assigned to ${assignee.name ?? assignee.email}.`,
    },
  });

  // Auto-create inspection checklist with custom or default items
  if (type === "INSPECTION") {
    const checklist = await prisma.inspectionChecklist.create({
      data: { taskId: task.id },
    });

    const customCategories = await prisma.inspectionCategory.findMany({
      include: { items: { orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" },
    });

    if (customCategories.length > 0) {
      const itemsToCreate = customCategories.flatMap((cat) =>
        cat.items.map((item, idx) => ({
          checklistId: checklist.id,
          category: locale === "ar" ? cat.nameAr : cat.nameEn,
          label: locale === "ar" ? item.labelAr : item.labelEn,
          displayOrder: idx,
          status: "pending",
        }))
      );
      await prisma.inspectionChecklistItem.createMany({ data: itemsToCreate });
    } else {
      await prisma.inspectionChecklistItem.createMany({
        data: DEFAULT_CHECKLIST_ITEMS.map((item, idx) => ({
          checklistId: checklist.id,
          category: item.category,
          label: locale === "ar" ? item.labelAr : item.labelEn,
          displayOrder: idx,
          status: "pending",
        })),
      });
    }
  }

  // Send WhatsApp notification to the assigned user (non-blocking, only if not pending approval)
  if (!requiresApproval) {
    const building = await prisma.building.findUnique({ where: { id: buildingId }, select: { nameEn: true } });
    notifyTaskAssigned({
      assignee: {
        name: assignee.name,
        whatsappNumber: assignee.whatsappNumber ?? null,
        preferredLanguage: assignee.preferredLanguage,
      },
      taskTitle: title,
      buildingName: building?.nameEn ?? "",
      unitName: unitNumber ?? "",
      dueDate: new Date(dueDate),
      priority,
    }).catch(console.error);
  }

  revalidatePath(`/${locale}/admin/tasks`);
  redirect(`/${locale}/admin/tasks`);
}

// ── Bulk create multiple tasks ────────────────────────────────────────────────
export type BulkTaskInput = {
  type: TaskType;
  title: string;
  description?: string;
  buildingId: string;
  unitNumber?: string;
  priority: TaskPriority;
  assignedToId: string;
  dueDate: string;
  requiresApproval?: boolean;
};

export async function createTasksBulk(
  tasks: BulkTaskInput[],
  locale: string,
): Promise<{ success: boolean; created: number; errors: string[] }> {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { success: false, created: 0, errors: ["Unauthorized."] };
  if (!canCreateTasks(adminUser.role as TStaffRole)) {
    return { success: false, created: 0, errors: ["You do not have permission to create tasks."] };
  }

  if (!tasks || tasks.length === 0) {
    return { success: false, created: 0, errors: ["No tasks provided."] };
  }

  const allowedRoles = ASSIGNABLE_ROLES[adminUser.role as TStaffRole] as StaffRole[];
  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const rowLabel = `Row ${i + 1}`;

    if (!t.type || !t.title?.trim() || !t.buildingId || !t.assignedToId || !t.dueDate) {
      errors.push(`${rowLabel}: Missing required fields.`);
      continue;
    }

    const assignee = await prisma.adminUser.findUnique({ where: { id: t.assignedToId } });
    if (!assignee) {
      errors.push(`${rowLabel}: Assignee not found.`);
      continue;
    }
    if (!allowedRoles.includes(assignee.role)) {
      errors.push(`${rowLabel}: Your role cannot assign tasks to ${assignee.role}.`);
      continue;
    }

    const requiresApproval = t.requiresApproval ?? false;
    const initialStatus = getInitialStatus(t.type, requiresApproval);

    try {
      const task = await prisma.task.create({
        data: {
          type: t.type,
          title: t.title.trim(),
          description: t.description?.trim() || null,
          buildingId: t.buildingId,
          unitNumber: t.unitNumber?.trim() || null,
          priority: t.priority,
          status: initialStatus,
          createdById: adminUser.id,
          assignedToId: t.assignedToId,
          dueDate: new Date(t.dueDate),
          requiresApproval,
          approvalStatus: requiresApproval ? "PENDING" : null,
        },
      });

      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: adminUser.id,
          action: "task_created",
          details: requiresApproval
            ? "Task submitted for approval (bulk create)."
            : `Task created and assigned to ${assignee.name ?? assignee.email} (bulk create).`,
        },
      });

      if (t.type === "INSPECTION") {
        const checklist = await prisma.inspectionChecklist.create({
          data: { taskId: task.id },
        });

        const customCategories = await prisma.inspectionCategory.findMany({
          include: { items: { orderBy: { displayOrder: "asc" } } },
          orderBy: { displayOrder: "asc" },
        });

        if (customCategories.length > 0) {
          const itemsToCreate = customCategories.flatMap((cat) =>
            cat.items.map((item, idx) => ({
              checklistId: checklist.id,
              category: locale === "ar" ? cat.nameAr : cat.nameEn,
              label: locale === "ar" ? item.labelAr : item.labelEn,
              displayOrder: idx,
              status: "pending",
            })),
          );
          await prisma.inspectionChecklistItem.createMany({ data: itemsToCreate });
        } else {
          await prisma.inspectionChecklistItem.createMany({
            data: DEFAULT_CHECKLIST_ITEMS.map((item, idx) => ({
              checklistId: checklist.id,
              category: item.category,
              label: locale === "ar" ? item.labelAr : item.labelEn,
              displayOrder: idx,
              status: "pending",
            })),
          });
        }
      }

      // Send WhatsApp notification (non-blocking)
      if (!requiresApproval && assignee.whatsappNumber) {
        const building = await prisma.building.findUnique({
          where: { id: t.buildingId },
          select: { nameEn: true },
        });
        notifyTaskAssigned({
          assignee: {
            name: assignee.name,
            whatsappNumber: assignee.whatsappNumber,
            preferredLanguage: assignee.preferredLanguage,
          },
          taskTitle: t.title.trim(),
          buildingName: building?.nameEn ?? "",
          unitName: t.unitNumber ?? "",
          dueDate: new Date(t.dueDate),
          priority: t.priority,
        }).catch(console.error);
      }

      created++;
    } catch {
      errors.push(`${rowLabel}: Failed to create task.`);
    }
  }

  revalidatePath(`/${locale}/admin/tasks`);
  return { success: errors.length === 0, created, errors };
}

// ── Submit a maintenance request (HOUSEKEEPING only) ─────────────────────────
// Creates a MAINTENANCE task with requiresApproval=true, assigned to self.
// Bypasses ASSIGNABLE_ROLES — HOUSEKEEPING can't normally assign tasks.
export async function createMaintenanceRequest(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return { error: "Unauthorized." };
  if (!canCreateMaintenanceRequest(adminUser.role as TStaffRole)) {
    return { error: "Only Housekeeping staff can submit maintenance requests." };
  }

  const locale = (formData.get("locale") as string) || "en";
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const buildingId = formData.get("buildingId") as string;
  const unitNumber = (formData.get("unitNumber") as string)?.trim() || null;
  const priority = (formData.get("priority") as TaskPriority) || "MEDIUM";
  const dueDate = formData.get("dueDate") as string;

  if (!title || !buildingId || !dueDate) {
    return { error: "Please fill in all required fields." };
  }

  const task = await prisma.task.create({
    data: {
      type: "MAINTENANCE",
      title,
      description,
      buildingId,
      unitNumber,
      priority,
      status: "PENDING_APPROVAL",
      createdById: adminUser.id,
      assignedToId: adminUser.id, // assigned to self; manager will reassign on approval
      dueDate: new Date(dueDate),
      requiresApproval: true,
      approvalStatus: "PENDING",
    },
  });

  await prisma.taskActivity.create({
    data: {
      taskId: task.id,
      userId: adminUser.id,
      action: "task_created",
      details: "Maintenance request submitted for approval.",
    },
  });

  revalidatePath(`/${locale}/admin/tasks`);
  redirect(`/${locale}/admin/tasks`);
}
