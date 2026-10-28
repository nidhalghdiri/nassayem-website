/**
 * Access rules for the Purchase Requests module.
 *
 * SUPERVISOR and MANAGER may see and decide on requests for ALL buildings —
 * the same way getBuildingScopeFilter treats them (it returns null, i.e. no
 * restriction, for both roles). Every other role is forbidden.
 *
 * This must be enforced on the server in every page, Server Action and route
 * handler, including the photo proxy. The sidebar only hides the link.
 */

import type { AdminUser } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";

export const PURCHASE_REQUEST_ROLES = ["SUPERVISOR", "MANAGER"] as const;

export function canAccessPurchaseRequests(role: string | null | undefined): boolean {
  return (PURCHASE_REQUEST_ROLES as readonly string[]).includes(role ?? "");
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
 * Same as getPurchaseRequestUser but throws — for Server Actions that should
 * fail loudly rather than silently no-op.
 */
export async function requirePurchaseRequestUser(): Promise<AdminUser> {
  const user = await getPurchaseRequestUser();
  if (!user) {
    throw new Error("Forbidden: supervisor or manager role required");
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
