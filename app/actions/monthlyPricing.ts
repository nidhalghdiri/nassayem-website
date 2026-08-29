"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { UnitType } from "@prisma/client";

export async function getBuildingUnitTypes(buildingId: string) {
  const units = await prisma.unit.findMany({
    where: { buildingId },
    select: { unitType: true, monthlyPrice: true },
  });

  const map = new Map<UnitType, Set<number | null>>();
  
  for (const unit of units) {
    if (!map.has(unit.unitType)) {
      map.set(unit.unitType, new Set());
    }
    map.get(unit.unitType)!.add(unit.monthlyPrice);
  }

  const result: { unitType: UnitType; currentPrice: number | null | "MIXED" }[] = [];
  
  for (const [unitType, prices] of map.entries()) {
    if (prices.size === 1) {
      result.push({ unitType, currentPrice: Array.from(prices)[0] });
    } else {
      result.push({ unitType, currentPrice: "MIXED" });
    }
  }

  return result;
}

export async function updateMonthlyPrice(
  buildingId: string,
  unitType: UnitType,
  monthlyPrice: number | null,
  locale: string
) {
  await prisma.unit.updateMany({
    where: { buildingId, unitType },
    data: { monthlyPrice },
  });

  revalidatePath(`/${locale}/admin/pricing`);
  revalidatePath(`/${locale}/admin/pricing/monthly`);
  revalidatePath(`/${locale}/admin/units`);
  revalidatePath(`/${locale}/properties`);
  return { success: true };
}
