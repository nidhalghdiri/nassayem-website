"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { uploadToR2 } from "@/lib/r2";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

export async function createPost(formData: FormData, locale: string) {
  const titleEn = formData.get("titleEn") as string;
  const titleAr = formData.get("titleAr") as string;
  const contentEn = formData.get("contentEn") as string;
  const contentAr = formData.get("contentAr") as string;
  const excerptEn = formData.get("excerptEn") as string;
  const excerptAr = formData.get("excerptAr") as string;
  const isPublished = formData.get("isPublished") === "on";

  // Slug: use titleEn for the slug
  let slug = generateSlug(titleEn);
  
  // Check if slug exists, append random if it does
  const existingPost = await prisma.post.findUnique({ where: { slug } });
  if (existingPost) {
    slug = `${slug}-${Math.random().toString(36).substring(7)}`;
  }

  // Extract the image file
  const imageFile = formData.get("image") as File;

  if (!titleEn || !titleAr || !contentEn || !contentAr) {
    throw new Error("Required fields are missing");
  }

  let coverImage = null;

  // Handle Cloudflare R2 Upload if an image was provided
  if (imageFile && imageFile.size > 0) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileExtension = imageFile.name.split(".").pop();
    const fileName = `blog/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    coverImage = await uploadToR2(fileName, buffer, imageFile.type || "image/jpeg");
  }

  await prisma.post.create({
    data: {
      titleEn,
      titleAr,
      contentEn,
      contentAr,
      excerptEn,
      excerptAr,
      slug,
      coverImage,
      isPublished,
    },
  });

  revalidatePath(`/${locale}/admin/blog`);
  revalidatePath(`/${locale}/blog`);
  revalidatePath(`/${locale}`);
  redirect(`/${locale}/admin/blog`);
}

export async function updatePost(
  id: string,
  formData: FormData,
  locale: string,
) {
  const titleEn = formData.get("titleEn") as string;
  const titleAr = formData.get("titleAr") as string;
  const contentEn = formData.get("contentEn") as string;
  const contentAr = formData.get("contentAr") as string;
  const excerptEn = formData.get("excerptEn") as string;
  const excerptAr = formData.get("excerptAr") as string;
  const isPublished = formData.get("isPublished") === "on";

  // Handle image upload if new one provided
  const imageFile = formData.get("image") as File;
  let coverImage = undefined;

  if (imageFile && imageFile.size > 0) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileExtension = imageFile.name.split(".").pop();
    const fileName = `blog/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    coverImage = await uploadToR2(fileName, buffer, imageFile.type || "image/jpeg");
  }

  await prisma.post.update({
    where: { id },
    data: {
      titleEn,
      titleAr,
      contentEn,
      contentAr,
      excerptEn,
      excerptAr,
      isPublished,
      coverImage: coverImage || undefined,
    },
  });

  revalidatePath(`/${locale}/admin/blog`);
  revalidatePath(`/${locale}/blog`);
  revalidatePath(`/${locale}/blog/${id}`); // and slug? but we use slug in URL
  // Fetch slug to revalidate correctly
  const post = await prisma.post.findUnique({ where: { id }, select: { slug: true } });
  if (post) {
    revalidatePath(`/${locale}/blog/${post.slug}`);
  }
  
  redirect(`/${locale}/admin/blog`);
}

export async function deletePost(id: string, locale: string) {
  // Optional: delete image from Supabase if needed
  await prisma.post.delete({ where: { id } });
  revalidatePath(`/${locale}/admin/blog`);
  revalidatePath(`/${locale}/blog`);
}
