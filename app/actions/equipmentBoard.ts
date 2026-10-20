"use server";

import { getCurrentAdminUser } from "@/lib/adminAuth";
import { loadEquipmentBoardData, type EquipmentBoardData } from "@/lib/maintenance/equipmentBoardData";

/** Roles that see the "Equipment list" tab on their Tasks dashboard. */
const EQUIPMENT_LIST_ROLES = ["MANAGER", "SUPERVISOR", "MAINTENANCE"];

/** Loads the equipment list for the dashboards' "Equipment list" tab (loaded when the tab opens). */
export async function getEquipmentBoardData(): Promise<
  { ok: true; data: EquipmentBoardData; role: string } | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "SERVER" }
> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!EQUIPMENT_LIST_ROLES.includes(user.role)) return { ok: false, error: "FORBIDDEN" };
    return { ok: true, data: await loadEquipmentBoardData(), role: user.role };
  } catch (err) {
    console.error("getEquipmentBoardData failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
