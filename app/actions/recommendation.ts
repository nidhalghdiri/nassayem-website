"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { requireManager } from "@/lib/adminAuth";
import { RecommendationCategory } from "@prisma/client";

// Parse a comma-separated string into a clean string[] (trim, drop empties).
function parseTagList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

async function uploadImage(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileExtension = file.name.split(".").pop() ?? "jpg";
  const fileName = `recommendations/${Date.now()}-${Math.random()
    .toString(36)
    .substring(7)}.${fileExtension}`;

  const { error } = await supabaseAdmin.storage
    .from("properties")
    .upload(fileName, buffer, { contentType: file.type });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage
    .from("properties")
    .getPublicUrl(fileName);
  return data.publicUrl;
}

export async function createRecommendation(
  formData: FormData,
  locale: string,
) {
  await requireManager();

  const titleEn = (formData.get("titleEn") as string)?.trim();
  const titleAr = (formData.get("titleAr") as string)?.trim();
  const descriptionEn = (formData.get("descriptionEn") as string)?.trim() || null;
  const descriptionAr = (formData.get("descriptionAr") as string)?.trim() || null;
  const category =
    (formData.get("category") as RecommendationCategory) || "OTHER";
  const mapUrl = (formData.get("mapUrl") as string)?.trim() || null;
  const tagsEn = parseTagList(formData.get("tagsEn") as string);
  const tagsAr = parseTagList(formData.get("tagsAr") as string);
  const displayOrder = parseInt(
    (formData.get("displayOrder") as string) || "0",
    10,
  );
  const isPublished = formData.get("isPublished") === "on";

  if (!titleEn || !titleAr) {
    throw new Error("Title in English and Arabic are required.");
  }

  let imageUrl: string | null = null;
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadImage(imageFile);
  }

  await prisma.recommendation.create({
    data: {
      titleEn,
      titleAr,
      descriptionEn,
      descriptionAr,
      category,
      imageUrl,
      mapUrl,
      tagsEn,
      tagsAr,
      displayOrder,
      isPublished,
    },
  });

  revalidatePath(`/${locale}/admin/recommendations`);
  revalidatePath(`/${locale}/recommendations`);
  redirect(`/${locale}/admin/recommendations`);
}

export async function updateRecommendation(
  id: string,
  formData: FormData,
  locale: string,
) {
  await requireManager();

  const titleEn = (formData.get("titleEn") as string)?.trim();
  const titleAr = (formData.get("titleAr") as string)?.trim();
  const descriptionEn = (formData.get("descriptionEn") as string)?.trim() || null;
  const descriptionAr = (formData.get("descriptionAr") as string)?.trim() || null;
  const category =
    (formData.get("category") as RecommendationCategory) || "OTHER";
  const mapUrl = (formData.get("mapUrl") as string)?.trim() || null;
  const tagsEn = parseTagList(formData.get("tagsEn") as string);
  const tagsAr = parseTagList(formData.get("tagsAr") as string);
  const displayOrder = parseInt(
    (formData.get("displayOrder") as string) || "0",
    10,
  );
  const isPublished = formData.get("isPublished") === "on";

  if (!titleEn || !titleAr) {
    throw new Error("Title in English and Arabic are required.");
  }

  let imageUrl: string | undefined; // undefined = don't change existing
  const imageFile = formData.get("image") as File | null;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadImage(imageFile);
  }

  await prisma.recommendation.update({
    where: { id },
    data: {
      titleEn,
      titleAr,
      descriptionEn,
      descriptionAr,
      category,
      mapUrl,
      tagsEn,
      tagsAr,
      displayOrder,
      isPublished,
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    },
  });

  revalidatePath(`/${locale}/admin/recommendations`);
  revalidatePath(`/${locale}/recommendations`);
  redirect(`/${locale}/admin/recommendations`);
}

export async function deleteRecommendation(id: string, locale: string) {
  await requireManager();
  await prisma.recommendation.delete({ where: { id } });
  revalidatePath(`/${locale}/admin/recommendations`);
  revalidatePath(`/${locale}/recommendations`);
}

export async function toggleRecommendationPublished(
  id: string,
  locale: string,
) {
  await requireManager();
  const existing = await prisma.recommendation.findUnique({
    where: { id },
    select: { isPublished: true },
  });
  if (!existing) throw new Error("Recommendation not found.");
  await prisma.recommendation.update({
    where: { id },
    data: { isPublished: !existing.isPublished },
  });
  revalidatePath(`/${locale}/admin/recommendations`);
  revalidatePath(`/${locale}/recommendations`);
}
