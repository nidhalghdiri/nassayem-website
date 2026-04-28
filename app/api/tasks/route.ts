import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canCreateTasks, canSeeAllTasks, ASSIGNABLE_ROLES } from "@/lib/tasks/permissions";
import { getInitialStatus } from "@/lib/tasks/statuses";
import type { TaskType, TaskPriority, StaffRole } from "@prisma/client";

// ── GET /api/tasks ────────────────────────────────────────────────────────────
// Returns tasks visible to the current user, with optional query filters:
//   ?type=CLEANING&status=ASSIGNED&buildingId=...&assignedToId=...
//   &priority=HIGH&dueBefore=ISO&dueAfter=ISO&search=text
export async function GET(request: Request) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type       = searchParams.get("type") as TaskType | null;
  const status     = searchParams.get("status");
  const buildingId = searchParams.get("buildingId");
  const unitId     = searchParams.get("unitId");
  const assignedToId = searchParams.get("assignedToId");
  const priority   = searchParams.get("priority") as TaskPriority | null;
  const dueBefore  = searchParams.get("dueBefore");
  const dueAfter   = searchParams.get("dueAfter");
  const search     = searchParams.get("search");

  // Role-based visibility
  let visibilityFilter: object = {};
  if (canSeeAllTasks(adminUser.role)) {
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

  const tasks = await prisma.task.findMany({
    where: {
      ...visibilityFilter,
      ...(type       ? { type }                                   : {}),
      ...(status     ? { status: status as never }                : {}),
      ...(buildingId ? { buildingId }                             : {}),
      ...(unitId     ? { unitNumber: { contains: unitId, mode: "insensitive" as const } } : {}),
      ...(assignedToId ? { assignedToId }                         : {}),
      ...(priority   ? { priority }                               : {}),
      ...(dueBefore  ? { dueDate: { lte: new Date(dueBefore) } }  : {}),
      ...(dueAfter   ? { dueDate: { gte: new Date(dueAfter) } }   : {}),
      ...(search
        ? { title: { contains: search, mode: "insensitive" } }
        : {}),
    },
    include: {
      building:   { select: { id: true, nameEn: true, nameAr: true } },
      createdBy:  { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      _count:     { select: { notes: true, photos: true, subTasks: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

// ── POST /api/tasks ───────────────────────────────────────────────────────────
// Creates a new task. Body (JSON):
// { type, title, description?, buildingId, unitId?, priority, assignedToId,
//   dueDate, parentTaskId?, requiresApproval? }
export async function POST(request: Request) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canCreateTasks(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, title, buildingId, assignedToId, dueDate } = body;
  if (!type || !title || !buildingId || !assignedToId || !dueDate) {
    return NextResponse.json(
      { error: "type, title, buildingId, assignedToId, and dueDate are required" },
      { status: 400 },
    );
  }

  // Verify the assignee exists and the caller is allowed to assign to their role
  const assignee = await prisma.adminUser.findUnique({
    where: { id: assignedToId as string },
  });
  if (!assignee) {
    return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
  }
  const allowedRoles: StaffRole[] = ASSIGNABLE_ROLES[adminUser.role];
  if (!allowedRoles.includes(assignee.role)) {
    return NextResponse.json(
      { error: `Your role cannot assign tasks to ${assignee.role}` },
      { status: 403 },
    );
  }

  const requiresApproval = Boolean(body.requiresApproval);
  const initialStatus = getInitialStatus(type as TaskType, requiresApproval);

  const task = await prisma.task.create({
    data: {
      type:         type as TaskType,
      title:        title as string,
      description:  (body.description as string) ?? null,
      buildingId:   buildingId as string,
      unitNumber:   (body.unitNumber as string) ?? null,
      priority:     (body.priority as TaskPriority) ?? "MEDIUM",
      status:       initialStatus,
      createdById:  adminUser.id,
      assignedToId: assignedToId as string,
      dueDate:      new Date(dueDate as string),
      parentTaskId: (body.parentTaskId as string) ?? null,
      requiresApproval,
      approvalStatus: requiresApproval ? "PENDING" : null,
    },
  });

  // Auto-log creation activity
  await prisma.taskActivity.create({
    data: {
      taskId:  task.id,
      userId:  adminUser.id,
      action:  "task_created",
      details: `Task created and ${requiresApproval ? "submitted for approval" : `assigned to ${assignee.name ?? assignee.email}`}`,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
