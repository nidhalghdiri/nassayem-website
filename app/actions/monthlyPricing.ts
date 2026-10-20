"use server";

// Admin actions for monthly pricing: one row per building + unit type, with an
// optional "شامل" (water + electricity included) and "غير شامل" rate.
// Manager-only. Rates are read by lib/monthlyPricing for the website and bot.

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { UnitType } from "@prisma/client";
import { requireManager } from "@/lib/adminAuth";

// Reject rates above this cap — surfaces typos like 25000 vs 250.
const MAX_MONTHLY_PRICE = 20000;

export type MonthlyGridRow = {
  buildingId: string;
  buildingNameEn: string;
  buildingNameAr: string;
  unitTypes: {
    unitType: UnitType;
    unitCount: number;
    inclusivePrice: number | null;
    exclusivePrice: number | null;
  }[];
};

/** Every building with the unit types it actually has, and their monthly rates. */
export async function getMonthlyPricingGrid(): Promise<MonthlyGridRow[]> {
  await requireManager();

  const [buildings, typeCounts, prices] = await Promise.all([
    prisma.building.findMany({
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.unit.groupBy({
      by: ["buildingId", "unitType"],
      _count: { _all: true },
    }),
    prisma.monthlyPrice.findMany(),
  ]);

  const priceOf = new Map(prices.map((p) => [`${p.buildingId}|${p.unitType}`, p]));
  const typeOrder = Object.values(UnitType);

  return buildings
    .map((b) => ({
      buildingId: b.id,
      buildingNameEn: b.nameEn,
      buildingNameAr: b.nameAr,
      unitTypes: typeCounts
        .filter((t) => t.buildingId === b.id)
        .sort((x, y) => typeOrder.indexOf(x.unitType) - typeOrder.indexOf(y.unitType))
        .map((t) => {
          const p = priceOf.get(`${b.id}|${t.unitType}`);
          return {
            unitType: t.unitType,
            unitCount: t._count._all,
            inclusivePrice: p?.inclusivePrice != null ? Number(p.inclusivePrice) : null,
            exclusivePrice: p?.exclusivePrice != null ? Number(p.exclusivePrice) : null,
          };
        }),
    }))
    .filter((b) => b.unitTypes.length > 0);
}

function validPrice(v: number | null): boolean {
  return v === null || (Number.isFinite(v) && v > 0 && v <= MAX_MONTHLY_PRICE);
}

/**
 * Save both rates for a building + unit type. Clearing both removes the row,
 * which stops monthly stays for that building + type.
 */
export async function saveMonthlyPrice(params: {
  buildingId: string;
  unitType: UnitType;
  inclusivePrice: number | null;
  exclusivePrice: number | null;
  locale: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireManager();
  const { buildingId, unitType, inclusivePrice, exclusivePrice, locale } = params;

  if (!Object.values(UnitType).includes(unitType)) {
    return { ok: false, error: "Invalid unit type." };
  }
  if (!validPrice(inclusivePrice) || !validPrice(exclusivePrice)) {
    return {
      ok: false,
      error:
        locale === "ar"
          ? `أدخل سعراً أكبر من صفر ولا يتجاوز ${MAX_MONTHLY_PRICE}.`
          : `Enter a price above 0 and at most ${MAX_MONTHLY_PRICE}.`,
    };
  }

  if (inclusivePrice === null && exclusivePrice === null) {
    await prisma.monthlyPrice.deleteMany({ where: { buildingId, unitType } });
  } else {
    await prisma.monthlyPrice.upsert({
      where: { buildingId_unitType: { buildingId, unitType } },
      update: { inclusivePrice, exclusivePrice },
      create: { buildingId, unitType, inclusivePrice, exclusivePrice },
    });
  }

  revalidatePath(`/${locale}/admin/pricing/monthly`);
  revalidatePath(`/${locale}/admin/units`);
  revalidatePath(`/${locale}/properties`, "layout");
  return { ok: true };
}
