// ─────────────────────────────────────────────────────────────────────────────
// Role-based permission logic for the Task Management module.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

import type { TStaffRole } from "./constants";

// ─── Who each role can assign tasks to ──────────────────────────────────────
export const ASSIGNABLE_ROLES: Record<TStaffRole, TStaffRole[]> = {
  MANAGER:      ["SUPERVISOR", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"],
  SUPERVISOR:   ["RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"],
  RECEPTIONIST: ["HOUSEKEEPING", "MAINTENANCE"],
  HOUSEKEEPING: [],   // cannot create regular tasks; uses maintenance requests
  MAINTENANCE:  [],
};

// ─── Capability checks ───────────────────────────────────────────────────────

/** Can this role create regular tasks and assign them to others? */
export function canCreateTasks(role: TStaffRole): boolean {
  return ["MANAGER", "SUPERVISOR", "RECEPTIONIST"].includes(role);
}

/** Can HouseKeeping submit a maintenance request (special flow)? */
export function canCreateMaintenanceRequest(role: TStaffRole): boolean {
  return role === "HOUSEKEEPING";
}

/** Can this role approve or reject a pending maintenance request? */
export function canApproveRequests(role: TStaffRole): boolean {
  return ["MANAGER", "SUPERVISOR"].includes(role);
}

/** Can this role spawn sub-tasks from an Inspection task? */
export function canSpawnSubtasks(role: TStaffRole): boolean {
  return ["MANAGER", "SUPERVISOR", "RECEPTIONIST"].includes(role);
}

/** Can this role see all tasks in the system (not just their own)? */
export function canSeeAllTasks(role: TStaffRole): boolean {
  return role === "MANAGER" || role === "SUPERVISOR";
}

/**
 * Can this actor update the status of a task?
 * Only the assigned user or a MANAGER may change task status.
 */
export function canUpdateTaskStatus(
  actorRole: TStaffRole,
  _assigneeRole: TStaffRole,
  isAssignedToActor: boolean,
): boolean {
  if (isAssignedToActor) return true;
  return actorRole === "MANAGER";
}
