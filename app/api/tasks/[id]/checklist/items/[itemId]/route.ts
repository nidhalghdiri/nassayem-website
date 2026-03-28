import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

// ── PATCH /api/tasks/:id/checklist/items/:itemId ──────────────────────────────
// Update status, notes, severity, photoUrls on a single checklist item.
export async function PATCH(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, itemId } = await params;

  const body = await request.json().catch(() => ({}));
  const { status, notes, severity, photoUrls, followUpTaskId } = body as {
    status?: string;
    notes?: string;
    severity?: string | null;
    photoUrls?: string[];
    followUpTaskId?: string | null;
  };

  // Validate the item belongs to this task's checklist
  const item = await prisma.inspectionChecklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: { select: { taskId: true } } },
  });

  if (!item || item.checklist.taskId !== taskId) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const updated = await prisma.inspectionChecklistItem.update({
    where: { id: itemId },
    data: {
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      ...(severity !== undefined && { severity }),
      ...(photoUrls !== undefined && { photoUrls }),
      ...(followUpTaskId !== undefined && { followUpTaskId }),
    },
  });

  return NextResponse.json(updated);
}
