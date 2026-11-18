import type { AdminUser, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canSeeAllTasks } from "@/lib/tasks/permissions";

/**
 * Which tasks a staff member may see (server only):
 *   - Manager-level roles and SUPERVISOR → every task.
 *   - RECEPTIONIST → tasks in their assigned buildings.
 *   - everyone else → tasks assigned to them or created by them.
 * Used by the website's GET /api/tasks and the mobile app's task routes.
 */
export async function taskVisibilityWhere(user: AdminUser): Promise<Prisma.TaskWhereInput> {
  if (canSeeAllTasks(user.role)) return {};

  if (user.role === "RECEPTIONIST") {
    const assigned = await prisma.adminUserBuilding.findMany({
      where: { adminUserId: user.id },
      select: { buildingId: true },
    });
    return { buildingId: { in: assigned.map((b) => b.buildingId) } };
  }

  return { OR: [{ assignedToId: user.id }, { createdById: user.id }] };
}

/** Can this staff member see the task with this id? */
export async function canViewTask(user: AdminUser, taskId: string): Promise<boolean> {
  const visible = await prisma.task.count({
    where: { AND: [{ id: taskId }, await taskVisibilityWhere(user)] },
  });
  return visible > 0;
}
