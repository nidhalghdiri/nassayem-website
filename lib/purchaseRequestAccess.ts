/**
 * Access rules for the Purchase Requests module.
 *
 * SUPERVISOR and the manager-level roles (MANAGER, ACCOUNTANT, ADMIN) may see and decide on requests for ALL buildings —
 * the same way getBuildingScopeFilter treats them (it returns null, i.e. no
 * restriction, for both roles).
 *
 * MAINTENANCE may only raise purchase requests and follow their OWN — they can
 * never see anyone else's, and never decide (see ownRequestsOnly /
 * canDecidePurchaseRequests). Every other role is forbidden.
 *
 * This must be enforced on the server in every page, Server Action and route
 * handler, including the photo proxy. The sidebar only hides the link.
 */

import type { AdminUser } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";

export const PURCHASE_REQUEST_ROLES = ["SUPERVISOR", "MANAGER", "ACCOUNTANT", "ADMIN", "MAINTENANCE"] as const;

/** Roles that may raise a new purchase request from the admin panel. */
export const PURCHASE_REQUEST_CREATOR_ROLES = ["SUPERVISOR", "MAINTENANCE"] as const;

export function canAccessPurchaseRequests(role: string | null | undefined): boolean {
  return (PURCHASE_REQUEST_ROLES as readonly string[]).includes(role ?? "");
}

export function canCreatePurchaseRequests(role: string | null | undefined): boolean {
  return (PURCHASE_REQUEST_CREATOR_ROLES as readonly string[]).includes(role ?? "");
}

/** Maintenance sees only the requests they raised themselves. */
export function ownRequestsOnly(role: string | null | undefined): boolean {
  return role === "MAINTENANCE";
}

/** Approving / rejecting is the supervisor step; maintenance never decides. */
export function canDecidePurchaseRequests(role: string | null | undefined): boolean {
  return canAccessPurchaseRequests(role) && !ownRequestsOnly(role);
}

/**
 * True when `user` may open this NetSuite request: everyone but maintenance
 * sees all requests; maintenance only the ones they created on the website.
 */
export async function canViewPurchaseRequest(
  user: Pick<AdminUser, "id" | "role">,
  netsuiteRequestId: string,
): Promise<boolean> {
  if (!ownRequestsOnly(user.role)) return true;
  const owned = await prisma.purchaseRequestOwner.findUnique({
    where: { netsuiteRequestId },
    select: { adminUserId: true },
  });
  return owned?.adminUserId === user.id;
}

/**
 * Returns the current user when they may use the module, or null otherwise
 * (not signed in, or a role without access). Callers decide how to react:
 * pages redirect, routes answer 401/403, actions return an error code.
 */
export async function getPurchaseRequestUser(): Promise<AdminUser | null> {
  const user = await getCurrentAdminUser();
  if (!user || !canAccessPurchaseRequests(user.role)) return null;
  return user;
}

/**
 * Same as getPurchaseRequestUser but throws, and only for roles that may decide
 * (not maintenance) — for the approve / reject Server Action.
 */
export async function requirePurchaseRequestUser(): Promise<AdminUser> {
  const user = await getPurchaseRequestUser();
  if (!user || !canDecidePurchaseRequests(user.role)) {
    throw new Error("Forbidden: supervisor or manager role required");
  }
  return user;
}

/** Throws unless the user may raise a purchase request (supervisor, maintenance). */
export async function requirePurchaseRequestCreator(): Promise<AdminUser> {
  const user = await getPurchaseRequestUser();
  if (!user || !canCreatePurchaseRequests(user.role)) {
    throw new Error("Forbidden: only supervisors and maintenance can create purchase requests");
  }
  return user;
}

/**
 * NetSuite location ids this user may act on, or null for "all buildings".
 *
 * Today both allowed roles see every building, so this is always null and
 * callers omit locationIds from the API call. It exists as the single place to
 * change if building scoping is added later — the API already supports
 * locationIds and answers FORBIDDEN_LOCATION when a request is out of scope.
 */
export async function getPurchaseRequestLocationScope(
  user: AdminUser,
): Promise<string[] | null> {
  void user;
  return null;
}
