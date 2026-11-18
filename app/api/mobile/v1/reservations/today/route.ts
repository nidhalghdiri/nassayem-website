import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { mobileError, requireMobileUser } from "@/lib/mobileApi";
import { fetchNetsuiteTodayMovements, type NetsuiteTodayMovements } from "@/lib/netsuite";
import { canSeeAllTasks } from "@/lib/tasks/permissions";

// Oman is UTC+4 all year (no daylight saving).
const OMAN_OFFSET_MS = 4 * 60 * 60 * 1000;
// NetSuite searches are slow; a dashboard refreshed by several receptionists
// at once should not run one search per pull-to-refresh.
const CACHE_MS = 60 * 1000;
const cache = new Map<string, { at: number; data: NetsuiteTodayMovements }>();

function omanToday(): string {
  return new Date(Date.now() + OMAN_OFFSET_MS).toISOString().slice(0, 10);
}

// ── GET /api/mobile/v1/reservations/today ────────────────────────────────────
// Today's check-ins and check-outs (Oman date) from NetSuite, for the front
// desk: a receptionist's own buildings, or every building for managers.
// { date, checkIns: { total, done }, checkOuts: { total, done } }
export async function GET() {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const role = user.role;
  if (role !== "RECEPTIONIST" && !canSeeAllTasks(role)) return mobileError("FORBIDDEN", 403);

  const buildings = await prisma.building.findMany({
    where: {
      netsuiteId: { not: null },
      ...(role === "RECEPTIONIST" ? { assignedStaff: { some: { adminUserId: user.id } } } : {}),
    },
    select: { netsuiteId: true },
  });
  const ids = buildings.map((b) => b.netsuiteId!).sort();
  const date = omanToday();
  if (ids.length === 0) {
    return NextResponse.json({ date, checkIns: { total: 0, done: 0 }, checkOuts: { total: 0, done: 0 } });
  }

  const key = `${date}|${ids.join(",")}`;
  let data = cache.get(key);
  if (!data || Date.now() - data.at > CACHE_MS) {
    const result = await fetchNetsuiteTodayMovements({ netsuiteBuildingIds: ids, date });
    if (!result.ok) {
      console.error("[mobile] today movements failed:", result.error);
      return mobileError("SERVER", 502, "NetSuite is not reachable right now.");
    }
    data = { at: Date.now(), data: result.data };
    cache.set(key, data);
  }

  const { arrivals, departures } = data.data;
  return NextResponse.json({
    date,
    checkIns: { total: arrivals.length, done: arrivals.filter((r) => r.done).length },
    checkOuts: { total: departures.length, done: departures.filter((r) => r.done).length },
  });
}
