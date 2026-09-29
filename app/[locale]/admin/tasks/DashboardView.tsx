import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import DirectorDashboard from "@/components/admin/tasks/dashboard/DirectorDashboard";
import SupervisorDashboard from "@/components/admin/tasks/dashboard/SupervisorDashboard";
import ReceptionistDashboard from "@/components/admin/tasks/dashboard/ReceptionistDashboard";
import WorkerDashboard from "@/components/admin/tasks/dashboard/WorkerDashboard";
import { getEmployeeRanking } from "@/lib/reports/employeeRanking";
import { getBuildingPerformance } from "@/lib/reports/buildingPerformance";
import { getDashboardAlerts } from "@/lib/reports/alerts";
import { getSupervisorAuditData } from "@/lib/reports/supervisorAudit";
import { getReceptionistDashboardData, getUnitsStatusData } from "@/lib/reports/receptionistDashboard";
import { getWorkerDashboardData } from "@/lib/reports/workerDashboard";
import { getDashboardTabs, type TDashboardTab } from "@/lib/tasks/permissions";
import type { TaskStatus } from "@prisma/client";

// Each dashboard has its own route (/admin/tasks, /admin/tasks/supervisor,
// /admin/tasks/receptionist, /admin/tasks/worker) and loads only its own data.
// `dashboard` omitted = the user's default dashboard for their role.
export default async function DashboardView({
  params,
  searchParams,
  dashboard,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ building?: string; worker?: string }>;
  dashboard?: TDashboardTab;
}) {
  const [{ locale }, { building: selectedBuilding, worker: selectedWorkerId }, adminUser] = await Promise.all([
    params,
    searchParams,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  const allowed = getDashboardTabs(adminUser.role);
  if (dashboard && !allowed.includes(dashboard)) redirect(`/${locale}/admin/tasks`);
  const activeTab: TDashboardTab = dashboard ?? allowed[0];
  const isEn = locale === "en";

  const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
  const ACTIVE_STATUSES: TaskStatus[] = ["ASSIGNED", "CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"];

  // Receptionists are scoped to their assigned buildings
  let assignedBuildingIds: string[] | null = null;
  if (adminUser.role === "RECEPTIONIST") {
    const assigned = await prisma.adminUserBuilding.findMany({
      where: { adminUserId: adminUser.id },
      select: { buildingId: true },
    });
    assignedBuildingIds = assigned.map(b => b.buildingId);
  }

  let visibilityFilter: object = {};
  if (adminUser.role === "RECEPTIONIST") {
    visibilityFilter = { buildingId: { in: assignedBuildingIds ?? [] } };
  } else if (adminUser.role !== "MANAGER" && adminUser.role !== "SUPERVISOR") {
    visibilityFilter = { OR: [{ assignedToId: adminUser.id }, { createdById: adminUser.id }] };
  }

  // Shared fetch functions
  const getBuildings = () => prisma.building.findMany({
    where: assignedBuildingIds ? { id: { in: assignedBuildingIds } } : {},
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      shortName: true,
      buildingUnits: { select: { id: true, name: true } },
    },
    orderBy: { nameEn: "asc" },
  });

  // Receptionists see staff from their own buildings, plus every Housekeeping
  // and Maintenance user (these float between buildings, so they must always
  // be assignable from the Create Task form).
  const getStaffUsers = () => prisma.adminUser.findMany({
    where: assignedBuildingIds
      ? {
          OR: [
            { assignedBuildings: { some: { buildingId: { in: assignedBuildingIds } } } },
            { role: { in: ["HOUSEKEEPING", "MAINTENANCE"] } },
          ],
        }
      : {},
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  const getTodaysEmployeeNotes = () => prisma.employeeNote.findMany({
    where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    include: { employee: { select: { name: true } }, author: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  let content: ReactNode = null;

  if (activeTab === "manager") {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    fourteenDaysAgo.setHours(0,0,0,0);

    const [
      totalAssigned, active, completed, delayed,
      allCompletedTasks, trendTasksRaw, buildings, staffUsers,
      topEmployees, lastWeekEmployees, buildingPerformanceRaw,
      recentNotes, supervisorAuditData, unitsData, todaysEmployeeNotes
    ] = await Promise.all([
      prisma.task.count({ where: { ...visibilityFilter } }),
      prisma.task.count({ where: { status: { in: ACTIVE_STATUSES }, ...visibilityFilter } }),
      prisma.task.count({ where: { status: { in: TERMINAL_STATUSES }, ...visibilityFilter } }),
      prisma.task.count({ where: { dueDate: { lt: new Date() }, status: { notIn: TERMINAL_STATUSES }, ...visibilityFilter } }),
      prisma.task.findMany({ where: { status: { in: TERMINAL_STATUSES }, ...visibilityFilter }, select: { updatedAt: true, dueDate: true } }),
      prisma.task.findMany({ where: { status: { in: TERMINAL_STATUSES }, updatedAt: { gte: fourteenDaysAgo }, ...visibilityFilter }, select: { updatedAt: true } }),
      getBuildings(),
      getStaffUsers(),
      getEmployeeRanking(7, 0),
      getEmployeeRanking(7, 7),
      getBuildingPerformance(30),
      prisma.taskNote.findMany({
        where: { user: { role: { in: ["SUPERVISOR", "MANAGER"] } } },
        include: { user: { select: { name: true, role: true } }, task: { select: { title: true, status: true, building: { select: { nameEn: true, nameAr: true } } } } },
        orderBy: { createdAt: "desc" }, take: 6,
      }),
      getSupervisorAuditData(adminUser.id, adminUser.role),
      getUnitsStatusData(selectedBuilding || "ALL", assignedBuildingIds),
      getTodaysEmployeeNotes(),
    ]);

    const buildingPerformance = buildingPerformanceRaw as any;

    // "Waiting Audit" must match the Supervisor dashboard: completed tasks whose
    // latest review is not a final supervisor approval (approved tasks keep
    // their *_COMPLETED status, so a plain status count over-reports).
    const waitingAudit = supervisorAuditData.stats.pendingAuditsCount;
    const pendingAuditIds = supervisorAuditData.pendingAudits.map((a) => a.id);
    const alerts = await getDashboardAlerts(visibilityFilter, buildingPerformance);

    let onTime = 0;
    for (const t of allCompletedTasks) {
      if (t.updatedAt <= t.dueDate) onTime++;
    }
    const timeAdherence = allCompletedTasks.length > 0 ? Math.round((onTime / allCompletedTasks.length) * 100) : 100;

    const trendMap = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      trendMap.set(d.toISOString().split('T')[0], 0);
    }
    for (const t of trendTasksRaw) {
      const dStr = t.updatedAt.toISOString().split('T')[0];
      if (trendMap.has(dStr)) {
        trendMap.set(dStr, trendMap.get(dStr)! + 1);
      }
    }
    const trendData = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

    content = (
      <DirectorDashboard
        {...({
          locale, currentUserId: adminUser.id, currentUserRole: adminUser.role,
          stats: { totalAssigned, active, completed, delayed, timeAdherence, waitingAudit },
          trendData, buildings, assignableStaff: staffUsers, topEmployees, lastWeekEmployees,
          buildingPerformance, recentNotes, alerts, todaysEmployeeNotes, pendingAuditIds,
          buildingAuditStatus: supervisorAuditData.buildingAuditStatus,
          unitsStatus: unitsData.units, readinessTimeline: unitsData.timeline,
        } as any)}
      />
    );
  } else if (activeTab === "supervisor") {
    const [buildings, staffUsers, supervisorAuditData, unitsData, todaysEmployeeNotes] = await Promise.all([
      getBuildings(),
      getStaffUsers(),
      getSupervisorAuditData(adminUser.id, adminUser.role),
      getUnitsStatusData(selectedBuilding || "ALL", assignedBuildingIds),
      getTodaysEmployeeNotes(),
    ]);

    content = (
      <SupervisorDashboard
        {...({
          locale, currentUserId: adminUser.id, currentUserRole: adminUser.role,
          buildings, assignableStaff: staffUsers, stats: supervisorAuditData.stats,
          pendingAudits: supervisorAuditData.pendingAudits, buildingAuditStatus: supervisorAuditData.buildingAuditStatus,
          todaysEmployeeNotes, unitsStatus: unitsData.units, readinessTimeline: unitsData.timeline,
        } as any)}
      />
    );
  } else if (activeTab === "receptionist") {
    let finalSelectedBuilding = selectedBuilding || "ALL";
    if (adminUser.role === "RECEPTIONIST" && !selectedBuilding && assignedBuildingIds && assignedBuildingIds.length > 0) {
      finalSelectedBuilding = assignedBuildingIds[0];
    }

    const [buildings, assignableStaff, receptionistData] = await Promise.all([
      getBuildings(),
      getStaffUsers(),
      getReceptionistDashboardData(adminUser.id, finalSelectedBuilding, assignedBuildingIds)
    ]);

    content = (
      <ReceptionistDashboard
        locale={locale}
        currentUserId={adminUser.id}
        currentUserRole={adminUser.role}
        buildings={buildings}
        assignableStaff={assignableStaff}
        data={receptionistData}
        selectedBuilding={finalSelectedBuilding}
      />
    );
  } else {
    const targetWorkerId = (adminUser.role === "MANAGER" || adminUser.role === "SUPERVISOR") && selectedWorkerId
      ? selectedWorkerId
      : adminUser.id;

    const [workerData, staffUsers] = await Promise.all([
      getWorkerDashboardData(targetWorkerId),
      getStaffUsers()
    ]);

    content = (
      <WorkerDashboard
        {...({
          locale, currentUserId: adminUser.id, currentUserRole: adminUser.role,
          data: workerData, staffUsers, selectedWorkerId: targetWorkerId,
        } as any)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50" dir={isEn ? "ltr" : "rtl"}>
      {content}
    </div>
  );
}
