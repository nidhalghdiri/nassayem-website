import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";
import { getEmployeeRanking, LeaderboardEmployee } from "./employeeRanking";

export type ReceptionistStats = {
  activeCount: number;
  dueCount: number;
  pendingReviewCount: number;
  approvedPendingSupervisorCount: number;
  finalApprovedCount: number;
};

export type DashboardTask = {
  id: string;
  buildingName: string;
  buildingNameEn: string;
  unitName: string | null;
  assignedUserName: string;
  assignedUserRole: string;
  taskTitle: string;
  taskType: string;
  priority: string;
  status: string;
  dueDate: Date;
  createdAt: Date;
  completedAt: Date;
  startedAt: Date | null;
  photos: { id: string; url: string }[];
  photoCount: number;
  actionTime?: Date;
};

export type UnitStatusInfo = {
  id: string;
  num: string;
  buildingId: string;
  buildingNameEn: string;
  buildingNameAr: string;
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
  /** All open (unfinished, not cancelled) tasks, soonest due first. */
  liveTasks: DashboardTask[];
  /** Open tasks due by the end of today (Oman time), incl. overdue. */
  dueTasks: DashboardTask[];
  staffPerformance: LeaderboardEmployee[];
  units: UnitStatusInfo[];
  timeline: TimelineEvent[];
};

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "WORK_COMPLETED", "COMPLETED", "NO_ISSUES"];
const ACTIVE_STATUSES: TaskStatus[] = ["ASSIGNED", "CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"];
// Anything not finished and not cancelled — what the receptionist still has open.
const OPEN_STATUSES: TaskStatus[] = [...ACTIVE_STATUSES, "ON_HOLD", "ISSUES_FOUND"];

// Oman is UTC+4 all year (no DST).
const OMAN_OFFSET_MS = 4 * 60 * 60 * 1000;
function endOfTodayInOman(): Date {
  const omanNow = new Date(Date.now() + OMAN_OFFSET_MS);
  omanNow.setUTCHours(23, 59, 59, 999);
  return new Date(omanNow.getTime() - OMAN_OFFSET_MS);
}

function toBuildingFilter(selectedBuildingId: string | null, assignedBuildingIds?: string[] | null) {
  if (selectedBuildingId && selectedBuildingId !== "ALL") return { buildingId: selectedBuildingId };
  if (assignedBuildingIds && assignedBuildingIds.length > 0) return { buildingId: { in: assignedBuildingIds } };
  return {};
}

export async function getReceptionistDashboardData(receptionistId: string, selectedBuildingId: string | null, assignedBuildingIds?: string[] | null): Promise<ReceptionistDashboardData> {
  const buildingFilter = toBuildingFilter(selectedBuildingId, assignedBuildingIds);

  const [rawTerminalTasks, rawLiveTasks, staffPerformance, unitsData] = await Promise.all([
    // 1. Fetch Terminal Tasks for Stats & Review Lists
    prisma.task.findMany({
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
    }),

    // 2. Fetch Live Tasks (all open tasks)
    prisma.task.findMany({
      where: {
        ...buildingFilter,
        status: { in: OPEN_STATUSES },
      },
      include: {
        building: { select: { nameEn: true, nameAr: true } },
        unit: { select: { name: true } },
        assignedTo: { select: { name: true, role: true } },
        _count: { select: { photos: true } },
      },
      orderBy: { dueDate: "asc" },
    }),

    // 3. Staff Performance Leaderboard
    getEmployeeRanking(7, 0, selectedBuildingId === "ALL" ? (assignedBuildingIds && assignedBuildingIds.length > 0 ? assignedBuildingIds : undefined) : selectedBuildingId || undefined),

    // 4 + 5. Units Status Grid & Today's Readiness Timeline
    getUnitsStatusData(selectedBuildingId, assignedBuildingIds),
  ]);

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
      buildingNameEn: t.building.nameEn,
      unitName: t.unit?.name || t.unitNumber || null,
      assignedUserName: t.assignedTo.name || "Unknown",
      assignedUserRole: t.assignedTo.role,
      taskTitle: t.title,
      taskType: t.type,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      completedAt: completedAct?.createdAt || t.updatedAt,
      startedAt: startedAct?.createdAt || null,
      photos: t.photos.map(p => ({ id: p.id, url: p.photoUrl })),
      photoCount: t.photos.length,
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

  const liveTasks: DashboardTask[] = rawLiveTasks.map(t => ({
    id: t.id,
    buildingName: t.building.nameAr || t.building.nameEn,
    buildingNameEn: t.building.nameEn,
    unitName: t.unit?.name || t.unitNumber || null,
    assignedUserName: t.assignedTo.name || "Unknown",
    assignedUserRole: t.assignedTo.role,
    taskTitle: t.title,
    taskType: t.type,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    completedAt: t.updatedAt, // not completed
    startedAt: null, // simplification
    photos: [],
    photoCount: t._count.photos,
  }));

  const dueCutoff = endOfTodayInOman();
  const dueTasks = liveTasks.filter(t => t.dueDate <= dueCutoff);

  return {
    stats: {
      activeCount: liveTasks.length,
      dueCount: dueTasks.length,
      pendingReviewCount: pendingReviewTasks.length,
      approvedPendingSupervisorCount: approvedPendingSupervisorTasks.length,
      finalApprovedCount
    },
    pendingReviewTasks,
    approvedPendingSupervisorTasks,
    liveTasks,
    dueTasks,
    staffPerformance,
    units: unitsData.units,
    timeline: unitsData.timeline,
  };
}

/**
 * Units Status grid + today's readiness timeline only. Used on its own by the
 * Manager and Supervisor dashboards, which don't need the rest of the
 * receptionist report (review lists, open tasks, staff ranking).
 */
export async function getUnitsStatusData(
  selectedBuildingId: string | null,
  assignedBuildingIds?: string[] | null,
): Promise<{ units: UnitStatusInfo[]; timeline: TimelineEvent[] }> {
  const buildingFilter = toBuildingFilter(selectedBuildingId, assignedBuildingIds);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [dbUnits, todayTasks] = await Promise.all([
    prisma.buildingUnit.findMany({
      where: buildingFilter,
      include: {
        building: { select: { id: true, nameEn: true, nameAr: true, shortName: true } },
        tasks: {
          where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          select: { status: true, priority: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.task.findMany({
      where: {
        ...buildingFilter,
        updatedAt: { gte: today }
      },
      include: {
        unit: { select: { name: true } }
      },
      orderBy: { updatedAt: "desc" },
      take: 15
    }),
  ]);

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
      id: u.id,
      num: u.name,
      buildingId: u.building.id,
      buildingNameEn: u.building.shortName || u.building.nameEn,
      buildingNameAr: u.building.shortName || u.building.nameAr,
      status,
      icon
    };
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

  return { units, timeline };
}
