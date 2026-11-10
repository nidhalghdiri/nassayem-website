// ─────────────────────────────────────────────────────────────────────────────
// Receptionist laundry dashboard — data for the receptionist's own building(s).
// Server-only. "Open report" matches the manager dashboard: a non-cancelled
// order with a count mismatch and no `discrepancy_settled` event.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { COUNT_STAGES, LAUNDRY_STATUS_CONFIG, type TLaundryCountField, type TLaundryStatus } from "./constants";
import { getItemLegs } from "./workflow";
import { SETTLED_EVENT } from "./dashboard";

const DAY_MS = 86_400_000;
const ACTIVE = ["REQUESTED", "AT_LAUNDRY", "PROCESSING", "READY", "OUT_FOR_DELIVERY"] as const;
const dayStr = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Muscat" });
const endOfDay = (d: Date) => new Date(`${dayStr(d)}T23:59:59.999+04:00`);

export type ReceptionistOrderCard = {
  id: string;
  orderCode: string;
  status: TLaundryStatus;
  step: number; // 1..5
  totalPieces: number;
  itemsSummary: string[]; // e.g. ["Towel ×10", "Bed sheet ×4"]
  priority: string;
  urgent: boolean;
  needsConfirm: boolean; // OUT_FOR_DELIVERY → receptionist must verify
  /** ms until the needed date (negative = late). */
  msLeft: number;
  building: { nameEn: string; nameAr: string; shortName: string | null } | null;
};

export type ReceptionistReport = {
  orderId: string;
  orderCode: string;
  kind: "shortage" | "surplus" | "both";
  lines: { nameEn: string; nameAr: string; expected: number; counted: number; field: TLaundryCountField }[];
  settled: boolean;
  at: string;
};

export type ReceptionistDashboardData = {
  buildings: { id: string; nameEn: string; nameAr: string; shortName: string | null }[];
  kpis: {
    active: number;
    needsConfirm: number;
    avgReadyToReceiveHours: number | null;
    openReports: number;
    openShortagePieces: number;
  };
  orders: ReceptionistOrderCard[];
  reports: ReceptionistReport[];
};

export async function getReceptionistDashboardData(adminUserId: string): Promise<ReceptionistDashboardData> {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const buildings = await prisma.building.findMany({
    where: { assignedStaff: { some: { adminUserId } } },
    select: { id: true, nameEn: true, nameAr: true, shortName: true },
    orderBy: { nameEn: "asc" },
  });
  const ids = buildings.map((b) => b.id);

  const orders = ids.length
    ? await prisma.laundryOrder.findMany({
        where: {
          buildingId: { in: ids },
          OR: [{ status: { in: [...ACTIVE] } }, { createdAt: { gte: since } }],
        },
        include: {
          building: { select: { nameEn: true, nameAr: true, shortName: true } },
          items: { include: { itemType: { select: { nameEn: true, nameAr: true } } } },
          events: { where: { action: SETTLED_EVENT }, select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const stageOf = (f: TLaundryCountField) => COUNT_STAGES.find((s) => s.field === f);

  const cards: ReceptionistOrderCard[] = [];
  const reports: (ReceptionistReport & { sortKey: number })[] = [];
  let openReports = 0;
  let openShortage = 0;
  const readyToReceive: number[] = [];

  for (const o of orders) {
    // ── discrepancy lines ──
    const lines: ReceptionistReport["lines"] = [];
    let shortage = 0;
    let surplus = 0;
    for (const i of o.items) {
      for (const leg of getItemLegs({
        requestedQty: i.requestedQty,
        atLaundryQty: i.atLaundryQty,
        returnedQty: i.returnedQty,
        deliveredQty: i.deliveredQty,
      })) {
        if (leg.delta === 0) continue;
        if (leg.delta > 0) shortage += leg.delta;
        else surplus += -leg.delta;
        lines.push({
          nameEn: i.customName ?? i.itemType?.nameEn ?? "Other",
          nameAr: i.customName ?? i.itemType?.nameAr ?? "أخرى",
          expected: leg.prevValue,
          counted: leg.value,
          field: leg.field,
        });
      }
    }
    const settled = o.events.length > 0;
    if (o.status !== "CANCELLED" && lines.length) {
      if (!settled) {
        openReports++;
        openShortage += shortage;
      }
      reports.push({
        orderId: o.id,
        orderCode: o.orderCode,
        kind: shortage && surplus ? "both" : shortage ? "shortage" : "surplus",
        lines,
        settled,
        at: o.updatedAt.toISOString(),
        sortKey: o.updatedAt.getTime(),
      });
    }

    if (o.status === "DELIVERED" && o.readyAt && o.deliveredAt && o.deliveredAt >= since) {
      readyToReceive.push((o.deliveredAt.getTime() - o.readyAt.getTime()) / 3_600_000);
    }

    // ── active order card ──
    if ((ACTIVE as readonly string[]).includes(o.status)) {
      const status = o.status as TLaundryStatus;
      const named = o.items.map((i) => ({
        en: i.customName ?? i.itemType?.nameEn ?? "Other",
        ar: i.customName ?? i.itemType?.nameAr ?? "أخرى",
        qty: i.requestedQty,
      }));
      cards.push({
        id: o.id,
        orderCode: o.orderCode,
        status,
        step: LAUNDRY_STATUS_CONFIG[status].step,
        totalPieces: named.reduce((s, n) => s + n.qty, 0),
        // Language-neutral join happens in the UI; keep both names via "en|ar".
        itemsSummary: named.slice(0, 3).map((n) => `${n.en}|${n.ar}|${n.qty}`),
        priority: o.priority,
        urgent: o.priority === "URGENT" || o.priority === "HIGH",
        needsConfirm: status === "OUT_FOR_DELIVERY",
        msLeft: endOfDay(o.neededDate).getTime() - now.getTime(),
        building: o.building,
      });
    }
  }

  // Orders waiting on the receptionist first, then the soonest due.
  cards.sort((a, b) => Number(b.needsConfirm) - Number(a.needsConfirm) || a.msLeft - b.msLeft);
  reports.sort((a, b) => Number(a.settled) - Number(b.settled) || b.sortKey - a.sortKey);

  return {
    buildings,
    kpis: {
      active: cards.length,
      needsConfirm: cards.filter((c) => c.needsConfirm).length,
      avgReadyToReceiveHours: readyToReceive.length
        ? readyToReceive.reduce((a, b) => a + b, 0) / readyToReceive.length
        : null,
      openReports,
      openShortagePieces: openShortage,
    },
    orders: cards,
    reports: reports.slice(0, 10).map(({ sortKey: _s, ...r }) => r),
  };
}

export function stageLabel(field: TLaundryCountField) {
  const s = COUNT_STAGES.find((x) => x.field === field);
  return { en: s?.labelEn ?? "", ar: s?.labelAr ?? "" };
}
