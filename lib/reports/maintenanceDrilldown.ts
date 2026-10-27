import prisma from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import { analyzeTimeline, TIMELINE_ACTIONS } from "./taskTimeline";
import {
  REVIEW_ACTIONS,
  TERMINAL_STATUSES,
  baseWhere,
  periodRange,
  touchedSince,
  type SummaryRange,
} from "./maintenanceSummary";
import type { DashboardTask } from "./receptionistDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Drill-down lists behind the Manager/Supervisor maintenance summary cards.
// Each card's rule is reproduced from the SAME helpers the summary itself uses
// (periodRange / baseWhere / touchedSince / analyzeTimeline), so a list can
// never disagree with the number printed on its card.
// ─────────────────────────────────────────────────────────────────────────────

/** Equipment-maintenance cards that open a list. */
export const EQUIPMENT_CARDS = ["completed", "reopened", "notStarted", "inProgress", "onHold"] as const;
export type EquipmentCard = (typeof EQUIPMENT_CARDS)[number];

/** Other-maintenance cards that open a list. */
export const OTHER_CARDS = ["requests", "overdueNow", "openNow"] as const;
export type OtherCard = (typeof OTHER_CARDS)[number];

/** Rows are capped; the modal says so and points at the Export for everything. */
export const DRILLDOWN_LIMIT = 500;

export type DrilldownResult = {
  tasks: DashboardTask[];
  /** Total matching the card's rule — may exceed tasks.length when capped. */
  total: number;
  limit: number;
};

const taskSelect = {
  id: true, title: true, type: true, priority: true, status: true, unitNumber: true,
  dueDate: true, createdAt: true, updatedAt: true,
  building: { select: { nameEn: true, nameAr: true, shortName: true } },
  unit: { select: { name: true } },
  assignedTo: { select: { name: true, email: true, role: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.TaskSelect;

type SelectedTask = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

function toRow(t: SelectedTask, startedAt: Date | null = null, completedAt?: Date | null): DashboardTask {
  return {
    id: t.id,
    buildingName: t.building.shortName || t.building.nameAr,
    buildingNameEn: t.building.shortName || t.building.nameEn,
    unitName: t.unit?.name || t.unitNumber || null,
    assignedUserName: t.assignedTo.name || t.assignedTo.email.split("@")[0],
    assignedUserRole: t.assignedTo.role,
    taskTitle: t.title,
    taskType: t.type,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    completedAt: completedAt ?? t.updatedAt,
    startedAt,
    photos: [],
    photoCount: t._count.photos,
  };
}

/** Live statuses behind the "now" cards — same mapping as the summary's groupBy. */
const LIVE_STATUSES: Record<"notStarted" | "inProgress" | "onHold", TaskStatus[]> = {
  notStarted: ["ASSIGNED"],
  inProgress: ["WORK_STARTED", "IN_PROGRESS"],
  onHold: ["ON_HOLD"],
};

/**
 * Tasks behind one equipment-maintenance card.
 * "completed" and "reopened" are period-based and need the activity log, so
 * they are resolved the same way the summary computes them; the three "now"
 * cards are a plain status query (they ignore the period, like the cards do).
 */
export async function getEquipmentCardTasks(
  card: EquipmentCard,
  range: SummaryRange,
  scopeBuildingIds: string[] | null,
): Promise<DrilldownResult> {
  const now = Date.now();
  const { since, until } = periodRange(range, now);
  const inPeriod = (d: Date) => d >= since && d < until;
  const base = await baseWhere("ALL_EQUIPMENT", scopeBuildingIds);

  if (card === "notStarted" || card === "inProgress" || card === "onHold") {
    const where: Prisma.TaskWhereInput = { AND: [base, { status: { in: LIVE_STATUSES[card] } }] };
    const [total, rows] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({ where, select: taskSelect, orderBy: { dueDate: "asc" }, take: DRILLDOWN_LIMIT }),
    ]);
    return { tasks: rows.map((t) => toRow(t)), total, limit: DRILLDOWN_LIMIT };
  }

  // Period cards: replay the timeline exactly as the summary does.
  const candidates = await prisma.task.findMany({
    where: { AND: [base, touchedSince(since, until)] },
    select: {
      ...taskSelect,
      activities: {
        where: { action: { in: [...TIMELINE_ACTIONS, ...REVIEW_ACTIONS] } },
        orderBy: { createdAt: "asc" },
        select: { action: true, details: true, createdAt: true },
      },
    },
  });

  const matched: { task: SelectedTask; startedAt: Date | null; completedAt: Date | null }[] = [];
  for (const t of candidates) {
    const { activities, ...rest } = t;
    const tl = analyzeTimeline(activities, t.status, now);
    if (card === "completed") {
      if (tl.completedAt && inPeriod(tl.completedAt)) {
        matched.push({ task: rest, startedAt: tl.startedAt, completedAt: tl.completedAt });
      }
    } else {
      // reopened = rejected (sent back) within the period
      const reopened = activities.some(
        (a) => REVIEW_ACTIONS.includes(a.action) && a.action.startsWith("rejected") && inPeriod(a.createdAt),
      );
      if (reopened) matched.push({ task: rest, startedAt: tl.startedAt, completedAt: tl.completedAt });
    }
  }

  // Newest activity first, so the most recent work is at the top.
  matched.sort((a, b) => {
    const at = (a.completedAt ?? a.task.updatedAt).getTime();
    const bt = (b.completedAt ?? b.task.updatedAt).getTime();
    return bt - at;
  });

  return {
    tasks: matched.slice(0, DRILLDOWN_LIMIT).map((m) => toRow(m.task, m.startedAt, m.completedAt)),
    total: matched.length,
    limit: DRILLDOWN_LIMIT,
  };
}

/**
 * Tasks behind one other-maintenance card.
 * "requests" = created in the period; "openNow"/"overdueNow" are live counts
 * that ignore the period, matching the cards.
 */
export async function getOtherCardTasks(
  card: OtherCard,
  range: SummaryRange,
  scopeBuildingIds: string[] | null,
): Promise<DrilldownResult> {
  const now = Date.now();
  const { since, until } = periodRange(range, now);
  const base = await baseWhere("ALL_OTHER", scopeBuildingIds);
  const open: Prisma.TaskWhereInput = { status: { notIn: TERMINAL_STATUSES } };

  let where: Prisma.TaskWhereInput;
  let orderBy: Prisma.TaskOrderByWithRelationInput;
  if (card === "requests") {
    where = { AND: [base, { createdAt: { gte: since, lt: until } }] };
    orderBy = { createdAt: "desc" };
  } else if (card === "openNow") {
    where = { AND: [base, open] };
    orderBy = { dueDate: "asc" };
  } else {
    where = { AND: [base, open, { dueDate: { lt: new Date(now) } }] };
    orderBy = { dueDate: "asc" };
  }

  const [total, rows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({ where, select: taskSelect, orderBy, take: DRILLDOWN_LIMIT }),
  ]);
  return { tasks: rows.map((t) => toRow(t)), total, limit: DRILLDOWN_LIMIT };
}
