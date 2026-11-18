/**
 * Shared helpers for the staff mobile app's REST API (/api/mobile/v1/*).
 *
 * The app authenticates with the same signed session token the website keeps
 * in its cookie, sent as `Authorization: Bearer <token>` (see
 * getCurrentAdminUser). Responses are plain JSON; errors are `{ error }` with
 * a stable machine-readable `code` the app can translate.
 */
import { NextResponse } from "next/server";
import type { AdminUser } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewTask } from "@/lib/taskVisibility";

/** Oldest app build the API still supports; raise it to force an update. */
export const MIN_MOBILE_APP_VERSION = "1.0.0";

export type MobileErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "TOO_MANY_ATTEMPTS"
  | "VALIDATION"
  | "NOT_FOUND"
  | "REJECTED" // a valid request the business rules refused (e.g. blocked transition)
  | "SERVER";

export function mobileError(
  code: MobileErrorCode,
  status: number,
  message?: string,
): NextResponse {
  return NextResponse.json({ error: message ?? code, code }, { status });
}

/**
 * The signed-in staff member, or a ready-to-return 401 response.
 *
 *   const auth = await requireMobileUser();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireMobileUser(): Promise<AdminUser | NextResponse> {
  const user = await getCurrentAdminUser();
  return user ?? mobileError("UNAUTHORIZED", 401);
}

/** App sections the mobile app may show; mirrors the website's sidebar access. */
export type MobileModule = "tasks";

export function getMobileModules(role: string): MobileModule[] {
  // Every staff role except the laundry operator works with Tasks
  // (see ROLE_NAV_ACCESS in components/admin/AdminSidebar.tsx).
  return role === "LAUNDRY" ? [] : ["tasks"];
}

export type MobileBuilding = {
  id: string;
  shortName: string | null;
  nameEn: string;
  nameAr: string;
};

export const MOBILE_BUILDING_SELECT = {
  id: true,
  shortName: true,
  nameEn: true,
  nameAr: true,
} as const;

/** Buildings assigned to this staff member (receptionist building scope). */
export async function loadAssignedBuildings(
  adminUserId: string,
): Promise<MobileBuilding[]> {
  const rows = await prisma.adminUserBuilding.findMany({
    where: { adminUserId },
    select: { building: { select: MOBILE_BUILDING_SELECT } },
  });
  return rows.map((r) => r.building);
}

/** The profile shape the app receives from /login and /me. */
export function toMobileUser(
  user: AdminUser,
  buildings: MobileBuilding[],
) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    preferredLanguage: user.preferredLanguage === "ar" ? "ar" : "en",
    buildings,
    modules: getMobileModules(user.role),
  };
}

// ── Login throttling ─────────────────────────────────────────────────────────
// Best-effort and per server instance (Fluid Compute reuses instances, but
// there is no shared store), so it slows down password guessing from one
// client rather than guaranteeing a global limit.

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

export function isLoginThrottled(key: string): boolean {
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || entry.resetAt < now) {
    loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(key: string): void {
  loginFailures.delete(key);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

/**
 * Runs a mobile task route for a task the caller is allowed to see. Returns
 * 401 when signed out and 404 (not 403, so ids cannot be probed) when the task
 * does not exist or is outside the caller's visibility.
 */
export async function withVisibleTask(
  taskId: string,
  handler: (user: AdminUser) => Promise<Response>,
): Promise<Response> {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;
  if (!(await canViewTask(user, taskId))) return mobileError("NOT_FOUND", 404);
  return withMobileErrorCode(await handler(user));
}

/**
 * The website's task handlers answer errors as `{ error }` only. Adds the
 * mobile `code` from the HTTP status so the app can translate the error, and
 * keeps the original message for cases it shows as-is (e.g. a blocked
 * transition).
 */
export async function withMobileErrorCode(response: Response): Promise<Response> {
  if (response.ok) return response;
  const body = (await response.clone().json().catch(() => ({}))) as { error?: string; code?: string };
  if (body.code) return response;
  const code: MobileErrorCode =
    response.status === 401 ? "UNAUTHORIZED"
    : response.status === 403 ? "FORBIDDEN"
    : response.status === 404 ? "NOT_FOUND"
    : response.status === 400 ? "VALIDATION"
    : response.status >= 500 ? "SERVER"
    : "REJECTED";
  return NextResponse.json({ error: body.error ?? code, code }, { status: response.status });
}
