import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";
import { AUDITED_STATUSES, getAwaitingReview, type TAwaitingReview } from "@/lib/tasks/statuses";
import { analyzeTimeline } from "./taskTimeline";

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance technician dashboard — open tasks with their timing (arrival →
// start, work time, time paused for spare parts), a 30-day task log and KPIs.
//
// Timings are rebuilt from the TaskActivity log: every status change is
// written as "Status changed from <A> to <B>" (PATCH /api/tasks/:id and the
// activity route), and pausing for parts adds an "on_hold_reason" activity.
// All "time ago" values are computed here on the server so the client renders
// exactly what the server rendered (no hydration drift).
// ─────────────────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES: TaskStatus[] = ["WORK_COMPLETED", "COMPLETED", "CLEANING_COMPLETED", "NO_ISSUES", "CANCELLED"];
const REVIEW_ACTIONS = ["approved", "rejected", "approved_receptionist", "rejected_receptionist"];

const DAY_MS = 24 * 60 * 60 * 1000;
const mins = (ms: number) => Math.max(0, Math.round(ms / 60000));

export type MaintenanceTask = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  buildingNameEn: string;
  buildingNameAr: string;
  unitName: string | null;
  createdByName: string;
  createdByRole: string;
  createdAt: Date;
  dueDate: Date;
  photoCount: number;
  /** Minutes since the task arrived (created). */
  ageMins: number;
  isOverdue: boolean;
  startedAt: Date | null;
  /** Arrival → first start, in minutes (null until started). */
  arrivalToStartMins: number | null;
  /** Active work time, excluding time on hold (null until started). */
  workMins: number | null;
  /** Total time spent on hold (incl. the current hold). */
  holdMins: number;
  /** Set while the task is on hold. */
  holdSince: Date | null;
  holdReason: string | null;
  completedAt: Date | null;
  /** Latest review on a finished task (null = this status is not reviewed). */
  review: "approved" | "approved_receptionist" | "pending" | null;
  /**
   * Work is done but the task has not been finally approved/rated yet: it stays in
   * "My tasks" (after the active ones) until the supervisor approves it.
   */
  awaitingReview: TAwaitingReview | null;
  /** Was rejected at least once — a rejected task comes back as active work. */
  hasRejection: boolean;
};

export type MaintenanceStats = {
  /** Tasks still to work on (excludes finished tasks awaiting review). */
  openCount: number;
  /** Finished tasks waiting for the final review. */
  awaitingReviewCount: number;
  notStartedCount: number;
  /** Average arrival → start over the last 30 days (null = no data). */
  avgArrivalToStartMins: number | null;
  /** Number of pauses for spare parts in the last 30 days. */
  partsHoldsCount: number;
  /** % of tasks reviewed in the last 30 days that were accepted without rejection (null = none reviewed). */
  satisfactionPct: number | null;
};

export type MaintenanceDashboardData = {
  technician: { id: string; name: string };
  stats: MaintenanceStats;
  openTasks: MaintenanceTask[];
  logTasks: MaintenanceTask[];
};

export async function getMaintenanceDashboardData(technicianId: string): Promise<MaintenanceDashboardData> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);

  const [technician, tasks] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: technicianId }, select: { id: true, name: true, email: true } }),
    prisma.task.findMany({
      where: {
        assignedToId: technicianId,
        // Every open task, finished ones from the last 30 days for the log & KPIs, and
        // any finished task that has not been finally approved yet (whatever its age)
        OR: [
          { status: { notIn: TERMINAL_STATUSES } },
          { updatedAt: { gte: thirtyDaysAgo } },
          { status: { in: AUDITED_STATUSES }, NOT: { activities: { some: { action: "approved" } } } },
        ],
      },
      include: {
        building: { select: { nameEn: true, nameAr: true, shortName: true } },
        unit: { select: { name: true } },
        createdBy: { select: { name: true, email: true, role: true } },
        _count: { select: { photos: true } },
        activities: {
          where: { action: { in: ["status_changed", "on_hold_reason", ...REVIEW_ACTIONS] } },
          orderBy: { createdAt: "asc" },
          select: { action: true, details: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const openTasks: MaintenanceTask[] = [];
  const logTasks: MaintenanceTask[] = [];
  const arrivalSamples: number[] = [];
  let partsHoldsCount = 0;
  let reviewed = 0;
  let acceptedClean = 0;

  for (const t of tasks) {
    // ── Rebuild the timeline ────────────────────────────────────────────────
    const { startedAt, completedAt, holdMs, holdSince, holdStarts } = analyzeTimeline(t.activities, t.status, now);
    partsHoldsCount += holdStarts.filter((at) => at >= thirtyDaysAgo).length;

    const holdReasons = t.activities.filter((a) => a.action === "on_hold_reason");
    const holdReason = t.status === "ON_HOLD" && holdReasons.length > 0 ? holdReasons[holdReasons.length - 1].details : null;

    const endMs = completedAt ? completedAt.getTime() : now;
    const workMins = startedAt ? mins(endMs - startedAt.getTime() - holdMs) : null;
    const arrivalToStartMins = startedAt ? mins(startedAt.getTime() - t.createdAt.getTime()) : null;
    if (startedAt && startedAt >= thirtyDaysAgo && arrivalToStartMins !== null) arrivalSamples.push(arrivalToStartMins);

    // ── Reviews ─────────────────────────────────────────────────────────────
    const reviews = t.activities.filter((a) => REVIEW_ACTIONS.includes(a.action));
    const hasRejection = reviews.some((a) => a.action.startsWith("rejected"));
    const latestReview = reviews[reviews.length - 1]?.action ?? null;
    const awaitingReview = getAwaitingReview(t.status, latestReview);
    if (reviews.some((a) => a.createdAt >= thirtyDaysAgo)) {
      reviewed++;
      if (!hasRejection) acceptedClean++;
    }

    const isTerminal = TERMINAL_STATUSES.includes(t.status);
    const mt: MaintenanceTask = {
      id: t.id,
      title: t.title,
      description: t.description,
      type: t.type,
      status: t.status,
      priority: t.priority,
      buildingNameEn: t.building.shortName || t.building.nameEn,
      buildingNameAr: t.building.shortName || t.building.nameAr,
      unitName: t.unit?.name || t.unitNumber || null,
      createdByName: t.createdBy.name || t.createdBy.email.split("@")[0],
      createdByRole: t.createdBy.role,
      createdAt: t.createdAt,
      dueDate: t.dueDate,
      photoCount: t._count.photos,
      ageMins: mins(now - t.createdAt.getTime()),
      isOverdue: !isTerminal && t.dueDate.getTime() < now,
      startedAt,
      arrivalToStartMins,
      workMins,
      holdMins: mins(holdMs),
      holdSince,
      holdReason,
      completedAt: isTerminal ? (completedAt ?? t.updatedAt) : null,
      // Only audited statuses (cleaning / maintenance completed) have a review state. A
      // task back in a completed status after a rejection was redone → pending again.
      review: !isTerminal || !AUDITED_STATUSES.includes(t.status as never)
        ? null
        : latestReview === "approved"
          ? "approved"
          : latestReview === "approved_receptionist"
            ? "approved_receptionist"
            : "pending",
      awaitingReview,
      hasRejection,
    };

    // Done-but-not-yet-rated tasks stay in "My tasks"; only finally approved ones go to the log
    if (isTerminal && !awaitingReview) logTasks.push(mt);
    else openTasks.push(mt);
  }

  // Work to do first — not started, then in progress, then on hold (oldest first) —
  // then finished tasks awaiting review, most recently finished first
  const rank = (task: MaintenanceTask) =>
    task.awaitingReview ? 3 : task.status === "ASSIGNED" ? 0 : task.status === "ON_HOLD" ? 2 : 1;
  openTasks.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.awaitingReview
        ? (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)
        : a.createdAt.getTime() - b.createdAt.getTime()),
  );
  const activeTasks = openTasks.filter((task) => !task.awaitingReview);
  logTasks.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  return {
    technician: {
      id: technicianId,
      name: technician?.name || technician?.email.split("@")[0] || "—",
    },
    stats: {
      openCount: activeTasks.length,
      awaitingReviewCount: openTasks.length - activeTasks.length,
      notStartedCount: activeTasks.filter((t) => t.status === "ASSIGNED").length,
      avgArrivalToStartMins: arrivalSamples.length
        ? Math.round(arrivalSamples.reduce((s, v) => s + v, 0) / arrivalSamples.length)
        : null,
      partsHoldsCount,
      satisfactionPct: reviewed > 0 ? Math.round((acceptedClean / reviewed) * 100) : null,
    },
    openTasks,
    logTasks,
  };
}
