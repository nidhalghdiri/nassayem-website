import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/tasks/:id/checklist ──────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const checklist = await prisma.inspectionChecklist.findUnique({
    where: { taskId },
    include: {
      items: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
    },
  });

  if (!checklist) return NextResponse.json(null);
  return NextResponse.json(checklist);
}

// ── PATCH /api/tasks/:id/checklist ────────────────────────────────────────────
// Update top-level checklist fields: overallRating, inspectorNotes
export async function PATCH(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const body = await request.json().catch(() => ({}));
  const { overallRating, inspectorNotes } = body as {
    overallRating?: string;
    inspectorNotes?: string;
  };

  const checklist = await prisma.inspectionChecklist.findUnique({ where: { taskId } });
  if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

  const updated = await prisma.inspectionChecklist.update({
    where: { id: checklist.id },
    data: {
      ...(overallRating !== undefined && { overallRating }),
      ...(inspectorNotes !== undefined && { inspectorNotes }),
    },
    include: {
      items: { orderBy: [{ category: "asc" }, { displayOrder: "asc" }] },
    },
  });

  return NextResponse.json(updated);
}
