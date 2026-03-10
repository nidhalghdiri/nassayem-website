"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RentType, UnitType } from "@prisma/client";

export async function createUnit(formData: FormData, locale: string) {
  // 1. Extract Strings
  const buildingId = formData.get("buildingId") as string;
  const titleEn = formData.get("titleEn") as string;
  const titleAr = formData.get("titleAr") as string;
  const descriptionEn = formData.get("descriptionEn") as string;
  const descriptionAr = formData.get("descriptionAr") as string;

  // 2. Extract Enums
  const unitType = formData.get("unitType") as UnitType;
  const rentType = formData.get("rentType") as RentType;

  // 3. Extract & Convert Numbers
  const dailyPrice = formData.get("dailyPrice") as string;
  const monthlyPrice = formData.get("monthlyPrice") as string;
  const guests = parseInt((formData.get("guests") as string) || "1", 10);
  const bedrooms = parseInt((formData.get("bedrooms") as string) || "1", 10);
  const beds = parseInt((formData.get("beds") as string) || "1", 10);
  const bathrooms = parseInt((formData.get("bathrooms") as string) || "1", 10);

  // 4. Extract Booleans
  const isPublished = formData.get("isPublished") === "on";

  if (!buildingId || !titleEn || !titleAr) {
    throw new Error("Required fields are missing");
  }

  // 5. Insert into Database
  await prisma.unit.create({
    data: {
      buildingId,
      titleEn,
      titleAr,
      descriptionEn,
      descriptionAr,
      unitType,
      rentType,
      dailyPrice: dailyPrice ? parseFloat(dailyPrice) : null,
      monthlyPrice: monthlyPrice ? parseFloat(monthlyPrice) : null,
      guests,
      bedrooms,
      beds,
      bathrooms,
      isPublished,
    },
  });

  revalidatePath(`/${locale}/admin/units`);
  redirect(`/${locale}/admin/units`);
}

export async function updateUnit(
  id: string,
  formData: FormData,
  locale: string,
) {
  // Extract all the same fields as createUnit
  const buildingId = formData.get("buildingId") as string;
  const titleEn = formData.get("titleEn") as string;
  const titleAr = formData.get("titleAr") as string;
  const descriptionEn = formData.get("descriptionEn") as string;
  const descriptionAr = formData.get("descriptionAr") as string;

  const unitType = formData.get("unitType") as UnitType;
  const rentType = formData.get("rentType") as RentType;

  const dailyPrice = formData.get("dailyPrice") as string;
  const monthlyPrice = formData.get("monthlyPrice") as string;
  const isPublished = formData.get("isPublished") === "on";
  const guests = parseInt((formData.get("guests") as string) || "1", 10);
  const bedrooms = parseInt((formData.get("bedrooms") as string) || "1", 10);
  const beds = parseInt((formData.get("beds") as string) || "1", 10);
  const bathrooms = parseInt((formData.get("bathrooms") as string) || "1", 10);

  await prisma.unit.update({
    where: { id },
    data: {
      buildingId,
      titleEn,
      titleAr,
      descriptionEn,
      descriptionAr,
      unitType,
      rentType,
      dailyPrice: dailyPrice ? parseFloat(dailyPrice) : null,
      monthlyPrice: monthlyPrice ? parseFloat(monthlyPrice) : null,
      guests,
      bedrooms,
      beds,
      bathrooms,
      isPublished,
    },
  });

  revalidatePath(`/${locale}/admin/units`);
  revalidatePath(`/${locale}/properties/${id}`);
  redirect(`/${locale}/admin/units`);
}
