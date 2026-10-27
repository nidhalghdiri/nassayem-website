"use server";

import { getCurrentAdminUser } from "@/lib/adminAuth";
import { getTechnicianVisits, type TechnicianVisitsData } from "@/lib/reports/technicianVisits";

/** Roles that may open the "الزيارات" tab on the Maintenance dashboard. */
const VISITS_ROLES = ["MANAGER", "SUPERVISOR", "MAINTENANCE"];

/**
 * Barcode visits logged by one technician, for the Maintenance dashboard's
 * "Visits" tab. Technicians may only read their own; managers and supervisors
 * can read any technician's (the dashboard's technician picker).
 */
export async function getTechnicianVisitsData(
  technicianId: string
): Promise<
  | { ok: true; data: TechnicianVisitsData }
  | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "SERVER" }
> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!VISITS_ROLES.includes(user.role)) return { ok: false, error: "FORBIDDEN" };

    // A technician is confined to their own visits; only MANAGER/SUPERVISOR
    // may pass someone else's id.
    const canViewOthers = user.role === "MANAGER" || user.role === "SUPERVISOR";
    if (!canViewOthers && technicianId !== user.id) {
      return { ok: false, error: "FORBIDDEN" };
    }

    return { ok: true, data: await getTechnicianVisits(technicianId) };
  } catch (err) {
    console.error("getTechnicianVisitsData failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
