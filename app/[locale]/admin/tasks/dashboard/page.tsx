import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import DashboardTabs from "@/components/admin/tasks/dashboard/DashboardTabs";
import { getEmployeeRanking } from "@/lib/reports/employeeRanking";
import { getBuildingPerformance } from "@/lib/reports/buildingPerformance";
import { getDashboardAlerts } from "@/lib/reports/alerts";
import { getSupervisorAuditData } from "@/lib/reports/supervisorAudit";
import { getReceptionistDashboardData } from "@/lib/reports/receptionistDashboard";
import { getWorkerDashboardData } from "@/lib/reports/workerDashboard";
import type { TaskStatus } from "@prisma/client";

export default async function TasksDashboardPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; building?: string; worker?: string }>;
}) {
  const [{ locale }, { building: selectedBuilding, worker: selectedWorkerId }, adminUser] = await Promise.all([
    params,
    searchParams,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
  const ACTIVE_STATUSES: TaskStatus[] = ["ASSIGNED", "CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"];

  let visibilityFilter: object = {};
  if (adminUser.role === "MANAGER" || adminUser.role === "SUPERVISOR") {
    visibilityFilter = {};
  } else if (adminUser.role === "RECEPTIONIST") {
    const assigned = await prisma.adminUserBuilding.findMany({
      where: { adminUserId: adminUser.id },
      select: { buildingId: true },
    });
    const buildingIds = assigned.map((b) => b.buildingId);
    visibilityFilter = buildingIds.length > 0
      ? { buildingId: { in: buildingIds } }
      : { buildingId: { in: [] } };
  } else {
    visibilityFilter = { OR: [{ assignedToId: adminUser.id }, { createdById: adminUser.id }] };
  }

  const [
    totalAssigned, 
    active, 
    completed, 
    delayed, 
    buildings, 
    staffUsers, 
    topEmployees, 
    lastWeekEmployees,
    buildingPerformanceRaw,
    recentNotes,
    supervisorAuditData,
    receptionistData,
    workerData
  ] = await Promise.all([
    prisma.task.count({ where: { ...visibilityFilter } }),
    prisma.task.count({ where: { status: { in: ACTIVE_STATUSES }, ...visibilityFilter } }),
    prisma.task.count({ where: { status: { in: TERMINAL_STATUSES }, ...visibilityFilter } }),
    prisma.task.count({
      where: {
        dueDate: { lt: new Date() },
        status: { notIn: TERMINAL_STATUSES },
        ...visibilityFilter,
      },
    }),
    prisma.building.findMany({
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        shortName: true,
        buildingUnits: { select: { id: true, name: true } },
      },
      orderBy: { nameEn: "asc" },
    }),
    prisma.adminUser.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    getEmployeeRanking(7, 0),
    getEmployeeRanking(7, 7), // last week
    getBuildingPerformance(30),
    prisma.taskNote.findMany({
      where: {
        user: { role: { in: ["SUPERVISOR", "MANAGER"] } }
      },
      include: {
        user: { select: { name: true, role: true } },
        task: { 
          select: { 
            title: true, 
            status: true,
            building: { select: { nameEn: true, nameAr: true } }
          } 
        }
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    getSupervisorAuditData(adminUser.id, adminUser.role),
    getReceptionistDashboardData(adminUser.id, selectedBuilding || "ALL"),
    getWorkerDashboardData(
      (adminUser.role === "MANAGER" || adminUser.role === "SUPERVISOR") && selectedWorkerId 
        ? selectedWorkerId 
        : adminUser.id
    ),
  ]);

  const buildingPerformance = buildingPerformanceRaw as any; // Type workaround if needed
  const alerts = await getDashboardAlerts(visibilityFilter, buildingPerformance);

  const stats = { totalAssigned, active, completed, delayed };

  const directorProps = {
    locale,
    currentUserId: adminUser.id,
    currentUserRole: adminUser.role,
    stats,
    buildings,
    assignableStaff: staffUsers,
    topEmployees,
    lastWeekEmployees,
    buildingPerformance,
    recentNotes,
    alerts,
  };

  const supervisorProps = {
    locale,
    currentUserId: adminUser.id,
    currentUserRole: adminUser.role,
    buildings,
    assignableStaff: staffUsers,
    stats: supervisorAuditData.stats,
    pendingAudits: supervisorAuditData.pendingAudits,
    buildingAuditStatus: supervisorAuditData.buildingAuditStatus,
  };

  const receptionistProps = {
    locale,
    currentUserId: adminUser.id,
    currentUserRole: adminUser.role,
    buildings,
    data: receptionistData,
    selectedBuilding: selectedBuilding || "ALL",
  };

  const workerProps = {
    locale,
    currentUserId: adminUser.id,
    currentUserRole: adminUser.role,
    data: workerData,
    staffUsers,
    selectedWorkerId: selectedWorkerId || adminUser.id,
  };

  return (
    <DashboardTabs
      locale={locale}
      currentUserId={adminUser.id}
      currentUserRole={adminUser.role}
      directorProps={directorProps}
      supervisorProps={supervisorProps}
      receptionistProps={receptionistProps}
      workerProps={workerProps}
    />
  );
}
