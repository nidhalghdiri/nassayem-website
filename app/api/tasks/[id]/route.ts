import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { classifyTaskSize, parseExpectedHours, sizeNeedsApproval } from "@/lib/maintenance/taskSize";
import { canUpdateTaskStatus, canRescheduleTask, canCreateTasks } from "@/lib/tasks/permissions";
import type { TStaffRole } from "@/lib/tasks/constants";
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

/** Statuses that mean the work has actually begun. */
const WORK_STARTED_STATUSES = ["CLEANING_STARTED", "INSPECTING", "WORK_STARTED", "IN_PROGRESS"] as const;
/** Statuses that mean the work is finished (CANCELLED is not an outcome). */
const WORK_FINISHED_STATUSES = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED"] as const;

// Readable Oman-time stamp for the activity log, e.g. "13 Oct 2026, 09:00"
function formatOman(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Muscat", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      building:   { select: { id: true, nameEn: true, nameAr: true } },
      unit:       { select: { id: true, name: true } },
      createdBy:  { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
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
//   { status, holdReason?, priority, title, description, dueDate, assignedToId }
export async function PATCH(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { role: true } },
      _count: { select: { photos: true } }
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

    // Require at least one photo before completing any task (TEMPORARILY OPTIONAL)
    // if (COMPLETED_STATUSES.includes(newStatus as never) && task._count.photos === 0) {
    //   return NextResponse.json(
    //     { error: "You must attach at least one photo before completing this task." },
    //     { status: 422 },
    //   );
    // }

    updates.status = newStatus;
    activities.push({
      action:  "status_changed",
      details: `Status changed from ${task.status} to ${newStatus}`,
    });

    // ── Actual timing ───────────────────────────────────────────────────────
    // Stamped once each: the first time work starts, and when it finishes. Both
    // are only set "if not already present", so a task that is rejected and
    // redone keeps its original start.
    const now = new Date();
    const startsWork = (WORK_STARTED_STATUSES as readonly string[]).includes(newStatus);
    const finishesWork = (WORK_FINISHED_STATUSES as readonly string[]).includes(newStatus);

    if (startsWork && !task.startedAt) {
      updates.startedAt = now;
    }
    if (finishesWork && !task.completedAt) {
      updates.completedAt = now;
      // Actual duration in hours; needs a start to measure from.
      const start = task.startedAt ?? (updates.startedAt as Date | undefined) ?? null;
      if (start) {
        updates.actualHours = Math.round(((now.getTime() - start.getTime()) / 36e5) * 100) / 100;
      }
    }

    // Optional reason when pausing (e.g. "Thermostat — ordered from supplier");
    // shown on the Maintenance dashboard while the task is on hold.
    const holdReason = typeof body.holdReason === "string" ? body.holdReason.trim().slice(0, 300) : "";
    if (newStatus === "ON_HOLD" && holdReason) {
      activities.push({ action: "on_hold_reason", details: holdReason });
    }
  }

  // ── Other editable fields ─────────────────────────────────────────────────
  if (body.priority)     updates.priority    = body.priority as TaskPriority;
  if (body.title)        updates.title       = body.title as string;
  if (body.description !== undefined) updates.description = body.description as string;

  // ── Expected duration (re-classifies the size, and is always logged) ──────
  // Only roles that can assign work may change an estimate, and every change is
  // recorded with who made it and what it was before.
  if (body.expectedHours !== undefined) {
    if (!canCreateTasks(adminUser.role as TStaffRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const hours = parseExpectedHours(body.expectedHours);
    if (hours === null) {
      return NextResponse.json({ error: "Invalid expected duration" }, { status: 400 });
    }
    if (hours !== task.expectedHours) {
      const newSize = classifyTaskSize(hours);
      updates.expectedHours = hours;
      updates.taskSize = newSize;
      // A re-sized task must be approved again before it counts in full.
      if (newSize !== task.taskSize) {
        updates.sizeApprovedAt = null;
        updates.sizeApprovedById = null;
      }
      activities.push({
        action: "expected_hours_changed",
        details: `Expected duration changed from ${task.expectedHours ?? "—"}h to ${hours}h (size ${task.taskSize ?? "—"} → ${newSize ?? "—"})`,
      });
    }
  }

  // ── Reschedule (due date) ─────────────────────────────────────────────────
  if (body.dueDate) {
    if (!canRescheduleTask(adminUser.role, task.assignedToId === adminUser.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (TERMINAL_STATUSES.includes(task.status as never)) {
      return NextResponse.json({ error: "Cannot reschedule a completed or cancelled task" }, { status: 422 });
    }
    const newDue = new Date(body.dueDate as string);
    if (Number.isNaN(newDue.getTime())) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
    if (newDue.getTime() <= Date.now()) {
      return NextResponse.json({ error: "The new due date must be in the future" }, { status: 422 });
    }
    if (newDue.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "The new due date is too far ahead (90 days max)" }, { status: 422 });
    }
    if (newDue.getTime() !== task.dueDate.getTime()) {
      updates.dueDate = newDue;
      activities.push({
        action: "due_date_changed",
        details: `Due date changed from ${formatOman(task.dueDate)} to ${formatOman(newDue)}`,
      });
    }
  }

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

  // Notify only the task creator when a task reaches a completed status
  if (updates.status && COMPLETED_STATUSES.includes(updates.status as TaskStatus)) {
    const creator = await prisma.adminUser.findUnique({
      where: { id: task.createdById },
      select: { name: true, whatsappNumber: true, preferredLanguage: true },
    });

    if (creator?.whatsappNumber) {
      const completedByName = adminUser.name ?? adminUser.email.split("@")[0];
      notifyTaskCompleted({
        notifyUsers: [{ name: creator.name, whatsappNumber: creator.whatsappNumber, preferredLanguage: creator.preferredLanguage }],
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
