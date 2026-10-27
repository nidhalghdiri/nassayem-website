import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/tasks/:id/activity ───────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const activities = await prisma.taskActivity.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(activities);
}

// ── POST /api/tasks/:id/activity ───────────────────────────────────────────────
export async function POST(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;
  
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: { action: string; details: string; notes?: string; rating?: number; newStatus?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, details, notes, rating, newStatus } = body;
  if (!action || !details) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // A supervisor's approval must carry a deliberate 1-5 quality rating: it feeds
  // the "work quality" score in the employee-of-the-week report, so a silent
  // default would make that score meaningless.
  const isSupervisorApproval = action === "approved";
  if (isSupervisorApproval) {
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "A work quality rating from 1 to 5 is required to approve a task." },
        { status: 400 },
      );
    }
  }

  // Create activity
  const activity = await prisma.taskActivity.create({
    data: {
      taskId,
      userId: adminUser.id,
      action,
      details,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Store the rating and/or the note. The rating lives in the note text as
  // "★n - ...", so it must be written even when no note was typed — otherwise
  // the rating would be silently lost.
  if (notes || rating) {
    const trimmedNote = typeof notes === "string" ? notes.trim() : "";
    const finalNote = rating
      ? trimmedNote
        ? `★${rating} - ${trimmedNote}`
        : `★${rating}`
      : trimmedNote;
    if (finalNote) {
      await prisma.taskNote.create({
        data: {
          taskId,
          userId: adminUser.id,
          text: finalNote,
        }
      });
    }
  }

  // If newStatus is provided (e.g., rejecting sends it back to WORK_STARTED)
  if (newStatus && newStatus !== task.status) {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus as any },
    });
    
    await prisma.taskActivity.create({
      data: {
        taskId,
        userId: adminUser.id,
        action: "status_changed",
        details: `Status changed from ${task.status} to ${newStatus}`,
      },
    });
  }

  return NextResponse.json(activity);
}
