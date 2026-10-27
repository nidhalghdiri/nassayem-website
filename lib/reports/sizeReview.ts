import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { VARIANCE_FLAG_PCT, durationVariancePct } from "@/lib/maintenance/taskSize";
import type { SizeReviewRow } from "@/app/actions/taskSizeApproval";

// ─────────────────────────────────────────────────────────────────────────────
// "تحتاج مراجعة" — tasks a manager should look at before they count in full:
//   • PENDING_SIZE: a LARGE task whose size nobody has approved yet (it is
//     scored as medium meanwhile),
//   • VARIANCE: the actual duration differs from the expected by more than
//     VARIANCE_FLAG_PCT, in either direction.
// ─────────────────────────────────────────────────────────────────────────────

export const SIZE_REVIEW_LIMIT = 200;

/** `scopeBuildingIds` = buildings the caller may see (null = all). */
export async function getSizeReviewTasks(scopeBuildingIds: string[] | null): Promise<SizeReviewRow[]> {
  const scope: Prisma.TaskWhereInput = scopeBuildingIds ? { buildingId: { in: scopeBuildingIds } } : {};

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        scope,
        { expectedHours: { not: null } },
        {
          OR: [
            // A large size nobody has approved yet
            { taskSize: "LARGE", sizeApprovedAt: null },
            // Finished work whose duration is known — variance is checked below
            { actualHours: { not: null } },
          ],
        },
      ],
    },
    orderBy: { completedAt: "desc" },
    take: SIZE_REVIEW_LIMIT,
    select: {
      id: true, requestNumber: true, title: true, taskSize: true,
      expectedHours: true, actualHours: true, sizeApprovedAt: true,
      completedAt: true, unitNumber: true,
      building: { select: { nameAr: true, nameEn: true, shortName: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, email: true } },
    },
  });

  const rows: SizeReviewRow[] = [];
  for (const t of tasks) {
    const variancePct = durationVariancePct(t.expectedHours, t.actualHours);
    const reasons: SizeReviewRow["reasons"] = [];
    if (t.taskSize === "LARGE" && !t.sizeApprovedAt) reasons.push("PENDING_SIZE");
    if (variancePct !== null && Math.abs(variancePct) > VARIANCE_FLAG_PCT) reasons.push("VARIANCE");
    // The query is deliberately wide (it cannot express the variance rule in
    // SQL), so rows that match neither reason are dropped here.
    if (reasons.length === 0) continue;

    rows.push({
      id: t.id,
      requestNumber: t.requestNumber,
      title: t.title,
      assignedToName: t.assignedTo.name || t.assignedTo.email.split("@")[0],
      buildingName: t.building.shortName || t.building.nameAr || t.building.nameEn,
      unitName: t.unit?.name || t.unitNumber || null,
      expectedHours: t.expectedHours,
      actualHours: t.actualHours,
      variancePct,
      taskSize: t.taskSize,
      reasons,
      completedAt: t.completedAt,
    });
  }
  return rows;
}
