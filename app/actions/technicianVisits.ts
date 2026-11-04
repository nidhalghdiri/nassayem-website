"use server";

import { getCurrentAdminUser } from "@/lib/adminAuth";
import { getTechnicianVisits, type TechnicianVisitsData, type VisitFilters } from "@/lib/reports/technicianVisits";
import { hasManagerAccess } from "@/lib/tasks/constants";

/** Roles that may open the "الزيارات" tab on the Maintenance / Manager dashboards. */
const VISITS_ROLES = ["MANAGER", "ACCOUNTANT", "ADMIN", "SUPERVISOR", "MAINTENANCE"];

/**
 * Barcode visits for the dashboards' "Visits" tab. Technicians may only read
 * their own; managers and supervisors can read any technician's, or every
 * technician's at once (no technicianId — the Manager dashboard).
 */
export async function getTechnicianVisitsData(
  filters: VisitFilters
): Promise<
  | { ok: true; data: TechnicianVisitsData }
  | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "SERVER" }
> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!VISITS_ROLES.includes(user.role)) return { ok: false, error: "FORBIDDEN" };

    // A technician is confined to their own visits; only MANAGER/SUPERVISOR
    // may pass someone else's id or ask for everyone's.
    const canViewOthers = hasManagerAccess(user.role) || user.role === "SUPERVISOR";
    if (!canViewOthers && filters.technicianId !== user.id) {
      return { ok: false, error: "FORBIDDEN" };
    }

    return { ok: true, data: await getTechnicianVisits(filters) };
  } catch (err) {
    console.error("getTechnicianVisitsData failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
