// ─────────────────────────────────────────────────────────────────────────────
// Rebuilds a task's timeline (first start, completion, time on hold) from its
// activity log. Every status change is logged as
// "Status changed from <A> to <B>" (PATCH /api/tasks/:id and the activity
// route), so the log is the only record of *when* things happened.
// Shared by the Maintenance technician dashboard and the Supervisor's
// maintenance-tasks report.
// ─────────────────────────────────────────────────────────────────────────────

export const STARTED_STATUSES = new Set<string>(["WORK_STARTED", "IN_PROGRESS", "CLEANING_STARTED", "INSPECTING"]);
export const DONE_STATUSES = new Set<string>(["WORK_COMPLETED", "COMPLETED", "CLEANING_COMPLETED", "NO_ISSUES"]);

export type TimelineActivity = { action: string; details: string; createdAt: Date };

export type TaskTimeline = {
  /** First time work started (null = not started). */
  startedAt: Date | null;
  /** Latest completion; null while the task is not (or no longer) completed. */
  completedAt: Date | null;
  /** Total time spent on hold, including a hold that is still ongoing. */
  holdMs: number;
  /** When the current hold began (null unless the task is ON_HOLD right now). */
  holdSince: Date | null;
  /** Every moment the task was put on hold. */
  holdStarts: Date[];
};

/** Which activity actions carry timeline information. */
export const TIMELINE_ACTIONS = ["status_changed", "on_hold_reason"];

/** `activities` must be ordered oldest → newest. */
export function analyzeTimeline(activities: TimelineActivity[], currentStatus: string, now: number): TaskTimeline {
  let startedAt: Date | null = null;
  let completedAt: Date | null = null;
  let holdMs = 0;
  let holdStart: Date | null = null;
  const holdStarts: Date[] = [];

  for (const a of activities) {
    if (a.action !== "status_changed") continue;
    const m = a.details.match(/^Status changed from (\w+) to (\w+)/);
    if (!m) continue;
    const from = m[1];
    const to = m[2];
    const at = a.createdAt;

    if (!startedAt && STARTED_STATUSES.has(to)) startedAt = at;
    if (to === "ON_HOLD") {
      holdStart = at;
      holdStarts.push(at);
    } else if (from === "ON_HOLD" && holdStart) {
      holdMs += at.getTime() - holdStart.getTime();
      holdStart = null;
    }
    if (DONE_STATUSES.has(to)) completedAt = at; // latest completion wins (re-done after a rejection)
    if (STARTED_STATUSES.has(to) && completedAt && at > completedAt) completedAt = null; // reopened
  }

  const isOnHold = currentStatus === "ON_HOLD";
  if (isOnHold && holdStart) holdMs += now - (holdStart as Date).getTime();
  return { startedAt, completedAt, holdMs, holdSince: isOnHold ? holdStart : null, holdStarts };
}
