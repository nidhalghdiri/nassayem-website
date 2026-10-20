import prisma from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import type { DashboardTask } from "./receptionistDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Manager dashboard — "Task progress": tasks being worked on right now and
// overdue tasks, for the chosen employees and assignment dates.
//   • in progress = work has started and is not finished (cleaning / inspection /
//     maintenance / work order started)
//   • overdue     = not finished (any open status) and past the due time
// Both lists are returned in full so the cards can open them in the task list modal.
// ─────────────────────────────────────────────────────────────────────────────

export type TaskProgressFilters = {
  /** Empty = every employee */
  assigneeIds: string[];
  /** Assignment (creation) date range, "YYYY-MM-DD" in Oman time, both days included */
  from?: string;
  to?: string;
};

export type TaskProgressResult = {
  inProgress: DashboardTask[];
  overdue: DashboardTask[];
};

const IN_PROGRESS_STATUSES: TaskStatus[] = ["CLEANING_STARTED", "INSPECTING", "ISSUES_FOUND", "WORK_STARTED", "IN_PROGRESS"];
const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];

export async function getTaskProgress(filters: TaskProgressFilters): Promise<TaskProgressResult> {
  const now = new Date();
  const and: Prisma.TaskWhereInput[] = [];
  if (filters.assigneeIds.length > 0) and.push({ assignedToId: { in: filters.assigneeIds } });
  if (filters.from) and.push({ createdAt: { gte: new Date(`${filters.from}T00:00:00+04:00`) } });
  if (filters.to) and.push({ createdAt: { lte: new Date(`${filters.to}T23:59:59.999+04:00`) } });

  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        ...and,
        { OR: [{ status: { in: IN_PROGRESS_STATUSES } }, { status: { notIn: TERMINAL_STATUSES }, dueDate: { lt: now } }] },
      ],
    },
    select: {
      id: true, title: true, type: true, priority: true, status: true, unitNumber: true,
      dueDate: true, createdAt: true, updatedAt: true,
      building: { select: { nameEn: true, nameAr: true, shortName: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, email: true, role: true } },
      _count: { select: { photos: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const toRow = (t: (typeof tasks)[number]): DashboardTask => ({
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
    // Open tasks have no completion; the modal only shows it for review lists
    completedAt: t.updatedAt,
    startedAt: null,
    photos: [],
    photoCount: t._count.photos,
  });

  return {
    inProgress: tasks.filter((t) => IN_PROGRESS_STATUSES.includes(t.status)).map(toRow),
    overdue: tasks
      .filter((t) => !TERMINAL_STATUSES.includes(t.status) && t.dueDate < now)
      .map(toRow),
  };
}
