import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import type { AdminUser } from "@prisma/client";
import {
  verifyAdminSessionToken,
  ADMIN_COOKIE_NAME,
} from "@/lib/authSession";

/**
 * Resolves the currently authenticated session → AdminUser record from PostgreSQL.
 * Returns null if not authenticated or no matching AdminUser exists.
 * Used in Server Components, Server Actions, and API route handlers.
 */
export async function getCurrentAdminUser(): Promise<AdminUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
    if (!sessionCookie?.value) return null;

    const payload = await verifyAdminSessionToken(sessionCookie.value);
    if (!payload?.id) return null;

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: payload.id },
    });

    return adminUser;
  } catch {
    return null;
  }
}

/**
 * Throws if the caller is not a MANAGER. Use at the top of every
 * mutation that should be manager-restricted (Pricing, Promotions, etc.).
 */
export async function requireManager(): Promise<AdminUser> {
  const user = await getCurrentAdminUser();
  if (!user || user.role !== "MANAGER") {
    throw new Error("Forbidden: manager role required");
  }
  return user;
}

/**
 * Returns a Prisma `where` fragment that scopes building-owned records to the
 * buildings a user is allowed to see, or `null` when the user may see all rows.
 *
 *   - MANAGER / SUPERVISOR → `null` (no restriction).
 *   - RECEPTIONIST         → `{ buildingId: { in: [...assigned building ids] } }`.
 *                            An empty array means "sees nothing".
 *   - any other role       → `{ buildingId: { in: [] } }` (sees nothing).
 *
 * This is strict: records with a null `buildingId` are excluded for
 * receptionists, since they cannot be attributed to an assigned building.
 * Mirrors the visibility logic already used by the Tasks board.
 */
export async function getBuildingScopeFilter(
  user: AdminUser,
): Promise<{ buildingId: { in: string[] } } | null> {
  if (user.role === "MANAGER" || user.role === "SUPERVISOR") return null;
  if (user.role === "RECEPTIONIST") {
    const assigned = await prisma.adminUserBuilding.findMany({
      where: { adminUserId: user.id },
      select: { buildingId: true },
    });
    return { buildingId: { in: assigned.map((b) => b.buildingId) } };
  }
  return { buildingId: { in: [] } };
}

/**
 * Authorizes the current admin user to mutate a specific booking (status change
 * or delete). MANAGER / SUPERVISOR may act on any booking; building-scoped roles
 * (RECEPTIONIST) only on bookings whose unit belongs to one of their assigned
 * buildings. Throws "Forbidden" otherwise. Call at the top of booking mutations.
 */
export async function assertCanManageBooking(bookingId: string): Promise<void> {
  const user = await getCurrentAdminUser();
  if (!user) throw new Error("Forbidden");

  const scope = await getBuildingScopeFilter(user);
  if (scope === null) return; // unrestricted (MANAGER / SUPERVISOR)

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { unit: { select: { buildingId: true } } },
  });
  if (!booking || !scope.buildingId.in.includes(booking.unit.buildingId)) {
    throw new Error("Forbidden: booking is outside your assigned buildings");
  }
}
