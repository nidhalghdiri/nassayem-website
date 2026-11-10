// ─────────────────────────────────────────────────────────────────────────────
// Laundry-operator dashboard data. Server-only. The laundry role sees every
// order (see canSeeAllLaundry). Day bucketing is Oman time (UTC+4).
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import type { TLaundryStatus } from "./constants";
import { getItemLegs } from "./workflow";
import { SETTLED_EVENT } from "./dashboard";

const DAY_MS = 86_400_000;
const dayStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Muscat" });
const endOfDay = (d: Date) => new Date(`${dayStr(d)}T23:59:59.999+04:00`);
const QUEUE = ["REQUESTED", "AT_LAUNDRY", "PROCESSING"] as const;
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export type QueueRow = {
  id: string;
  orderCode: string;
  status: TLaundryStatus;
  building: { nameEn: string; nameAr: string; shortName: string | null } | null;
  pieces: number;
  priority: string;
  /** When the order entered this stage (ISO). */
  sinceAt: string;
  /** ms the order has sat in this stage. */
  waitingMs: number;
  overdue: boolean; // past its needed date
};

export type LaundryDashboardData = {
  kpis: {
    awaitingPickup: number;
    processingNow: number;
    readyForDriver: number;
    piecesReceivedToday: number;
    avgProcessingHours: number | null;
    readyOnTimePct: number | null;
  };
  queue: QueueRow[];
  workload: { id: string; nameEn: string; nameAr: string; shortName: string | null; pieces: number }[];
  reports: {
    orderId: string;
    orderCode: string;
    building: { nameEn: string; nameAr: string; shortName: string | null } | null;
    kind: "shortage" | "surplus" | "both";
    shortage: number;
    surplus: number;
    settled: boolean;
  }[];
};

export async function getLaundryDashboardData(): Promise<LaundryDashboardData> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const todayStart = new Date(`${dayStr(now)}T00:00:00+04:00`);

  const orders = await prisma.laundryOrder.findMany({
    where: {
      OR: [
        { status: { in: ["REQUESTED", "AT_LAUNDRY", "PROCESSING", "READY"] } },
        { createdAt: { gte: weekAgo } },
        { atLaundryAt: { gte: weekAgo } },
      ],
    },
    include: {
      building: { select: { id: true, nameEn: true, nameAr: true, shortName: true } },
      items: true,
      events: { where: { action: SETTLED_EVENT }, select: { id: true }, take: 1 },
    },
  });

  const pieces = (o: (typeof orders)[number]) => o.items.reduce((s, i) => s + i.requestedQty, 0);
  const sinceOf = (o: (typeof orders)[number]) =>
    o.status === "REQUESTED" ? o.createdAt
    : o.status === "AT_LAUNDRY" ? (o.atLaundryAt ?? o.createdAt)
    : (o.processingAt ?? o.atLaundryAt ?? o.createdAt);

  const queueOrders = orders.filter((o) => (QUEUE as readonly string[]).includes(o.status));

  const queue: QueueRow[] = queueOrders
    .map((o) => {
      const since = sinceOf(o);
      return {
        id: o.id,
        orderCode: o.orderCode,
        status: o.status as TLaundryStatus,
        building: o.building,
        pieces: pieces(o),
        priority: o.priority,
        sinceAt: since.toISOString(),
        waitingMs: now.getTime() - since.getTime(),
        overdue: endOfDay(o.neededDate) < now,
      };
    })
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
        (a.sinceAt < b.sinceAt ? -1 : 1),
    );

  // Pieces received into the laundry today (counted qty, falling back to requested).
  const piecesReceivedToday = orders
    .filter((o) => o.atLaundryAt && o.atLaundryAt >= todayStart)
    .reduce((s, o) => s + o.items.reduce((t, i) => t + (i.atLaundryQty ?? i.requestedQty), 0), 0);

  const processed = orders.filter((o) => o.processingAt && o.readyAt && o.readyAt >= weekAgo);
  const avgProcessingHours = processed.length
    ? processed.reduce((s, o) => s + (o.readyAt!.getTime() - o.processingAt!.getTime()) / 3_600_000, 0) / processed.length
    : null;
  const readyOnTime = processed.filter((o) => o.readyAt! <= endOfDay(o.neededDate)).length;

  // Workload: pieces currently sitting in the laundry's queue, per building.
  const wl = new Map<string, LaundryDashboardData["workload"][number]>();
  for (const o of queueOrders) {
    if (!o.building) continue;
    const cur = wl.get(o.building.id) ?? { ...o.building, pieces: 0 };
    cur.pieces += pieces(o);
    wl.set(o.building.id, cur);
  }

  // Count mismatches recorded at the laundry's own receipt count (last 7 days).
  const reports: LaundryDashboardData["reports"] = [];
  for (const o of orders) {
    if (o.status === "CANCELLED" || !o.atLaundryAt || o.atLaundryAt < weekAgo) continue;
    let shortage = 0;
    let surplus = 0;
    for (const i of o.items) {
      for (const leg of getItemLegs({ requestedQty: i.requestedQty, atLaundryQty: i.atLaundryQty })) {
        if (leg.field !== "atLaundryQty") continue;
        if (leg.delta > 0) shortage += leg.delta;
        if (leg.delta < 0) surplus += -leg.delta;
      }
    }
    if (!shortage && !surplus) continue;
    reports.push({
      orderId: o.id,
      orderCode: o.orderCode,
      building: o.building,
      kind: shortage && surplus ? "both" : shortage ? "shortage" : "surplus",
      shortage,
      surplus,
      settled: o.events.length > 0,
    });
  }
  reports.sort((a, b) => Number(a.settled) - Number(b.settled));

  return {
    kpis: {
      awaitingPickup: queue.filter((q) => q.status === "REQUESTED").length,
      processingNow: queue.filter((q) => q.status === "PROCESSING").length,
      readyForDriver: orders.filter((o) => o.status === "READY").length,
      piecesReceivedToday,
      avgProcessingHours,
      readyOnTimePct: processed.length ? Math.round((readyOnTime / processed.length) * 100) : null,
    },
    queue,
    workload: [...wl.values()].sort((a, b) => b.pieces - a.pieces),
    reports: reports.slice(0, 10),
  };
}
