"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { sizeNeedsApproval } from "@/lib/maintenance/taskSize";
import type { TStaffRole } from "@/lib/tasks/constants";

export type SizeApprovalError = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "NOT_APPLICABLE" | "SERVER";

/** Only the general supervisor / manager may approve a task's size. */
function canApproveSize(role: TStaffRole): boolean {
  return role === "MANAGER";
}

/**
 * Approves a LARGE task's size ("اعتماد الحجم"). Until this is done the ranking
 * credits the task as medium, so an inflated estimate cannot lift a rating on
 * its own. Approving is recorded in the activity log.
 */
export async function approveTaskSize(
  taskId: string,
): Promise<{ ok: true } | { ok: false; error: SizeApprovalError }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!canApproveSize(user.role as TStaffRole)) return { ok: false, error: "FORBIDDEN" };

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, taskSize: true, expectedHours: true, sizeApprovedAt: true },
    });
    if (!task) return { ok: false, error: "NOT_FOUND" };
    // Only LARGE tasks need approving; anything else already counts in full.
    if (!sizeNeedsApproval(task.taskSize)) return { ok: false, error: "NOT_APPLICABLE" };
    if (task.sizeApprovedAt) return { ok: true }; // already approved — idempotent

    await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: { sizeApprovedAt: new Date(), sizeApprovedById: user.id },
      }),
      prisma.taskActivity.create({
        data: {
          taskId,
          userId: user.id,
          action: "size_approved",
          details: `Large size approved (${task.expectedHours ?? "—"}h) — the task now counts with its full hours.`,
        },
      }),
    ]);

    revalidatePath("/[locale]/admin/tasks", "page");
    return { ok: true };
  } catch (err) {
    console.error("approveTaskSize failed:", err);
    return { ok: false, error: "SERVER" };
  }
}

export type SizeReviewRow = {
  id: string;
  requestNumber: number;
  title: string;
  assignedToName: string;
  buildingName: string;
  unitName: string | null;
  expectedHours: number | null;
  actualHours: number | null;
  /** Signed difference between actual and expected, as a percentage. */
  variancePct: number | null;
  taskSize: string | null;
  /** Why the row is listed: an unapproved large size, a wide variance, or both. */
  reasons: ("PENDING_SIZE" | "VARIANCE")[];
  completedAt: Date | null;
};

/** Loads the "تحتاج مراجعة" list for the Manager dashboard. */
export async function getSizeReviewList(): Promise<
  { ok: true; data: SizeReviewRow[]; canApprove: boolean } | { ok: false; error: SizeApprovalError }
> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    const role = user.role as TStaffRole;
    if (role !== "MANAGER" && role !== "SUPERVISOR") return { ok: false, error: "FORBIDDEN" };

    // A supervisor linked to specific buildings only sees those.
    let scopeBuildingIds: string[] | null = null;
    if (role === "SUPERVISOR") {
      const assigned = await prisma.adminUserBuilding.findMany({
        where: { adminUserId: user.id },
        select: { buildingId: true },
      });
      if (assigned.length > 0) scopeBuildingIds = assigned.map((b) => b.buildingId);
    }

    const { getSizeReviewTasks } = await import("@/lib/reports/sizeReview");
    return { ok: true, data: await getSizeReviewTasks(scopeBuildingIds), canApprove: canApproveSize(role) };
  } catch (err) {
    console.error("getSizeReviewList failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
