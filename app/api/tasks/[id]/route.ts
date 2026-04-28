import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canUpdateTaskStatus } from "@/lib/tasks/permissions";
import { STATUS_TRANSITIONS, TERMINAL_STATUSES } from "@/lib/tasks/statuses";
import { notifyTaskCompleted } from "@/lib/whatsapp";
import type { TaskStatus, TaskPriority } from "@prisma/client";

// Statuses that mean "task is done"
const COMPLETED_STATUSES: TaskStatus[] = [
  "CLEANING_COMPLETED",
  "NO_ISSUES",
  "WORK_COMPLETED",
  "COMPLETED",
];

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      building:   { select: { id: true, nameEn: true, nameAr: true } },
      createdBy:  { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      parentTask: { select: { id: true, title: true, type: true } },
      subTasks:   { select: { id: true, title: true, type: true, status: true } },
      notes: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      photos: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      inspectionChecklist: {
        include: {
          items: {
            orderBy: { displayOrder: "asc" }
          }
        }
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return NextResponse.json(task);
}

// ── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
// Accepts any combination of:
//   { status, priority, title, description, dueDate, assignedToId }
export async function PATCH(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { role: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const activities: { action: string; details: string }[] = [];

  // ── Status transition ─────────────────────────────────────────────────────
  if (body.status && body.status !== task.status) {
    const newStatus = body.status as TaskStatus;

    if (TERMINAL_STATUSES.includes(task.status as never)) {
      return NextResponse.json(
        { error: "Cannot change status of a completed or cancelled task" },
        { status: 422 },
      );
    }

    const isAssignedToActor = task.assignedToId === adminUser.id;
    if (!canUpdateTaskStatus(adminUser.role, task.assignedTo.role, isAssignedToActor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const validTransitions: string[] =
      (STATUS_TRANSITIONS as Record<string, Record<string, string[]>>)[task.type]?.[task.status] ?? [];
    if (!validTransitions.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${task.status} to ${newStatus}` },
        { status: 422 },
      );
    }

    // Inspection ISSUES_FOUND → COMPLETED requires all sub-tasks to be terminal
    if (task.type === "INSPECTION" && task.status === "ISSUES_FOUND" && newStatus === "COMPLETED") {
      const subTasks = await prisma.task.findMany({
        where: { parentTaskId: id },
        select: { status: true },
      });
      const allDone = subTasks.length > 0 && subTasks.every(
        (st) => TERMINAL_STATUSES.includes(st.status as never),
      );
      if (!allDone) {
        return NextResponse.json(
          { error: "All sub-tasks must be completed before closing this inspection." },
          { status: 422 },
        );
      }
    }

    updates.status = newStatus;
    activities.push({
      action:  "status_changed",
      details: `Status changed from ${task.status} to ${newStatus}`,
    });
  }

  // ── Other editable fields ─────────────────────────────────────────────────
  if (body.priority)     updates.priority    = body.priority as TaskPriority;
  if (body.title)        updates.title       = body.title as string;
  if (body.description !== undefined) updates.description = body.description as string;
  if (body.dueDate)      updates.dueDate     = new Date(body.dueDate as string);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: updates,
    include: {
      building:   { select: { nameEn: true } },
      assignedTo: { select: { name: true } },
    },
  });

  // Write activity entries
  if (activities.length > 0) {
    await prisma.taskActivity.createMany({
      data: activities.map((a) => ({
        taskId:  id,
        userId:  adminUser.id,
        action:  a.action,
        details: a.details,
      })),
    });
  }

  // Send WhatsApp notifications when task reaches a completed status
  if (updates.status && COMPLETED_STATUSES.includes(updates.status as TaskStatus)) {
    const [managersAndSupervisors, creator] = await Promise.all([
      prisma.adminUser.findMany({
        where: { role: { in: ["SUPERVISOR", "MANAGER"] }, whatsappNumber: { not: null } },
        select: { id: true, name: true, whatsappNumber: true, preferredLanguage: true },
      }),
      prisma.adminUser.findUnique({
        where: { id: task.createdById },
        select: { id: true, name: true, whatsappNumber: true, preferredLanguage: true },
      }),
    ]);

    // Deduplicate: include creator even if they're not a manager/supervisor
    const notifyMap = new Map(managersAndSupervisors.map((u) => [u.id, u]));
    if (creator?.whatsappNumber) notifyMap.set(creator.id, creator);

    const notifyUsers = Array.from(notifyMap.values()).filter((u) => u.whatsappNumber);

    if (notifyUsers.length > 0) {
      const completedByName = adminUser.name ?? adminUser.email.split("@")[0];
      notifyTaskCompleted({
        notifyUsers: notifyUsers.map((u) => ({
          name: u.name,
          whatsappNumber: u.whatsappNumber,
          preferredLanguage: u.preferredLanguage,
        })),
        taskTitle: task.title,
        completedByName,
        buildingName: updated.building?.nameEn ?? "",
        completedAt: new Date(),
        taskId: id,
      }).catch(console.error);
    }
  }

  return NextResponse.json(updated);
}
