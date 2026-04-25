"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/adminAuth";

export async function requestMaintenanceFromItem(
  taskId: string,
  itemId: string,
  label: string,
  notes: string | null,
  locale: string
) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) throw new Error("Unauthorized");

  // 1. Fetch current task to get building/unit context
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { buildingId: true, unitNumber: true, title: true }
  });
  if (!task) throw new Error("Task not found");

  // 2. Create maintenance task
  const maintenanceTask = await prisma.task.create({
    data: {
      type: "MAINTENANCE",
      title: `Maintenance: ${label}`,
      description: `Requested during inspection for task: ${task.title}. ${notes ? `\n\nNotes: ${notes}` : ""}`,
      buildingId: task.buildingId,
      unitNumber: task.unitNumber,
      priority: "MEDIUM",
      status: "PENDING_APPROVAL",
      createdById: adminUser.id,
      assignedToId: adminUser.id,
      dueDate: new Date(),
      requiresApproval: true,
      approvalStatus: "PENDING",
      parentTaskId: taskId, // Link them
    }
  });

  // 3. Link it back to the checklist item
  await prisma.inspectionChecklistItem.update({
    where: { id: itemId },
    data: { maintenanceTaskId: maintenanceTask.id }
  });

  // 4. Activity log
  await prisma.taskActivity.create({
    data: {
      taskId,
      userId: adminUser.id,
      action: "maintenance_requested",
      details: `Requested maintenance for item: ${label}`,
    }
  });

  revalidatePath(`/${locale}/admin/tasks`);
  return { success: true, maintenanceTaskId: maintenanceTask.id };
}
