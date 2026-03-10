"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

export async function createBuilding(formData: FormData, locale: string) {
  const nameEn = formData.get("nameEn") as string;
  const nameAr = formData.get("nameAr") as string;
  const locationEn = formData.get("locationEn") as string;
  const locationAr = formData.get("locationAr") as string;
  const latitude = formData.get("latitude") as string;
  const longitude = formData.get("longitude") as string;
  const descriptionEn = formData.get("descriptionEn") as string;
  const descriptionAr = formData.get("descriptionAr") as string;

  // Extract the image file
  const imageFile = formData.get("image") as File;

  if (!nameEn || !nameAr || !locationEn || !locationAr) {
    throw new Error("Required fields are missing");
  }

  let imageUrl = null;

  // Handle Supabase Upload if an image was provided
  if (imageFile && imageFile.size > 0) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileExtension = imageFile.name.split(".").pop();
    const fileName = `buildings/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

    const { error } = await supabaseAdmin.storage
      .from("properties")
      .upload(fileName, buffer, { contentType: imageFile.type });

    if (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data } = supabaseAdmin.storage
      .from("properties")
      .getPublicUrl(fileName);
    imageUrl = data.publicUrl;
  }

  await prisma.building.create({
    data: {
      nameEn,
      nameAr,
      locationEn,
      locationAr,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      descriptionEn,
      descriptionAr,
      imageUrl, // Save the URL to the database
    },
  });

  revalidatePath(`/${locale}/admin/buildings`);
  revalidatePath(`/${locale}`); // Refresh the public home page too
  redirect(`/${locale}/admin/buildings`);
}

export async function updateBuilding(
  id: string,
  formData: FormData,
  locale: string,
) {
  const nameEn = formData.get("nameEn") as string;
  const nameAr = formData.get("nameAr") as string;
  const locationEn = formData.get("locationEn") as string;
  const locationAr = formData.get("locationAr") as string;
  const latitude = formData.get("latitude") as string;
  const longitude = formData.get("longitude") as string;
  const descriptionEn = formData.get("descriptionEn") as string;
  const descriptionAr = formData.get("descriptionAr") as string;

  // Handle optional image upload logic here if you want to replace it
  // (Assuming image upload logic is similar to createBuilding)

  await prisma.building.update({
    where: { id },
    data: {
      nameEn,
      nameAr,
      locationEn,
      locationAr,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      descriptionEn,
      descriptionAr,
      // imageUrl: imageUrl || undefined, // Only update if new image provided
    },
  });

  revalidatePath(`/${locale}/admin/buildings`);
  revalidatePath(`/${locale}/buildings/${id}`);
  redirect(`/${locale}/admin/buildings`);
}
