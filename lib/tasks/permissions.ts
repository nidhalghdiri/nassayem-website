// ─────────────────────────────────────────────────────────────────────────────
// Role-based permission logic for the Task Management module.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

import type { TStaffRole } from "./constants";

// ─── Who each role can assign tasks to ──────────────────────────────────────
// MANAGER and RECEPTIONIST include their own role so they can self-assign.
export const ASSIGNABLE_ROLES: Record<TStaffRole, TStaffRole[]> = {
  MANAGER:      ["MANAGER", "SUPERVISOR", "RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"],
  SUPERVISOR:   ["RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"],
  RECEPTIONIST: ["RECEPTIONIST", "HOUSEKEEPING", "MAINTENANCE"],
  HOUSEKEEPING: ["MAINTENANCE"], // can submit maintenance requests directly (no approval)
  MAINTENANCE:  [],
  LAUNDRY:      [], // laundry staff only handle laundry orders, not regular tasks
};

// ─── Capability checks ───────────────────────────────────────────────────────

/** Can this role create regular tasks and assign them to others? */
export function canCreateTasks(role: TStaffRole): boolean {
  return ["MANAGER", "SUPERVISOR", "RECEPTIONIST"].includes(role);
}

/**
 * Can this role create tasks ONLY for themselves (cannot assign to others)?
 * Every staff role may log their own work; only the roles in canCreateTasks()
 * may pick a different assignee. LAUNDRY is excluded — laundry staff work from
 * laundry orders, not tasks.
 */
export function canCreateSelfTasks(role: TStaffRole): boolean {
  return role !== "LAUNDRY";
}

/** Can this role open the create-task form at all (self or others)? */
export function canOpenCreateTask(role: TStaffRole): boolean {
  return canCreateTasks(role) || canCreateSelfTasks(role);
}

/**
 * Is this role restricted to self-assignment only? True when the role can
 * create tasks but cannot assign them to anyone else.
 */
export function isSelfOnlyCreator(role: TStaffRole): boolean {
  return canCreateSelfTasks(role) && !canCreateTasks(role);
}

/** Can HouseKeeping submit a maintenance request (kept as a simpler form). */
export function canCreateMaintenanceRequest(role: TStaffRole): boolean {
  return role === "HOUSEKEEPING";
}

/**
 * Can this role open the full "new maintenance request" modal?
 * MAINTENANCE is included so a technician can log a request for work they
 * found themselves — but it is always assigned to them (see
 * isSelfOnlyRequester), never routed to another technician.
 */
export function canOpenMaintenanceRequest(role: TStaffRole): boolean {
  return (canCreateTasks(role) && ASSIGNABLE_ROLES[role].includes("MAINTENANCE")) || role === "MAINTENANCE";
}

/**
 * Must this role's maintenance requests be assigned to themselves?
 * A technician logs their own finds; everyone else picks the technician.
 */
export function isSelfOnlyRequester(role: TStaffRole): boolean {
  return role === "MAINTENANCE";
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
 * Can this actor change a task's due date? Maintenance technicians juggle many
 * requests and pick the nearest location first, so they may reschedule their own
 * tasks; managers and supervisors may reschedule any task.
 */
export function canRescheduleTask(actorRole: TStaffRole, isAssignedToActor: boolean): boolean {
  if (actorRole === "MANAGER" || actorRole === "SUPERVISOR") return true;
  return actorRole === "MAINTENANCE" && isAssignedToActor;
}

// ─── Tasks dashboard tabs ────────────────────────────────────────────────────
export type TDashboardTab = "manager" | "supervisor" | "receptionist" | "worker" | "maintenance";

/** Dashboard tabs each role may open on /admin/tasks; the first is the default. */
export function getDashboardTabs(role: string): TDashboardTab[] {
  switch (role) {
    case "MANAGER":      return ["manager", "supervisor", "receptionist", "worker", "maintenance"];
    case "SUPERVISOR":   return ["supervisor"];
    case "RECEPTIONIST": return ["receptionist"];
    case "MAINTENANCE":  return ["maintenance"];
    default:             return ["worker"];
  }
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
  return actorRole === "MANAGER" || actorRole === "SUPERVISOR";
}
