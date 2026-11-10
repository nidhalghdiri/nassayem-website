// ─────────────────────────────────────────────────────────────────────────────
// Supervisor ("driver") laundry dashboard. Server-only. Pull model: any
// supervisor can take any order, so the task list is the shared queue.
//
// Tasks are derived from order status — nothing is scheduled:
//   REQUESTED        → "pickup"  : collect from the building, bring to laundry
//   READY            → "collect" : collect ready laundry + record the count
//   OUT_FOR_DELIVERY → "deliver" : deliver to the building (receptionist verifies)
// A task is "done today" when its stage timestamp falls on today (Oman time).
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { getItemLegs } from "./workflow";
import { SETTLED_EVENT } from "./dashboard";

const DAY_MS = 86_400_000;
const dayStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Muscat" });
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export type TaskKind = "pickup" | "collect" | "deliver";

export type SupervisorTask = {
  key: string;
  orderId: string;
  orderCode: string;
  kind: TaskKind;
  building: { nameEn: string; nameAr: string; shortName: string | null } | null;
  priority: string;
  done: boolean;
  /** Completion time if done, otherwise when the task became available (ISO). */
  at: string;
};

export type SupervisorDashboardData = {
  kpis: {
    remaining: number;
    completedToday: number;
    avgTripMin: number | null;
    discrepanciesToday: number;
  };
  /** Pending tasks first (by priority, then wait), then completed today. */
  tasks: SupervisorTask[];
  myDiscrepancies: {
    orderId: string;
    orderCode: string;
    building: { nameEn: string; nameAr: string; shortName: string | null } | null;
    shortage: number;
    surplus: number;
    settled: boolean;
  }[];
};

export async function getSupervisorDashboardData(adminUserId: string): Promise<SupervisorDashboardData> {
  const now = new Date();
  const today = dayStr(now);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const isToday = (d: Date | null) => !!d && dayStr(d) === today;

  const orders = await prisma.laundryOrder.findMany({
    where: {
      OR: [
        { status: { in: ["REQUESTED", "READY", "OUT_FOR_DELIVERY"] } },
        { atLaundryAt: { gte: weekAgo } },
        { outForDeliveryAt: { gte: weekAgo } },
        { deliveredAt: { gte: weekAgo } },
      ],
    },
    include: {
      building: { select: { nameEn: true, nameAr: true, shortName: true } },
      items: true,
      events: { where: { action: SETTLED_EVENT }, select: { id: true }, take: 1 },
    },
  });

  const pending: SupervisorTask[] = [];
  const done: SupervisorTask[] = [];
  const base = (o: (typeof orders)[number]) => ({
    orderId: o.id,
    orderCode: o.orderCode,
    building: o.building,
    priority: o.priority,
  });

  for (const o of orders) {
    // ── pending ──
    if (o.status === "REQUESTED")
      pending.push({ ...base(o), key: `${o.id}:pickup`, kind: "pickup", done: false, at: o.createdAt.toISOString() });
    if (o.status === "READY")
      pending.push({ ...base(o), key: `${o.id}:collect`, kind: "collect", done: false, at: (o.readyAt ?? o.createdAt).toISOString() });
    if (o.status === "OUT_FOR_DELIVERY")
      pending.push({ ...base(o), key: `${o.id}:deliver`, kind: "deliver", done: false, at: (o.outForDeliveryAt ?? o.createdAt).toISOString() });

    // ── completed today ──
    if (isToday(o.atLaundryAt))
      done.push({ ...base(o), key: `${o.id}:pickup:d`, kind: "pickup", done: true, at: o.atLaundryAt!.toISOString() });
    if (isToday(o.outForDeliveryAt))
      done.push({ ...base(o), key: `${o.id}:collect:d`, kind: "collect", done: true, at: o.outForDeliveryAt!.toISOString() });
    if (isToday(o.deliveredAt))
      done.push({ ...base(o), key: `${o.id}:deliver:d`, kind: "deliver", done: true, at: o.deliveredAt!.toISOString() });
  }

  pending.sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || (a.at < b.at ? -1 : 1),
  );
  done.sort((a, b) => (a.at < b.at ? -1 : 1));

  // ── My trips & discrepancies (orders I collected) ──
  const mine = orders.filter((o) => o.supervisorId === adminUserId);
  const trips = mine
    .filter((o) => o.outForDeliveryAt && o.deliveredAt && o.deliveredAt >= weekAgo)
    .map((o) => (o.deliveredAt!.getTime() - o.outForDeliveryAt!.getTime()) / 60_000);

  const myDiscrepancies: SupervisorDashboardData["myDiscrepancies"] = [];
  for (const o of mine) {
    if (!o.outForDeliveryAt || o.outForDeliveryAt < weekAgo || o.status === "CANCELLED") continue;
    let shortage = 0;
    let surplus = 0;
    for (const i of o.items) {
      for (const leg of getItemLegs({ atLaundryQty: i.atLaundryQty, returnedQty: i.returnedQty }) ) {
        if (leg.field !== "returnedQty") continue;
        if (leg.delta > 0) shortage += leg.delta;
        if (leg.delta < 0) surplus += -leg.delta;
      }
    }
    if (!shortage && !surplus) continue;
    myDiscrepancies.push({
      orderId: o.id,
      orderCode: o.orderCode,
      building: o.building,
      shortage,
      surplus,
      settled: o.events.length > 0,
    });
  }
  myDiscrepancies.sort((a, b) => Number(a.settled) - Number(b.settled));

  return {
    kpis: {
      remaining: pending.length,
      completedToday: done.length,
      avgTripMin: trips.length ? trips.reduce((a, b) => a + b, 0) / trips.length : null,
      discrepanciesToday: mine.filter((o) => isToday(o.outForDeliveryAt)).reduce((n, o) => {
        const has = o.items.some((i) => i.atLaundryQty !== null && i.returnedQty !== null && i.atLaundryQty !== i.returnedQty);
        return n + (has ? 1 : 0);
      }, 0),
    },
    tasks: [...pending, ...done],
    myDiscrepancies,
  };
}
