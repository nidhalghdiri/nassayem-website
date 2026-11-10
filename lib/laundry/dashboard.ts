// ─────────────────────────────────────────────────────────────────────────────
// Manager laundry dashboard — period parsing + metric aggregation.
// Server-only (uses Prisma). All day bucketing is done in Oman time (UTC+4).
//
// "Open discrepancy" = a non-cancelled order with a shortage/surplus on any
// custody leg that has no `discrepancy_settled` LaundryEvent yet. No schema
// change: settling is recorded as an event (see settleLaundryDiscrepancy).
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { COUNT_STAGES, type TLaundryCountField } from "./constants";
import { getItemLegs, type ItemCounts } from "./workflow";

export const SETTLED_EVENT = "discrepancy_settled";
const TZ = "Asia/Muscat";
const TZ_OFFSET = "+04:00";
const DAY_MS = 86_400_000;

// ─── Period ──────────────────────────────────────────────────────────────────

export type PeriodKey = "today" | "7d" | "30d" | "custom";

export type Period = {
  key: PeriodKey;
  from: Date;
  to: Date; // inclusive end
  fromStr: string; // YYYY-MM-DD (Oman)
  toStr: string;
  days: number;
};

const dayStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const startOfDay = (s: string) => new Date(`${s}T00:00:00${TZ_OFFSET}`);
const endOfDay = (s: string) => new Date(`${s}T23:59:59.999${TZ_OFFSET}`);
const isDayStr = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(startOfDay(s).getTime());

export function resolvePeriod(sp: { period?: string; from?: string; to?: string }): Period {
  const now = new Date();
  const todayStr = dayStr(now);
  let key: PeriodKey = sp.period === "today" || sp.period === "30d" || sp.period === "custom" ? sp.period : "7d";
  let fromStr = todayStr;
  let toStr = todayStr;

  if (key === "custom" && isDayStr(sp.from) && isDayStr(sp.to)) {
    fromStr = sp.from!;
    toStr = sp.to!;
    if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];
  } else {
    if (key === "custom") key = "7d"; // invalid custom range → default
    const span = key === "today" ? 0 : key === "30d" ? 29 : 6;
    fromStr = dayStr(new Date(now.getTime() - span * DAY_MS));
  }

  const from = startOfDay(fromStr);
  const to = endOfDay(toStr);
  const days = Math.round((startOfDay(toStr).getTime() - from.getTime()) / DAY_MS) + 1;
  return { key, from, to, fromStr, toStr, days };
}

// ─── Result types ────────────────────────────────────────────────────────────

export type Rating = "good" | "medium" | "weak";

export type DashboardData = {
  period: { key: PeriodKey; fromStr: string; toStr: string; days: number };
  kpis: {
    orders: number;
    avgCycleHours: number | null;
    onTimePct: number | null;
    noDiscrepancyPct: number | null;
    totalPieces: number;
    avgDriverResponseMin: number | null;
    activeNow: number;
    openReportsNow: number;
  };
  pipeline: { status: string; count: number; avgHours: number | null }[];
  buildings: {
    id: string;
    nameEn: string;
    nameAr: string;
    shortName: string | null;
    orders: number;
    avgCycleHours: number | null;
    onTimePct: number | null;
    shortagePieces: number;
    surplusPieces: number;
    rating: Rating | null;
  }[];
  drivers: {
    id: string;
    name: string;
    orders: number;
    avgTripMin: number | null;
    accuracyPct: number | null;
  }[];
  trend: { date: string; count: number; isToday: boolean }[];
  openReports: {
    orderId: string;
    orderCode: string;
    building: { nameEn: string; nameAr: string; shortName: string | null } | null;
    kind: "shortage" | "surplus" | "both";
    shortage: number;
    surplus: number;
    /** Count stage (custodian) at which the first mismatch was recorded. */
    stageField: TLaundryCountField;
    openedAt: string;
    isNew: boolean;
  }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3_600_000;
const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;

export function ratingFor(p: number | null): Rating | null {
  if (p === null) return null;
  return p >= 90 ? "good" : p >= 80 ? "medium" : "weak";
}

// Entry timestamp of each active stage (when the order got into it).
const stageEntry = (o: {
  status: string;
  createdAt: Date;
  atLaundryAt: Date | null;
  processingAt: Date | null;
  readyAt: Date | null;
  outForDeliveryAt: Date | null;
}): Date | null => {
  switch (o.status) {
    case "REQUESTED": return o.createdAt;
    case "AT_LAUNDRY": return o.atLaundryAt;
    case "PROCESSING": return o.processingAt;
    case "READY": return o.readyAt;
    case "OUT_FOR_DELIVERY": return o.outForDeliveryAt;
    default: return null;
  }
};

const ACTIVE = ["REQUESTED", "AT_LAUNDRY", "PROCESSING", "READY", "OUT_FOR_DELIVERY"] as const;

// ─── Main query ──────────────────────────────────────────────────────────────

export async function getManagerDashboardData(period: Period): Promise<DashboardData> {
  const now = new Date();
  // Open reports can predate the selected period, so look back at least 60 days.
  const lookback = new Date(now.getTime() - 60 * DAY_MS);
  const fetchFrom = period.from < lookback ? period.from : lookback;

  const orders = await prisma.laundryOrder.findMany({
    where: { OR: [{ createdAt: { gte: fetchFrom } }, { status: { in: [...ACTIVE] } }] },
    include: {
      building: { select: { id: true, nameEn: true, nameAr: true, shortName: true } },
      supervisor: { select: { id: true, name: true, email: true } },
      items: true,
      events: { where: { action: SETTLED_EVENT }, select: { id: true } },
    },
  });

  // Per-order derived numbers.
  const enriched = orders.map((o) => {
    let shortage = 0;
    let surplus = 0;
    let firstMismatch: TLaundryCountField | null = null;
    let pieces = 0;
    let legAtoReturnMismatch = false; // supervisor leg: returnedQty vs atLaundryQty
    let legCounted = false;
    for (const i of o.items) {
      pieces += i.requestedQty;
      const counts: ItemCounts = {
        requestedQty: i.requestedQty,
        atLaundryQty: i.atLaundryQty,
        returnedQty: i.returnedQty,
        deliveredQty: i.deliveredQty,
      };
      for (const leg of getItemLegs(counts)) {
        if (leg.delta > 0) shortage += leg.delta;
        if (leg.delta < 0) surplus += -leg.delta;
        if (leg.delta !== 0 && !firstMismatch) firstMismatch = leg.field;
        if (leg.field === "returnedQty") {
          legCounted = true;
          if (leg.delta !== 0) legAtoReturnMismatch = true;
        }
      }
    }
    return {
      o,
      shortage,
      surplus,
      firstMismatch,
      pieces,
      hasDiscrepancy: shortage + surplus > 0,
      settled: o.events.length > 0,
      supervisorLegCounted: legCounted,
      supervisorLegOk: !legAtoReturnMismatch,
    };
  });

  const inPeriod = enriched.filter(
    (e) => e.o.createdAt >= period.from && e.o.createdAt <= period.to && e.o.status !== "CANCELLED",
  );
  const delivered = inPeriod.filter((e) => e.o.status === "DELIVERED" && e.o.deliveredAt);

  // ── KPIs ──
  const cycles = delivered.map((e) => hoursBetween(e.o.createdAt, e.o.deliveredAt!));
  const onTime = delivered.filter((e) => e.o.deliveredAt! <= endOfDay(dayStr(e.o.neededDate))).length;
  const clean = delivered.filter((e) => !e.hasDiscrepancy).length;
  const responses = inPeriod
    .filter((e) => e.o.readyAt && e.o.outForDeliveryAt)
    .map((e) => minutesBetween(e.o.readyAt!, e.o.outForDeliveryAt!));

  const active = enriched.filter((e) => (ACTIVE as readonly string[]).includes(e.o.status));
  const openReportsAll = enriched.filter(
    (e) => e.o.status !== "CANCELLED" && e.hasDiscrepancy && !e.settled,
  );

  // ── Pipeline (live) ──
  const pipeline = ACTIVE.map((status) => {
    const rows = active.filter((e) => e.o.status === status);
    const waits = rows
      .map((e) => stageEntry(e.o))
      .filter((d): d is Date => !!d)
      .map((d) => hoursBetween(d, now));
    return { status, count: rows.length, avgHours: avg(waits) };
  });

  // ── Buildings ──
  const byBuilding = new Map<string, typeof inPeriod>();
  for (const e of inPeriod) {
    const k = e.o.buildingId;
    byBuilding.set(k, [...(byBuilding.get(k) ?? []), e]);
  }
  const buildings = [...byBuilding.values()]
    .map((rows) => {
      const b = rows[0].o.building!;
      const done = rows.filter((e) => e.o.status === "DELIVERED" && e.o.deliveredAt);
      const onTimePct = pct(
        done.filter((e) => e.o.deliveredAt! <= endOfDay(dayStr(e.o.neededDate))).length,
        done.length,
      );
      return {
        id: b.id,
        nameEn: b.nameEn,
        nameAr: b.nameAr,
        shortName: b.shortName,
        orders: rows.length,
        avgCycleHours: avg(done.map((e) => hoursBetween(e.o.createdAt, e.o.deliveredAt!))),
        onTimePct,
        shortagePieces: rows.reduce((s, e) => s + e.shortage, 0),
        surplusPieces: rows.reduce((s, e) => s + e.surplus, 0),
        rating: ratingFor(onTimePct),
      };
    })
    .sort((a, b) => (a.shortName ?? a.nameEn).localeCompare(b.shortName ?? b.nameEn));

  // ── Drivers (supervisors who collected ready laundry) ──
  const bySupervisor = new Map<string, typeof inPeriod>();
  for (const e of inPeriod) {
    if (!e.o.supervisorId) continue;
    bySupervisor.set(e.o.supervisorId, [...(bySupervisor.get(e.o.supervisorId) ?? []), e]);
  }
  const drivers = [...bySupervisor.values()]
    .map((rows) => {
      const s = rows[0].o.supervisor!;
      const counted = rows.filter((e) => e.supervisorLegCounted);
      return {
        id: s.id,
        name: s.name?.trim() || s.email,
        orders: rows.length,
        avgTripMin: avg(
          rows
            .filter((e) => e.o.outForDeliveryAt && e.o.deliveredAt)
            .map((e) => minutesBetween(e.o.outForDeliveryAt!, e.o.deliveredAt!)),
        ),
        accuracyPct: pct(counted.filter((e) => e.supervisorLegOk).length, counted.length),
      };
    })
    .sort((a, b) => b.orders - a.orders);

  // ── Trend: orders per day over the period (min 7 days ending at period end) ──
  const trendDays = Math.max(7, period.days);
  const trend: DashboardData["trend"] = [];
  const counts = new Map<string, number>();
  for (const e of enriched) {
    if (e.o.status === "CANCELLED") continue;
    const k = dayStr(e.o.createdAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const todayStr = dayStr(now);
  const endMs = startOfDay(period.toStr).getTime();
  for (let i = trendDays - 1; i >= 0; i--) {
    const d = dayStr(new Date(endMs + 12 * 3_600_000 - i * DAY_MS));
    trend.push({ date: d, count: counts.get(d) ?? 0, isToday: d === todayStr });
  }

  // ── Open reports table (oldest first; capped) ──
  const openReports = openReportsAll
    .map((e) => ({
      orderId: e.o.id,
      orderCode: e.o.orderCode,
      building: e.o.building
        ? { nameEn: e.o.building.nameEn, nameAr: e.o.building.nameAr, shortName: e.o.building.shortName }
        : null,
      kind: (e.shortage && e.surplus ? "both" : e.shortage ? "shortage" : "surplus") as
        | "shortage" | "surplus" | "both",
      shortage: e.shortage,
      surplus: e.surplus,
      stageField: e.firstMismatch ?? "atLaundryQty",
      openedAt: (e.o.deliveredAt ?? e.o.outForDeliveryAt ?? e.o.atLaundryAt ?? e.o.createdAt).toISOString(),
      isNew: false,
    }))
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
    .slice(0, 25)
    .map((r) => ({ ...r, isNew: now.getTime() - new Date(r.openedAt).getTime() < DAY_MS }));

  return {
    period: { key: period.key, fromStr: period.fromStr, toStr: period.toStr, days: period.days },
    kpis: {
      orders: inPeriod.length,
      avgCycleHours: avg(cycles),
      onTimePct: pct(onTime, delivered.length),
      noDiscrepancyPct: pct(clean, delivered.length),
      totalPieces: inPeriod.reduce((s, e) => s + e.pieces, 0),
      avgDriverResponseMin: avg(responses),
      activeNow: active.length,
      openReportsNow: openReportsAll.length,
    },
    pipeline,
    buildings,
    drivers,
    trend,
    openReports,
  };
}

/** Custodian label for the count stage where a mismatch was first recorded. */
export function stageOwner(field: TLaundryCountField) {
  const s = COUNT_STAGES.find((x) => x.field === field);
  return { en: s?.byRoleEn ?? "—", ar: s?.byRoleAr ?? "—" };
}
