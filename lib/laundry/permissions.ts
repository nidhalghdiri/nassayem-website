// ─────────────────────────────────────────────────────────────────────────────
// Role-based permission logic for the Laundry module.
// Safe to import in both Server and Client Components (no Prisma runtime).
// Building-scoped row visibility is enforced in the data layer
// (lib/adminAuth.getBuildingScopeFilter), mirroring the Tasks board.
// ─────────────────────────────────────────────────────────────────────────────

import type { TStaffRole } from "@/lib/tasks/constants";
import type { TLaundryStatus } from "./constants";
import { getForwardTransition, isTerminalLaundryStatus } from "./workflow";

/** Can this role create a laundry request? Receptionists request; managers may too. */
export function canCreateLaundryOrder(role: TStaffRole): boolean {
  return role === "RECEPTIONIST" || role === "MANAGER";
}

/**
 * Can this role see every laundry order? Managers and supervisors oversee all;
 * the laundry operator works the central laundry place so also sees all.
 * Receptionists are scoped to their assigned buildings in the data layer.
 */
export function canSeeAllLaundry(role: TStaffRole): boolean {
  return role === "MANAGER" || role === "SUPERVISOR" || role === "LAUNDRY";
}

/**
 * Can this role perform the forward handoff that leaves `status`?
 * Pull model: any user holding the step's role may act (building scope is
 * enforced separately). MANAGER may perform any step.
 */
export function canAdvanceLaundry(
  role: TStaffRole,
  status: TLaundryStatus,
): boolean {
  const transition = getForwardTransition(status);
  if (!transition) return false; // terminal — no forward step
  return role === "MANAGER" || role === transition.actorRole;
}

/**
 * Can this actor cancel the order at its current status?
 *  - MANAGER: any non-terminal order.
 *  - The receptionist who created it: only while still REQUESTED.
 *  - SUPERVISOR: while it is in their custody (REQUESTED or PICKED_UP).
 */
export function canCancelLaundry(
  role: TStaffRole,
  status: TLaundryStatus,
  isCreator: boolean,
): boolean {
  if (isTerminalLaundryStatus(status)) return false;
  if (role === "MANAGER") return true;
  if (isCreator && status === "REQUESTED") return true;
  if (role === "SUPERVISOR" && (status === "REQUESTED" || status === "PICKED_UP")) {
    return true;
  }
  return false;
}

/** Can this role manage the laundry item-type catalog? Managers only. */
export function canManageLaundryItems(role: TStaffRole): boolean {
  return role === "MANAGER";
}
