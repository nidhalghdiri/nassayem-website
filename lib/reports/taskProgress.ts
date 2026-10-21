import prisma from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import type { DashboardTask } from "./receptionistDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Manager dashboard — "Task progress", for the chosen employees:
//   • total       = every task assigned in the chosen dates (any status)
//   • in progress = work has started and is not finished — live, ignores the dates
//   • overdue     = not finished and past the due time — live, ignores the dates
// The in-progress and overdue lists come with the counts (they are short); the
// total list is loaded only when its card is opened (getTotalTasks).
// ─────────────────────────────────────────────────────────────────────────────

export type TaskProgressFilters = {
  /** Empty = every employee */
  assigneeIds: string[];
  /** Assignment (creation) date range, "YYYY-MM-DD" in Oman time, both days included — total only */
  from?: string;
  to?: string;
};

export type TaskProgressResult = {
  totalCount: number;
  inProgress: DashboardTask[];
  overdue: DashboardTask[];
};

/** The total list is capped; newest first. */
export const TOTAL_TASKS_LIST_LIMIT = 1000;

const IN_PROGRESS_STATUSES: TaskStatus[] = ["CLEANING_STARTED", "INSPECTING", "ISSUES_FOUND", "WORK_STARTED", "IN_PROGRESS"];
const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];

const taskSelect = {
  id: true, title: true, type: true, priority: true, status: true, unitNumber: true,
  dueDate: true, createdAt: true, updatedAt: true,
  building: { select: { nameEn: true, nameAr: true, shortName: true } },
  unit: { select: { name: true } },
  assignedTo: { select: { name: true, email: true, role: true } },
  _count: { select: { photos: true } },
} satisfies Prisma.TaskSelect;

type SelectedTask = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

function toRow(t: SelectedTask): DashboardTask {
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
    // The modal only shows the completion time on review lists
    completedAt: t.updatedAt,
    startedAt: null,
    photos: [],
    photoCount: t._count.photos,
  };
}

const assigneeWhere = (f: TaskProgressFilters): Prisma.TaskWhereInput =>
  f.assigneeIds.length > 0 ? { assignedToId: { in: f.assigneeIds } } : {};

/** Selected employees, assigned within the dates. */
function totalWhere(f: TaskProgressFilters): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [assigneeWhere(f)];
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+04:00`) } });
  if (f.to) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59.999+04:00`) } });
  return { AND: and };
}

export async function getTaskProgress(filters: TaskProgressFilters): Promise<TaskProgressResult> {
  const now = new Date();
  const [totalCount, live] = await Promise.all([
    prisma.task.count({ where: totalWhere(filters) }),
    prisma.task.findMany({
      where: {
        AND: [
          assigneeWhere(filters),
          { OR: [{ status: { in: IN_PROGRESS_STATUSES } }, { status: { notIn: TERMINAL_STATUSES }, dueDate: { lt: now } }] },
        ],
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return {
    totalCount,
    inProgress: live.filter((t) => IN_PROGRESS_STATUSES.includes(t.status)).map(toRow),
    overdue: live.filter((t) => !TERMINAL_STATUSES.includes(t.status) && t.dueDate < now).map(toRow),
  };
}

/** Every task of the selected employees assigned within the dates, newest first (capped). */
export async function getTotalTasks(filters: TaskProgressFilters): Promise<DashboardTask[]> {
  const tasks = await prisma.task.findMany({
    where: totalWhere(filters),
    select: taskSelect,
    orderBy: { createdAt: "desc" },
    take: TOTAL_TASKS_LIST_LIMIT,
  });
  return tasks.map(toRow);
}
