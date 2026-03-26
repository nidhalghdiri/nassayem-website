"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canCreateTasks, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
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
