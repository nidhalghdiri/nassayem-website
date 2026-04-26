import { getCurrentAdminUser } from "@/lib/adminAuth";
import prisma from "@/lib/prisma";
import TaskBoard from "@/components/admin/tasks/TaskBoard";
import type { TaskType, TaskPriority, TaskStatus } from "@prisma/client";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TERMINAL_STATUSES: TaskStatus[] = [
  "CLEANING_COMPLETED",
  "NO_ISSUES",
  "WORK_COMPLETED",
  "COMPLETED",
  "CANCELLED",
];

const ACTIVE_STATUSES: TaskStatus[] = [
  "ASSIGNED",
  "CLEANING_STARTED",
  "INSPECTING",
  "WORK_STARTED",
  "IN_PROGRESS",
];

export default async function AdminTasksPage({ params, searchParams }: PageProps) {
  const [{ locale }, sp, adminUser] = await Promise.all([
    params,
    searchParams,
    getCurrentAdminUser(),
  ]);

  if (!adminUser) return null; // middleware redirects to login

  const type = sp.type as TaskType | undefined;
  const priority = sp.priority as TaskPriority | undefined;
  const status = sp.status as TaskStatus | undefined;
  const buildingId = sp.buildingId as string | undefined;
  const assignedToId = sp.assignedToId as string | undefined;
  const search = sp.search as string | undefined;

  const canSeeAll = adminUser.role === "MANAGER" || adminUser.role === "SUPERVISOR";

  const visibilityFilter = canSeeAll
    ? {}
    : { OR: [{ assignedToId: adminUser.id }, { createdById: adminUser.id }] };

  const [tasks, buildings, staffUsers] = await Promise.all([
    prisma.task.findMany({
      where: {
        ...visibilityFilter,
        ...(type ? { type } : {}),
        ...(priority ? { priority } : {}),
        ...(status ? { status } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(assignedToId ? { assignedToId } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      },
      include: {
        building: { select: { id: true, nameEn: true, nameAr: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { notes: true, photos: true, subTasks: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.adminUser.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Manager-only stats (across all tasks, not just filtered)
  let stats: {
    total: number;
    pendingApproval: number;
    active: number;
    overdue: number;
  } | null = null;

  if (canSeeAll) {
    const [total, pendingApproval, active, overdue] = await Promise.all([
      prisma.task.count({ where: { status: { notIn: TERMINAL_STATUSES } } }),
      prisma.task.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.task.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      prisma.task.count({
        where: {
          dueDate: { lt: new Date() },
          status: { notIn: TERMINAL_STATUSES },
        },
      }),
    ]);
    stats = { total, pendingApproval, active, overdue };
  }

  // Serialize Prisma Date objects for client component props
  const serializedTasks = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <TaskBoard
      tasks={serializedTasks}
      buildings={buildings}
      staffUsers={staffUsers}
      stats={stats}
      locale={locale}
      currentUserId={adminUser.id}
      currentUserRole={adminUser.role}
    />
  );
}
