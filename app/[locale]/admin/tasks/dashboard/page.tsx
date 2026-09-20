import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import DirectorDashboard from "@/components/admin/tasks/dashboard/DirectorDashboard";

export default async function TasksDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, adminUser] = await Promise.all([
    params,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null;

  const TERMINAL_STATUSES = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
  const ACTIVE_STATUSES = ["ASSIGNED", "CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"];

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

  const [totalAssigned, active, completed, delayed, buildings, staffUsers] = await Promise.all([
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
  ]);

  const stats = { totalAssigned, active, completed, delayed };

  // For now, render the Director Dashboard for MANAGER, we can add conditionals for other roles later
  return (
    <DirectorDashboard
      locale={locale}
      currentUserId={adminUser.id}
      currentUserRole={adminUser.role}
      stats={stats}
      buildings={buildings}
      assignableStaff={staffUsers}
    />
  );
}
