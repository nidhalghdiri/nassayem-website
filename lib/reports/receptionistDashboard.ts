import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";
import { getEmployeeRanking, LeaderboardEmployee } from "./employeeRanking";

export type ReceptionistStats = {
  pendingReviewCount: number;
  approvedPendingSupervisorCount: number;
  finalApprovedCount: number;
};

export type DashboardTask = {
  id: string;
  buildingName: string;
  unitName: string | null;
  assignedUserName: string;
  assignedUserRole: string;
  taskTitle: string;
  taskType: string;
  priority: string;
  status: string;
  dueDate: Date;
  completedAt: Date;
  startedAt: Date | null;
  photos: { id: string; url: string }[];
  actionTime?: Date;
};

export type UnitStatusInfo = {
  num: string;
  status: "ready" | "pending_cleaning" | "pending_audit" | "issue";
  icon: string | null;
};

export type TimelineEvent = {
  time: string;
  unit: string;
  desc: string;
  badge: string;
  badgeClass: string;
  badgeDot: string;
};

export type ReceptionistDashboardData = {
  stats: ReceptionistStats;
  pendingReviewTasks: DashboardTask[];
  approvedPendingSupervisorTasks: DashboardTask[];
  liveTasks: DashboardTask[];
  staffPerformance: LeaderboardEmployee[];
  units: UnitStatusInfo[];
  timeline: TimelineEvent[];
};

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "WORK_COMPLETED", "COMPLETED", "NO_ISSUES"];
const ACTIVE_STATUSES: TaskStatus[] = ["ASSIGNED", "CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"];

export async function getReceptionistDashboardData(receptionistId: string, selectedBuildingId: string | null): Promise<ReceptionistDashboardData> {
  const buildingFilter = selectedBuildingId && selectedBuildingId !== "ALL" ? { buildingId: selectedBuildingId } : {};

  // 1. Fetch Terminal Tasks for Stats & Review Lists
  const rawTerminalTasks = await prisma.task.findMany({
    where: {
      ...buildingFilter,
      status: { in: TERMINAL_STATUSES },
    },
    include: {
      building: { select: { nameEn: true, nameAr: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, role: true } },
      photos: { select: { id: true, photoUrl: true } },
      activities: {
        where: { action: { in: ["approved", "rejected", "approved_receptionist", "rejected_receptionist", "status_changed"] } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingReviewTasks: DashboardTask[] = [];
  const approvedPendingSupervisorTasks: DashboardTask[] = [];
  let finalApprovedCount = 0;

  for (const t of rawTerminalTasks) {
    const approvalActivities = t.activities.filter(a => 
      ["approved", "rejected", "approved_receptionist", "rejected_receptionist"].includes(a.action)
    );
    const latestAction = approvalActivities[0]?.action;

    if (latestAction === "approved") {
      finalApprovedCount++;
      continue; // Done
    }

    const completedAct = t.activities.find(a => a.action === "status_changed" && a.details.includes("COMPLETED"));
    const startedAct = t.activities.find(a => a.action === "status_changed" && a.details.includes("STARTED"));
    
    const dTask: DashboardTask = {
      id: t.id,
      buildingName: t.building.nameAr || t.building.nameEn,
      unitName: t.unit?.name || t.unitNumber || null,
      assignedUserName: t.assignedTo.name || "Unknown",
      assignedUserRole: t.assignedTo.role,
      taskTitle: t.title,
      taskType: t.type,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      completedAt: completedAct?.createdAt || t.updatedAt,
      startedAt: startedAct?.createdAt || null,
      photos: t.photos.map(p => ({ id: p.id, url: p.photoUrl })),
    };

    if (latestAction === "rejected" || latestAction === "rejected_receptionist") {
      // If it was rejected but is currently in a terminal status, it means it was completed again
      // by the worker. So it needs receptionist review again.
      pendingReviewTasks.push(dTask);
    } else if (latestAction === "approved_receptionist") {
      const recApp = approvalActivities[0];
      dTask.actionTime = recApp.createdAt;
      approvedPendingSupervisorTasks.push(dTask);
    } else {
      // No approval actions yet
      pendingReviewTasks.push(dTask);
    }
  }

  // 2. Fetch Live Tasks (Active Statuses)
  const rawLiveTasks = await prisma.task.findMany({
    where: {
      ...buildingFilter,
      status: { in: ACTIVE_STATUSES },
    },
    include: {
      building: { select: { nameEn: true, nameAr: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, role: true } },
      photos: { select: { id: true, photoUrl: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 50
  });

  const liveTasks: DashboardTask[] = rawLiveTasks.map(t => ({
    id: t.id,
    buildingName: t.building.nameAr || t.building.nameEn,
    unitName: t.unit?.name || t.unitNumber || null,
    assignedUserName: t.assignedTo.name || "Unknown",
    assignedUserRole: t.assignedTo.role,
    taskTitle: t.title,
    taskType: t.type,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    completedAt: t.updatedAt, // not completed
    startedAt: null, // simplification
    photos: []
  }));

  // 3. Staff Performance Leaderboard
  const staffPerformance = await getEmployeeRanking(7, 0, selectedBuildingId === "ALL" ? undefined : selectedBuildingId || undefined);

  // 4. Units Status Grid
  const dbUnits = await prisma.buildingUnit.findMany({
    where: buildingFilter,
    include: {
      tasks: {
        where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { status: true, priority: true }
      }
    },
    orderBy: { name: "asc" }
  });

  const units: UnitStatusInfo[] = dbUnits.map(u => {
    let status: UnitStatusInfo["status"] = "ready";
    let icon: string | null = "✓";

    const hasIssue = u.tasks.some(t => t.priority === "URGENT" || t.priority === "HIGH");
    const isPendingAudit = u.tasks.some(t => TERMINAL_STATUSES.includes(t.status as TaskStatus));
    const isPendingCleaning = u.tasks.some(t => ACTIVE_STATUSES.includes(t.status as TaskStatus));

    if (hasIssue) {
      status = "issue";
      icon = "!";
    } else if (isPendingCleaning) {
      status = "pending_cleaning";
      icon = "🧹";
    } else if (isPendingAudit) {
      status = "pending_audit";
      icon = "⏳";
    }

    return {
      num: u.name,
      status,
      icon
    };
  });

  // 5. Today's Readiness Timeline
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTasks = await prisma.task.findMany({
    where: {
      ...buildingFilter,
      updatedAt: { gte: today }
    },
    include: {
      unit: { select: { name: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 15
  });

  const timeline: TimelineEvent[] = todayTasks.map(t => {
    let badge = "قيد المتابعة";
    let badgeClass = "bg-blue-100 text-blue-700";
    let badgeDot = "bg-blue-500";
    let desc = t.title;

    if (TERMINAL_STATUSES.includes(t.status as TaskStatus)) {
      badge = "بانتظار تدقيق";
      badgeClass = "bg-orange-100 text-orange-700";
      badgeDot = "bg-orange-500";
      desc = "بانتظار تدقيق نهائي";
    } else if (ACTIVE_STATUSES.includes(t.status as TaskStatus)) {
      badge = "جاري العمل";
      badgeClass = "bg-blue-100 text-blue-700";
      badgeDot = "bg-blue-500";
      desc = "العمل جاري في الوحدة";
    } else if (t.status === "ASSIGNED") {
      badge = "مطلوب عمل";
      badgeClass = "bg-orange-100 text-orange-700";
      badgeDot = "bg-orange-500";
      desc = "بانتظار العامل";
    }

    return {
      time: t.updatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      unit: t.unit?.name ? `الوحدة ${t.unit.name}` : (t.unitNumber ? `الوحدة ${t.unitNumber}` : "عام"),
      desc,
      badge,
      badgeClass,
      badgeDot
    };
  });

  return {
    stats: {
      pendingReviewCount: pendingReviewTasks.length,
      approvedPendingSupervisorCount: approvedPendingSupervisorTasks.length,
      finalApprovedCount
    },
    pendingReviewTasks,
    approvedPendingSupervisorTasks,
    liveTasks,
    staffPerformance,
    units,
    timeline
  };
}
