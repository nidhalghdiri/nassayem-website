import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withVisibleTask } from "@/lib/mobileApi";
import { MOBILE_TASK_DETAIL_SELECT } from "@/lib/mobileTasks";
import { PATCH as updateTask } from "@/app/api/tasks/[id]/route";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/mobile/v1/tasks/:id ─────────────────────────────────────────────
// One task with notes, photos, recent activity, sub-tasks and the inspection
// checklist — only when the caller may see it.
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withVisibleTask(id, async () => {
    const task = await prisma.task.findUnique({ where: { id }, select: MOBILE_TASK_DETAIL_SELECT });
    return NextResponse.json({ task });
  });
}

// ── PATCH /api/mobile/v1/tasks/:id ───────────────────────────────────────────
// Status change ({ status, holdReason? }) through the website's handler, so the
// transition rules, timing stamps, activity log and WhatsApp alerts are shared.
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withVisibleTask(id, () => updateTask(request, context));
}
