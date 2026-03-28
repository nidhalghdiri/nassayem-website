import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string; photoId: string }> };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "tasks", "photos");

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

  // Delete file from disk (best-effort)
  try {
    const filename = photo.photoUrl.split("/").pop();
    if (filename) {
      const filepath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
  } catch (err) {
    console.warn("Could not delete photo file:", err);
  }

  // Delete record
  await prisma.taskPhoto.delete({ where: { id: photoId } });

  return NextResponse.json({ success: true });
}
