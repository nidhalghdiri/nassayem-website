import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";

export type PendingAudit = {
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
  photos: { id: string; url: string }[];
};

export type SupervisorStats = {
  pendingAuditsCount: number;
  firstTimeAcceptanceRate: number; // percentage
  avgResponseTimeMins: number;
  lateBuildingsCount: number;
};

export type BuildingAuditStatus = {
  buildingId: string;
  name: string;
  lastAuditAt: Date | null;
  isLate: boolean;
};

export async function getSupervisorAuditData(supervisorId: string, role: string) {
  // Determine visibility
  let buildingFilter = {};
  if (role === "SUPERVISOR") {
    // Only buildings assigned to this supervisor
    const assigned = await prisma.adminUserBuilding.findMany({
      where: { adminUserId: supervisorId },
      select: { buildingId: true },
    });
    const buildingIds = assigned.map((b) => b.buildingId);
    if (buildingIds.length > 0) {
      buildingFilter = { buildingId: { in: buildingIds } };
    } else {
      // No buildings assigned, return empty data
      return {
        stats: { pendingAuditsCount: 0, firstTimeAcceptanceRate: 0, avgResponseTimeMins: 0, lateBuildingsCount: 0 },
        pendingAudits: [],
        buildingAuditStatus: [],
      };
    }
  }

  const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "WORK_COMPLETED"];

  // 1. Get all completed tasks (cleaning & maintenance) that need audit
  const rawPendingTasks = await prisma.task.findMany({
    where: {
      ...buildingFilter,
      status: { in: TERMINAL_STATUSES },
      // Tasks that don't have an "approved" or "rejected" activity yet
      activities: {
        none: { action: { in: ["approved", "rejected"] } },
      },
    },
    include: {
      building: { select: { nameEn: true, nameAr: true } },
      unit: { select: { name: true } },
      assignedTo: { select: { name: true, role: true } },
      photos: { select: { id: true, photoUrl: true } },
      activities: {
        where: { action: "status_changed", details: { contains: "COMPLETED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const pendingAudits: PendingAudit[] = rawPendingTasks.map(t => ({
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
    completedAt: t.activities[0]?.createdAt || t.updatedAt,
    photos: t.photos.map(p => ({ id: p.id, url: p.photoUrl })),
  }));

  // 2. Stats Calculation
  // First-time acceptance rate:
  // Look at tasks with at least one "approved" activity.
  // How many of them have ZERO "rejected" activities?
  const auditedTasks = await prisma.task.findMany({
    where: {
      ...buildingFilter,
      activities: { some: { action: "approved" } },
    },
    include: {
      activities: {
        where: { action: { in: ["approved", "rejected"] } }
      }
    }
  });

  let firstTimeAccepted = 0;
  for (const t of auditedTasks) {
    const hasRejected = t.activities.some(a => a.action === "rejected");
    if (!hasRejected) firstTimeAccepted++;
  }
  const firstTimeAcceptanceRate = auditedTasks.length > 0 
    ? Math.round((firstTimeAccepted / auditedTasks.length) * 100) 
    : 100;

  // Average response time: Time between task assigned and first activity (like status_changed to STARTED)
  // For simplicity, let's just mock it or calculate a rough estimate based on recent tasks
  const recentStartedTasks = await prisma.task.findMany({
    where: {
      ...buildingFilter,
      activities: { some: { action: "status_changed", details: { contains: "STARTED" } } }
    },
    include: {
      activities: { orderBy: { createdAt: "asc" } }
    },
    take: 50,
    orderBy: { createdAt: "desc" }
  });

  let totalMins = 0;
  let responseCount = 0;
  for (const t of recentStartedTasks) {
    const startAct = t.activities.find(a => a.action === "status_changed" && a.details.includes("STARTED"));
    if (startAct) {
      const diffMs = startAct.createdAt.getTime() - t.createdAt.getTime();
      if (diffMs > 0) {
        totalMins += (diffMs / (1000 * 60));
        responseCount++;
      }
    }
  }
  const avgResponseTimeMins = responseCount > 0 ? Math.round(totalMins / responseCount) : 0;

  // 3. Building Audit Status (Late Buildings)
  // Define "late" as no approved tasks or inspections in the last 24 hours.
  const buildings = await prisma.building.findMany({
    where: buildingFilter,
    select: { id: true, nameEn: true, nameAr: true },
  });

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const buildingAuditStatus: BuildingAuditStatus[] = [];
  let lateBuildingsCount = 0;

  for (const b of buildings) {
    // Find the latest approved activity in this building
    const latestAudit = await prisma.taskActivity.findFirst({
      where: {
        action: "approved",
        task: { buildingId: b.id },
      },
      orderBy: { createdAt: "desc" },
    });

    const isLate = !latestAudit || latestAudit.createdAt < oneDayAgo;
    if (isLate) lateBuildingsCount++;

    buildingAuditStatus.push({
      buildingId: b.id,
      name: b.nameAr || b.nameEn,
      lastAuditAt: latestAudit?.createdAt || null,
      isLate,
    });
  }
  
  // Sort buildings: late first, then by lastAuditAt descending
  buildingAuditStatus.sort((a, b) => {
    if (a.isLate && !b.isLate) return -1;
    if (!a.isLate && b.isLate) return 1;
    const aTime = a.lastAuditAt?.getTime() || 0;
    const bTime = b.lastAuditAt?.getTime() || 0;
    return bTime - aTime;
  });

  return {
    stats: {
      pendingAuditsCount: pendingAudits.length,
      firstTimeAcceptanceRate,
      avgResponseTimeMins,
      lateBuildingsCount,
    },
    pendingAudits,
    buildingAuditStatus,
  };
}
