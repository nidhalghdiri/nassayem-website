import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/tasks/:id/notes ─────────────────────────────────────────────────
// Body: { text: string }
export async function POST(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const [note] = await prisma.$transaction([
    prisma.taskNote.create({
      data: { taskId, userId: adminUser.id, text: body.text.trim() },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.taskActivity.create({
      data: {
        taskId,
        userId:  adminUser.id,
        action:  "note_added",
        details: `Note added: "${body.text.trim().slice(0, 80)}${body.text.trim().length > 80 ? "…" : ""}"`,
      },
    }),
  ]);

  return NextResponse.json(note, { status: 201 });
}
