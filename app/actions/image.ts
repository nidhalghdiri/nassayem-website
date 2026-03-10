"use server";

import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function uploadUnitImage(
  formData: FormData,
  unitId: string,
  locale: string,
) {
  const file = formData.get("image") as File;

  if (!file || file.size === 0) {
    throw new Error("Please select an image to upload.");
  }

  // 1. Convert the file into a format Supabase can upload
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. Create a unique filename (e.g., unit-id/123456789-image.jpg)
  const fileExtension = file.name.split(".").pop();
  const fileName = `${unitId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

  // 3. Upload to Supabase Storage (into the 'properties' bucket)
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("properties")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  // 4. Get the Public URL of the uploaded image
  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from("properties").getPublicUrl(fileName);

  // 5. Save the URL to Prisma
  // Check if it's the first image so we can set it as the Main cover photo
  const existingImagesCount = await prisma.unitImage.count({
    where: { unitId },
  });

  await prisma.unitImage.create({
    data: {
      unitId,
      url: publicUrl,
      isMain: existingImagesCount === 0,
      displayOrder: existingImagesCount,
    },
  });

  // 6. Refresh the page
  revalidatePath(`/${locale}/admin/units/${unitId}/images`);
}

// Action to delete an image
export async function deleteUnitImage(
  imageId: string,
  imageUrl: string,
  unitId: string,
  locale: string,
) {
  // Extract filename from the URL to delete from Supabase
  const urlParts = imageUrl.split("/properties/");
  const fileName = urlParts[urlParts.length - 1];

  await supabaseAdmin.storage.from("properties").remove([fileName]);
  await prisma.unitImage.delete({ where: { id: imageId } });

  revalidatePath(`/${locale}/admin/units/${unitId}/images`);
}
