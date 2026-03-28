import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

type RouteContext = { params: Promise<{ id: string }> };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "tasks", "photos");
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

// ── GET /api/tasks/:id/photos ─────────────────────────────────────────────────
export async function GET(_req: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const photos = await prisma.taskPhoto.findMany({
    where: { taskId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(photos);
}

// ── POST /api/tasks/:id/photos ────────────────────────────────────────────────
// Accepts multipart/form-data:
//   file    — image file (jpg/png/webp, max 10 MB)
//   caption — optional text caption
export async function POST(request: Request, { params }: RouteContext) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
      { status: 400 },
    );
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 400 },
    );
  }

  const caption = (formData.get("caption") as string | null)?.trim() ?? null;

  // Build unique filename
  const ext = file.name.split(".").pop() ?? "jpg";
  const safeName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
  const filename = `${taskId}_${Date.now()}_${safeName}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const publicUrl = `/uploads/tasks/photos/${filename}`;

  // Write to disk
  try {
    ensureUploadDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
  } catch (err) {
    console.error("Photo write error:", err);
    return NextResponse.json({ error: "Failed to save file." }, { status: 500 });
  }

  // Persist record + activity in transaction
  const [photo] = await prisma.$transaction([
    prisma.taskPhoto.create({
      data: {
        taskId,
        userId: adminUser.id,
        photoUrl: publicUrl,
        caption,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.taskActivity.create({
      data: {
        taskId,
        userId: adminUser.id,
        action: "photo_uploaded",
        details: caption
          ? `Photo uploaded with caption: "${caption}"`
          : "Photo uploaded",
      },
    }),
  ]);

  return NextResponse.json(photo, { status: 201 });
}
