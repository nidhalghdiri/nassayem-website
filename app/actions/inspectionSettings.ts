"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createCategory(formData: FormData, locale: string) {
  const nameEn = formData.get("nameEn") as string;
  const nameAr = formData.get("nameAr") as string;

  if (!nameEn || !nameAr) throw new Error("Missing names");

  await prisma.inspectionCategory.create({
    data: { nameEn, nameAr },
  });

  revalidatePath(`/${locale}/admin/settings`);
}

export async function updateCategory(id: string, formData: FormData, locale: string) {
  const nameEn = formData.get("nameEn") as string;
  const nameAr = formData.get("nameAr") as string;

  await prisma.inspectionCategory.update({
    where: { id },
    data: { nameEn, nameAr },
  });

  revalidatePath(`/${locale}/admin/settings`);
}

export async function deleteCategory(id: string, locale: string) {
  await prisma.inspectionCategory.delete({ where: { id } });
  revalidatePath(`/${locale}/admin/settings`);
}

export async function addItem(categoryId: string, formData: FormData, locale: string) {
  const labelEn = formData.get("labelEn") as string;
  const labelAr = formData.get("labelAr") as string;

  if (!labelEn || !labelAr) throw new Error("Missing labels");

  await prisma.inspectionItem.create({
    data: {
      categoryId,
      labelEn,
      labelAr,
    },
  });

  revalidatePath(`/${locale}/admin/settings`);
}

export async function deleteItem(id: string, locale: string) {
  await prisma.inspectionItem.delete({ where: { id } });
  revalidatePath(`/${locale}/admin/settings`);
}
