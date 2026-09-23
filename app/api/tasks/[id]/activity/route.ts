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

  // If notes provided, add a task note
  if (notes) {
    let finalNote = notes;
    if (rating) finalNote = `★${rating} - ${notes}`;
    await prisma.taskNote.create({
      data: {
        taskId,
        userId: adminUser.id,
        text: finalNote,
      }
    });
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
