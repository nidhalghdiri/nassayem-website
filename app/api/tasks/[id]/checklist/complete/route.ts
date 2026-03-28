import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/tasks/:id/checklist/complete ────────────────────────────────────
// Finalises the inspection:
//   - Marks completedAt on the checklist
//   - Moves task status → ISSUES_FOUND (if any fails) | NO_ISSUES (all pass/na)
//   - Logs a TaskActivity
//
// Body: { overallRating, inspectorNotes }
export async function POST(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const body = await request.json().catch(() => ({}));
  const { overallRating, inspectorNotes } = body as {
    overallRating?: string;
    inspectorNotes?: string;
  };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      inspectionChecklist: {
        include: { items: true },
      },
    },
  });

  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.type !== "INSPECTION") {
    return NextResponse.json({ error: "Task is not an inspection" }, { status: 400 });
  }

  const checklist = task.inspectionChecklist;
  if (!checklist) {
    return NextResponse.json({ error: "Checklist not found" }, { status: 404 });
  }

  if (checklist.completedAt) {
    return NextResponse.json({ error: "Inspection already completed" }, { status: 409 });
  }

  // Determine result
  const failedItems = checklist.items.filter((i) => i.status === "fail");
  const hasIssues = failedItems.length > 0;
  const newTaskStatus = hasIssues ? "ISSUES_FOUND" : "NO_ISSUES";

  const passedCount = checklist.items.filter((i) => i.status === "pass").length;
  const naCount = checklist.items.filter((i) => i.status === "na").length;
  const totalChecked = checklist.items.filter((i) => i.status !== "pending").length;

  const summaryDetails = [
    `Inspection completed: ${passedCount} passed, ${failedItems.length} failed, ${naCount} N/A out of ${totalChecked} items checked.`,
    overallRating ? `Overall rating: ${overallRating}.` : "",
    inspectorNotes ? `Notes: ${inspectorNotes}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  await prisma.$transaction([
    prisma.inspectionChecklist.update({
      where: { id: checklist.id },
      data: {
        completedAt: new Date(),
        ...(overallRating && { overallRating }),
        ...(inspectorNotes && { inspectorNotes }),
      },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: newTaskStatus },
    }),
    prisma.taskActivity.create({
      data: {
        taskId,
        userId: adminUser.id,
        action: "inspection_completed",
        details: summaryDetails,
      },
    }),
  ]);

  return NextResponse.json({ success: true, status: newTaskStatus, hasIssues });
}
