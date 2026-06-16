"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireManager } from "@/lib/adminAuth";

function revalidateItems() {
  revalidatePath("/en/admin/laundry/items");
  revalidatePath("/ar/admin/laundry/items");
}

// ── Create a laundry item type (MANAGER only) ──────────────────────────────────
export async function createLaundryItemType(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  try {
    await requireManager();
  } catch {
    return { error: "Only Managers can manage laundry items.", success: false };
  }

  const nameEn = (formData.get("nameEn") as string)?.trim();
  const nameAr = (formData.get("nameAr") as string)?.trim();
  const iconSvg = (formData.get("iconSvg") as string)?.trim() || null;

  if (!nameEn || !nameAr) {
    return { error: "Both English and Arabic names are required.", success: false };
  }

  const max = await prisma.laundryItemType.aggregate({ _max: { displayOrder: true } });
  await prisma.laundryItemType.create({
    data: {
      nameEn,
      nameAr,
      iconSvg,
      displayOrder: (max._max.displayOrder ?? -1) + 1,
    },
  });

  revalidateItems();
  return { error: null, success: true };
}

// ── Update a laundry item type (MANAGER only) ──────────────────────────────────
export async function updateLaundryItemType(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  try {
    await requireManager();
  } catch {
    return { error: "Only Managers can manage laundry items.", success: false };
  }

  const id = formData.get("id") as string;
  const nameEn = (formData.get("nameEn") as string)?.trim();
  const nameAr = (formData.get("nameAr") as string)?.trim();
  const iconSvg = (formData.get("iconSvg") as string)?.trim() || null;

  if (!id || !nameEn || !nameAr) {
    return { error: "Both English and Arabic names are required.", success: false };
  }

  await prisma.laundryItemType.update({
    where: { id },
    data: { nameEn, nameAr, iconSvg },
  });

  revalidateItems();
  return { error: null, success: true };
}

// ── Toggle active/retired (MANAGER only) ───────────────────────────────────────
// Retiring keeps history intact but hides the item from new requests.
export async function toggleLaundryItemActive(input: {
  id: string;
  isActive: boolean;
}): Promise<{ error: string | null; success: boolean }> {
  try {
    await requireManager();
  } catch {
    return { error: "Only Managers can manage laundry items.", success: false };
  }

  await prisma.laundryItemType.update({
    where: { id: input.id },
    data: { isActive: input.isActive },
  });

  revalidateItems();
  return { error: null, success: true };
}

// ── Delete a laundry item type (MANAGER only) ──────────────────────────────────
// Only allowed when the item has never been used on an order; otherwise the
// caller should retire it (toggleLaundryItemActive) to preserve history.
export async function deleteLaundryItemType(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  try {
    await requireManager();
  } catch {
    return { error: "Only Managers can manage laundry items.", success: false };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing item id.", success: false };

  const usage = await prisma.laundryOrderItem.count({ where: { itemTypeId: id } });
  if (usage > 0) {
    return {
      error: "This item is used by existing orders — retire it instead of deleting.",
      success: false,
    };
  }

  await prisma.laundryItemType.delete({ where: { id } });
  revalidateItems();
  return { error: null, success: true };
}
