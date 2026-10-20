"use server";

import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canSeeAllTasks } from "@/lib/tasks/permissions";
import { getTaskProgress as queryTaskProgress, type TaskProgressResult } from "@/lib/reports/taskProgress";
import type { TStaffRole } from "@/lib/tasks/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Loads the Manager dashboard's "Task progress" report. The filters come from the browser, so they are validated here. */
export async function getTaskProgress(input: {
  assigneeIds: string[];
  from?: string;
  to?: string;
}): Promise<{ ok: true; data: TaskProgressResult } | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "SERVER" }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!canSeeAllTasks(user.role as TStaffRole)) return { ok: false, error: "FORBIDDEN" };

    const assigneeIds = Array.isArray(input.assigneeIds)
      ? input.assigneeIds.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64).slice(0, 200)
      : [];
    const from = input.from && DATE_RE.test(input.from) ? input.from : undefined;
    const to = input.to && DATE_RE.test(input.to) ? input.to : undefined;

    return { ok: true, data: await queryTaskProgress({ assigneeIds, from, to: from && to && to < from ? undefined : to }) };
  } catch (err) {
    console.error("getTaskProgress failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
