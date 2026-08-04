import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { deleteFromR2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

// ── DELETE /api/tasks/:id/photos/:photoId ─────────────────────────────────────
// Only the uploader, a Manager, or a Supervisor can delete.
export async function DELETE(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, photoId } = await params;

  const photo = await prisma.taskPhoto.findUnique({
    where: { id: photoId },
  });

  if (!photo || photo.taskId !== taskId) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Permission: uploader, Manager, or Supervisor
  const isUploader = photo.userId === adminUser.id;
  const isManager = adminUser.role === "MANAGER";
  const isSupervisor = adminUser.role === "SUPERVISOR";

  if (!isUploader && !isManager && !isSupervisor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete from Storage (R2 or Supabase)
  try {
    if (photo.photoUrl.includes("supabase.co")) {
      const urlParts = photo.photoUrl.split("task-photos/");
      if (urlParts.length > 1) {
        const storagePath = urlParts[1];
        await supabaseAdmin.storage.from("task-photos").remove([storagePath]).catch(() => {});
      }
    } else {
      await deleteFromR2(photo.photoUrl).catch((err) => console.warn("R2 delete error:", err));
    }
  } catch (err) {
    console.warn("Error deleting from storage:", err);
  }

  // Delete record from DB
  await prisma.taskPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ success: true });
}
