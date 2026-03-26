import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/tasks/:id/photos ────────────────────────────────────────────────
// Accepts multipart/form-data with fields:
//   file   — the image file (required)
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

  const caption = (formData.get("caption") as string | null)?.trim() ?? null;

  // Upload to Supabase Storage in the task-photos bucket
  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `task-photos/${taskId}/${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("task-photos")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("task-photos")
    .getPublicUrl(storagePath);

  const [photo] = await prisma.$transaction([
    prisma.taskPhoto.create({
      data: {
        taskId,
        userId:   adminUser.id,
        photoUrl: urlData.publicUrl,
        caption,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.taskActivity.create({
      data: {
        taskId,
        userId:  adminUser.id,
        action:  "photo_uploaded",
        details: caption ? `Photo uploaded with caption: "${caption}"` : "Photo uploaded",
      },
    }),
  ]);

  return NextResponse.json(photo, { status: 201 });
}
