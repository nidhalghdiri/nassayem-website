import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

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

const STARTED_STATUSES = new Set<string>(["WORK_STARTED", "IN_PROGRESS", "CLEANING_STARTED", "INSPECTING"]);
const DONE_STATUSES = new Set<string>(["WORK_COMPLETED", "COMPLETED", "CLEANING_COMPLETED", "NO_ISSUES"]);
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
  /** Latest review on a finished task. */
  review: "approved" | "approved_receptionist" | "rejected" | "pending" | null;
  hasRejection: boolean;
};

export type MaintenanceStats = {
  openCount: number;
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

type Transition = { from: string; to: string; at: Date };

function parseTransition(details: string, at: Date): Transition | null {
  const m = details.match(/^Status changed from (\w+) to (\w+)/);
  return m ? { from: m[1], to: m[2], at } : null;
}

export async function getMaintenanceDashboardData(technicianId: string): Promise<MaintenanceDashboardData> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);

  const [technician, tasks] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: technicianId }, select: { id: true, name: true, email: true } }),
    prisma.task.findMany({
      where: {
        assignedToId: technicianId,
        // Every open task, plus finished ones from the last 30 days for the log & KPIs
        OR: [
          { status: { notIn: TERMINAL_STATUSES } },
          { updatedAt: { gte: thirtyDaysAgo } },
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
    const transitions = t.activities
      .filter((a) => a.action === "status_changed")
      .map((a) => parseTransition(a.details, a.createdAt))
      .filter((x): x is Transition => x !== null);

    // ── Rebuild the timeline ────────────────────────────────────────────────
    let startedAt: Date | null = null;
    let completedAt: Date | null = null;
    let holdMs = 0;
    let holdStart: Date | null = null;

    for (const tr of transitions) {
      if (!startedAt && STARTED_STATUSES.has(tr.to)) startedAt = tr.at;
      if (tr.to === "ON_HOLD") {
        holdStart = tr.at;
        if (tr.at >= thirtyDaysAgo) partsHoldsCount++;
      } else if (tr.from === "ON_HOLD" && holdStart) {
        holdMs += tr.at.getTime() - holdStart.getTime();
        holdStart = null;
      }
      if (DONE_STATUSES.has(tr.to)) completedAt = tr.at; // latest completion wins (re-done after rejection)
      if (STARTED_STATUSES.has(tr.to) && completedAt && tr.at > completedAt) completedAt = null; // reopened
    }

    const isOnHold = t.status === "ON_HOLD";
    if (isOnHold && holdStart) holdMs += now - holdStart.getTime();
    const holdSince = isOnHold ? holdStart : null;

    const holdReasons = t.activities.filter((a) => a.action === "on_hold_reason");
    const holdReason = isOnHold && holdReasons.length > 0 ? holdReasons[holdReasons.length - 1].details : null;

    const endMs = completedAt ? completedAt.getTime() : now;
    const workMins = startedAt ? mins(endMs - startedAt.getTime() - holdMs) : null;
    const arrivalToStartMins = startedAt ? mins(startedAt.getTime() - t.createdAt.getTime()) : null;
    if (startedAt && startedAt >= thirtyDaysAgo && arrivalToStartMins !== null) arrivalSamples.push(arrivalToStartMins);

    // ── Reviews ─────────────────────────────────────────────────────────────
    const reviews = t.activities.filter((a) => REVIEW_ACTIONS.includes(a.action));
    const hasRejection = reviews.some((a) => a.action.startsWith("rejected"));
    const latestReview = reviews[reviews.length - 1]?.action ?? null;
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
      review: !isTerminal || t.status === "CANCELLED"
        ? null
        : latestReview === "approved" || latestReview === "approved_receptionist"
          ? latestReview
          : latestReview?.startsWith("rejected")
            ? "rejected"
            : "pending",
      hasRejection,
    };

    if (isTerminal) logTasks.push(mt);
    else openTasks.push(mt);
  }

  // Not started first, then in progress, then on hold; oldest first within each group
  const rank = (s: string) => (s === "ASSIGNED" ? 0 : s === "ON_HOLD" ? 2 : 1);
  openTasks.sort((a, b) => rank(a.status) - rank(b.status) || a.createdAt.getTime() - b.createdAt.getTime());
  logTasks.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  return {
    technician: {
      id: technicianId,
      name: technician?.name || technician?.email.split("@")[0] || "—",
    },
    stats: {
      openCount: openTasks.length,
      notStartedCount: openTasks.filter((t) => t.status === "ASSIGNED").length,
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
