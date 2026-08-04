"use server";

import prisma from "@/lib/prisma";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";
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

  // 1. Convert the file into a buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 2. Create a unique filename (e.g., unit-id/123456789-image.jpg)
  const fileExtension = file.name.split(".").pop();
  const fileName = `properties/${unitId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

  // 3. Upload to Cloudflare R2
  const publicUrl = await uploadToR2(fileName, buffer, file.type || "image/jpeg");

  // 4. Save the URL to Prisma
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

  // 5. Refresh the page
  revalidatePath(`/${locale}/admin/units/${unitId}/images`);
}

// Action to delete an image
export async function deleteUnitImage(
  imageId: string,
  imageUrl: string,
  unitId: string,
  locale: string,
) {
  try {
    if (imageUrl.includes("supabase.co")) {
      // Legacy Supabase image
      const urlParts = imageUrl.split("/properties/");
      const fileName = urlParts[urlParts.length - 1];
      await supabaseAdmin.storage.from("properties").remove([fileName]).catch(() => {});
    } else {
      // Cloudflare R2 image
      await deleteFromR2(imageUrl).catch((err) => console.error("R2 delete error:", err));
    }
  } catch (e) {
    console.error("Delete image error:", e);
  }

  await prisma.unitImage.delete({ where: { id: imageId } });
  revalidatePath(`/${locale}/admin/units/${unitId}/images`);
}
