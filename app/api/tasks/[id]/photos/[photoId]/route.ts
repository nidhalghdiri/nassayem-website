import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
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

  // Delete from Supabase Storage
  try {
    // URL format: .../storage/v1/object/public/task-photos/taskId/filename.ext
    // We need "taskId/filename.ext"
    const urlParts = photo.photoUrl.split("task-photos/");
    if (urlParts.length > 1) {
      const storagePath = urlParts[1];
      const { error: storageError } = await supabaseAdmin.storage
        .from("task-photos")
        .remove([storagePath]);

      if (storageError) {
        console.warn("Could not delete from Supabase storage:", storageError);
      }
    }
  } catch (err) {
    console.warn("Error deleting from storage:", err);
  }

  // Delete record from DB
  await prisma.taskPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ success: true });
}
