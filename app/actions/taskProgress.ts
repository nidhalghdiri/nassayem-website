"use server";

import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canSeeAllTasks } from "@/lib/tasks/permissions";
import {
  getTaskProgress as queryTaskProgress,
  getTotalTasks as queryTotalTasks,
  type TaskProgressFilters,
  type TaskProgressResult,
} from "@/lib/reports/taskProgress";
import type { DashboardTask } from "@/lib/reports/receptionistDashboard";
import type { TStaffRole } from "@/lib/tasks/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Input = { assigneeIds: string[]; from?: string; to?: string };
type ActionError = "UNAUTHORIZED" | "FORBIDDEN" | "SERVER";

/** Loads the Manager dashboard's "Task progress" report (counts + the in-progress and overdue lists). */
export async function getTaskProgress(input: Input): Promise<{ ok: true; data: TaskProgressResult } | { ok: false; error: ActionError }> {
  return run(input, queryTaskProgress, "getTaskProgress");
}

/** Loads the "Total tasks" list when its card is opened. */
export async function getTotalTasks(input: Input): Promise<{ ok: true; data: DashboardTask[] } | { ok: false; error: ActionError }> {
  return run(input, queryTotalTasks, "getTotalTasks");
}

/** The filters come from the browser, so they are validated here. */
async function run<T>(
  input: Input,
  query: (filters: TaskProgressFilters) => Promise<T>,
  name: string,
): Promise<{ ok: true; data: T } | { ok: false; error: ActionError }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!canSeeAllTasks(user.role as TStaffRole)) return { ok: false, error: "FORBIDDEN" };

    const assigneeIds = Array.isArray(input.assigneeIds)
      ? input.assigneeIds.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64).slice(0, 200)
      : [];
    const from = input.from && DATE_RE.test(input.from) ? input.from : undefined;
    const to = input.to && DATE_RE.test(input.to) ? input.to : undefined;

    return { ok: true, data: await query({ assigneeIds, from, to: from && to && to < from ? undefined : to }) };
  } catch (err) {
    console.error(`${name} failed:`, err);
    return { ok: false, error: "SERVER" };
  }
}
