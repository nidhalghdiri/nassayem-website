import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canApproveRequests } from "@/lib/tasks/permissions";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/tasks/:id/approve ───────────────────────────────────────────────
// Approves a pending maintenance request (MANAGER / SUPERVISOR only).
// Moves status: PENDING_APPROVAL → ASSIGNED
// Sets approvalStatus = APPROVED, approvedById = current user
export async function POST(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canApproveRequests(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (task.status !== "PENDING_APPROVAL") {
    return NextResponse.json(
      { error: "Task is not awaiting approval" },
      { status: 422 },
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.task.update({
      where: { id },
      data: {
        status:         "ASSIGNED",
        approvalStatus: "APPROVED",
        approvedById:   adminUser.id,
      },
    }),
    prisma.taskActivity.create({
      data: {
        taskId:  id,
        userId:  adminUser.id,
        action:  "request_approved",
        details: "Maintenance request approved and assigned.",
      },
    }),
  ]);

  return NextResponse.json(updated);
}
