"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { startOfDay, parseISO } from "date-fns";
import type { UnitType } from "@prisma/client";

type PromotionRowInput = {
  buildingId: string | null;
  unitType: UnitType | null;
  regularPrice: number;
  promoPrice: number;
};

async function uploadPromotionImage(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileExtension = file.name.split(".").pop();
  const fileName = `promotions/${Date.now()}-${Math.random()
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

function parseRows(formData: FormData): PromotionRowInput[] {
  const raw = formData.get("rows") as string;
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid promotion rows payload");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("At least one condition row is required");
  }
  return parsed.map((r: any, idx: number) => {
    const regularPrice = Number(r.regularPrice);
    const promoPrice = Number(r.promoPrice);
    if (!Number.isFinite(regularPrice) || !Number.isFinite(promoPrice)) {
      throw new Error(`Row ${idx + 1}: prices must be numbers`);
    }
    if (regularPrice <= 0 || promoPrice <= 0) {
      throw new Error(`Row ${idx + 1}: prices must be greater than 0`);
    }
    return {
      buildingId: r.buildingId || null,
      unitType: (r.unitType || null) as UnitType | null,
      regularPrice,
      promoPrice,
    };
  });
}

export async function createPromotion(formData: FormData, locale: string) {
  const titleEn = formData.get("titleEn") as string;
  const titleAr = formData.get("titleAr") as string;
  const descriptionEn = (formData.get("descriptionEn") as string) || null;
  const descriptionAr = (formData.get("descriptionAr") as string) || null;
  const startDateRaw = formData.get("startDate") as string;
  const endDateRaw = formData.get("endDate") as string;
  const isActive = formData.get("isActive") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!titleEn || !titleAr || !startDateRaw || !endDateRaw) {
    throw new Error("Required fields are missing");
  }

  const startDate = startOfDay(parseISO(startDateRaw));
  const endDate = startOfDay(parseISO(endDateRaw));
  if (endDate < startDate) {
    throw new Error("End date must be on or after start date");
  }

  const rows = parseRows(formData);

  let imageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    imageUrl = await uploadPromotionImage(imageFile);
  }

  await prisma.promotion.create({
    data: {
      titleEn,
      titleAr,
      descriptionEn,
      descriptionAr,
      imageUrl,
      startDate,
      endDate,
      isActive,
      rows: { create: rows },
    },
  });

  revalidatePath(`/${locale}/admin/promotions`);
  revalidatePath(`/${locale}`);
  redirect(`/${locale}/admin/promotions`);
}

export async function updatePromotion(
  id: string,
  formData: FormData,
  locale: string,
) {
  const titleEn = formData.get("titleEn") as string;
  const titleAr = formData.get("titleAr") as string;
  const descriptionEn = (formData.get("descriptionEn") as string) || null;
  const descriptionAr = (formData.get("descriptionAr") as string) || null;
  const startDateRaw = formData.get("startDate") as string;
  const endDateRaw = formData.get("endDate") as string;
  const isActive = formData.get("isActive") === "on";
  const imageFile = formData.get("image") as File | null;

  if (!titleEn || !titleAr || !startDateRaw || !endDateRaw) {
    throw new Error("Required fields are missing");
  }

  const startDate = startOfDay(parseISO(startDateRaw));
  const endDate = startOfDay(parseISO(endDateRaw));
  if (endDate < startDate) {
    throw new Error("End date must be on or after start date");
  }

  const rows = parseRows(formData);

  const updateData: Record<string, unknown> = {
    titleEn,
    titleAr,
    descriptionEn,
    descriptionAr,
    startDate,
    endDate,
    isActive,
  };

  if (imageFile && imageFile.size > 0) {
    updateData.imageUrl = await uploadPromotionImage(imageFile);
  }

  // Replace the rows wholesale — simpler than diffing.
  await prisma.$transaction([
    prisma.promotion.update({ where: { id }, data: updateData }),
    prisma.promotionRow.deleteMany({ where: { promotionId: id } }),
    prisma.promotionRow.createMany({
      data: rows.map((r) => ({ ...r, promotionId: id })),
    }),
  ]);

  revalidatePath(`/${locale}/admin/promotions`);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/promotions/${id}`);
  redirect(`/${locale}/admin/promotions`);
}

export async function deletePromotion(id: string, locale: string) {
  await prisma.promotion.delete({ where: { id } });
  revalidatePath(`/${locale}/admin/promotions`);
  revalidatePath(`/${locale}`);
}

/**
 * Find the best (lowest-price) promo row matching the given unit
 * for a date range that falls fully inside an active promotion window.
 * Returns null if no promotion applies.
 */
export async function getActivePromotionForUnit(
  unitId: string,
  checkInDate: string,
  checkOutDate: string,
) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, buildingId: true, unitType: true },
  });
  if (!unit) return null;

  const start = startOfDay(parseISO(checkInDate));
  const end = startOfDay(parseISO(checkOutDate));
  if (end <= start) return null;

  // Promotion must fully cover [start, end-1] — i.e. promotion.startDate <= start AND promotion.endDate >= end-1.
  // We match on end-1 because checkOut is the morning of departure (no night booked on that date).
  const lastNight = new Date(end);
  lastNight.setDate(lastNight.getDate() - 1);

  const promotions = await prisma.promotion.findMany({
    where: {
      isActive: true,
      startDate: { lte: start },
      endDate: { gte: lastNight },
      rows: {
        some: {
          AND: [
            {
              OR: [{ buildingId: null }, { buildingId: unit.buildingId }],
            },
            {
              OR: [{ unitType: null }, { unitType: unit.unitType }],
            },
          ],
        },
      },
    },
    include: {
      rows: {
        where: {
          AND: [
            {
              OR: [{ buildingId: null }, { buildingId: unit.buildingId }],
            },
            {
              OR: [{ unitType: null }, { unitType: unit.unitType }],
            },
          ],
        },
      },
    },
  });

  let best: {
    promotion: (typeof promotions)[number];
    row: (typeof promotions)[number]["rows"][number];
  } | null = null;

  for (const p of promotions) {
    for (const r of p.rows) {
      if (!best || r.promoPrice < best.row.promoPrice) {
        best = { promotion: p, row: r };
      }
    }
  }

  if (!best) return null;

  return {
    promotionId: best.promotion.id,
    titleEn: best.promotion.titleEn,
    titleAr: best.promotion.titleAr,
    regularPrice: best.row.regularPrice,
    promoPrice: best.row.promoPrice,
  };
}
