import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { uploadToR2 } from "@/lib/r2";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 400 },
    );
  }

  const caption = (formData.get("caption") as string | null)?.trim() ?? null;

  // Build unique path in R2 bucket
  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `task-photos/${taskId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

  // Upload to Cloudflare R2 Storage
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(filename, buffer, file.type || "image/jpeg");

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
  } catch (err) {
    console.error("Task photo error:", err);
    return NextResponse.json({ error: "Server error during photo upload." }, { status: 500 });
  }
}
