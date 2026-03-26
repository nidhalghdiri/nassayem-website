"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canCreateTasks, canCreateMaintenanceRequest, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
import { getInitialStatus } from "@/lib/tasks/statuses";
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
  const unitId = (formData.get("unitId") as string) || null;
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
      unitId,
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

  revalidatePath(`/${locale}/admin/tasks`);
  redirect(`/${locale}/admin/tasks`);
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
  const unitId = (formData.get("unitId") as string) || null;
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
      unitId,
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
