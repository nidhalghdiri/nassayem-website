import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

export type WorkerStats = {
  firstTimeAcceptanceRate: number; // percentage
  pendingAuditCount: number;
  completedThisWeekCount: number;
};

export type WorkerTask = {
  id: string;
  title: string;
  unitName: string | null;
  buildingName: string;
  type: string;
  status: string;
  priority: string;
  assignedToName: string;
  assignedToRole: string;
  dueDate: Date;
  updatedAt: Date;
  isNew: boolean;
  timeElapsedMins: number;
  isLate: boolean;
  hasRejection: boolean;
};

export type WorkerDashboardData = {
  stats: WorkerStats;
  openTasks: WorkerTask[];
  recentTasks: WorkerTask[];
};

export async function getWorkerDashboardData(workerId: string): Promise<WorkerDashboardData> {
  const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "WORK_COMPLETED", "COMPLETED", "NO_ISSUES"];
  const ACTIVE_STATUSES: TaskStatus[] = ["ASSIGNED", "CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"];

  // 1. Fetch all tasks assigned to the worker
  const allWorkerTasks = await prisma.task.findMany({
    where: { assignedToId: workerId },
    include: {
      building: { select: { nameEn: true, nameAr: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, role: true } },
      activities: {
        where: { action: { in: ["approved", "rejected", "approved_receptionist", "rejected_receptionist", "status_changed"] } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const openTasks: WorkerTask[] = [];
  const recentTasks: WorkerTask[] = [];
  let pendingAuditCount = 0;
  let completedThisWeekCount = 0;

  let auditedTasksCount = 0;
  let firstTimeAcceptedCount = 0;

  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  for (const t of allWorkerTasks) {
    const isTerminal = TERMINAL_STATUSES.includes(t.status as TaskStatus);
    const isActive = ACTIVE_STATUSES.includes(t.status as TaskStatus);

    const approvalActivities = t.activities.filter(a => 
      ["approved", "rejected", "approved_receptionist", "rejected_receptionist"].includes(a.action)
    );
    const latestAction = approvalActivities[0]?.action;
    const hasRejection = approvalActivities.some(a => a.action === "rejected" || a.action === "rejected_receptionist");

    // Stats calculations
    if (t.activities.some(a => a.action === "approved")) {
      auditedTasksCount++;
      if (!hasRejection) firstTimeAcceptedCount++;
    }

    if (isTerminal && latestAction !== "approved") {
      pendingAuditCount++;
    }

    if (isTerminal && latestAction === "approved" && t.updatedAt >= oneWeekAgo) {
      completedThisWeekCount++;
    }

    // Task formatting
    const startedAct = t.activities.find(a => a.action === "status_changed" && a.details.includes("STARTED"));
    const taskDurationMins = startedAct ? Math.max(0, Math.round((t.updatedAt.getTime() - startedAct.createdAt.getTime()) / 60000)) : 0;
    
    // "New" logic: less than 24 hours since update (or whatever makes sense for open tasks)
    const isNew = (now.getTime() - t.updatedAt.getTime()) / (1000 * 60 * 60) < 24;
    const isLate = t.dueDate < now;

    const wTask: WorkerTask = {
      id: t.id,
      title: t.title,
      unitName: t.unit?.name || t.unitNumber || null,
      buildingName: t.building.nameAr || t.building.nameEn,
      type: t.type,
      status: t.status,
      priority: t.priority,
      assignedToName: t.assignedTo.name || "Unknown",
      assignedToRole: t.assignedTo.role,
      dueDate: t.dueDate,
      updatedAt: t.updatedAt,
      isNew,
      timeElapsedMins: taskDurationMins,
      isLate,
      hasRejection,
    };

    if (isActive) {
      openTasks.push(wTask);
    } else if (isTerminal) {
      recentTasks.push(wTask);
    }
  }

  const firstTimeAcceptanceRate = auditedTasksCount > 0 
    ? Math.round((firstTimeAcceptedCount / auditedTasksCount) * 100) 
    : 100;

  return {
    stats: {
      firstTimeAcceptanceRate,
      pendingAuditCount,
      completedThisWeekCount,
    },
    openTasks,
    recentTasks: recentTasks.slice(0, 10), // only return top 10 most recent
  };
}
