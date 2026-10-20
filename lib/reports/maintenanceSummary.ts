import prisma from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import { analyzeTimeline, TIMELINE_ACTIONS } from "./taskTimeline";
import { categoryWhere, splitDevice } from "./maintenanceTasksReport";
import { parseRatingNote } from "./branchMaintenance";

// ─────────────────────────────────────────────────────────────────────────────
// Manager / Supervisor dashboards — summary cards above the maintenance reports,
// for a period (Today / last 7 days / last 30 days). Timings are rebuilt from
// each task's activity log (see taskTimeline.ts).
//
// Equipment maintenance (requests linked to a registered device):
//   • completed tasks           = work completed in the period
//   • average arrival → start   = created → first start, for starts in the period
//   • average work time         = first start → completed minus time on hold, for completions in the period
//   • paused for parts          = share of the period's completions that were paused, and their average pause
//   • branch satisfaction       = share of tasks reviewed in the period accepted without a rejection
//                                 (same rule as the technician dashboard)
//   • reopened                  = tasks rejected (sent back) in the period
//   • live (ignore the period): not started, in progress and paused for parts right now
// plus the same figures per branch, the low ★ closing ratings with their
// comments, and where the requests came from. (Branch satisfaction uses the
// review rule, not the ★ ratings: approvals default to 5 stars, so the stars
// barely vary while rejections do.)
//
// Other maintenance (plumbing, electrical, furniture… and older general requests —
// everything not linked to a device):
//   • requests created in the period, and across how many buildings
//   • average response time   = created → first start, for starts in the period
//   • average completion time = first start → work completed, for completions in the period
//   • average satisfaction    = the ★1–5 rating given at approval, for ratings in the period
//   • live (ignore the period): open requests and overdue requests right now
// plus technician performance (completions, completion time, on-time %, ★),
// requests by category and by building, and units with recurring requests
// (always the last 30 days).
// ─────────────────────────────────────────────────────────────────────────────

export const SUMMARY_PERIODS = ["TODAY", "7D", "30D"] as const;
export type SummaryPeriod = (typeof SUMMARY_PERIODS)[number];

export type EquipmentMaintenanceSummary = {
  completed: number;
  /** null = nothing started in the period */
  avgArrivalToStartMins: number | null;
  /** null = nothing completed in the period */
  avgWorkMins: number | null;
  /** % of the period's completions that were paused for parts (null = no completions) */
  partsPausedPct: number | null;
  /** Average total pause of those paused tasks (null = none paused) */
  avgPartsPauseMins: number | null;
  /** % (null = nothing reviewed in the period) */
  satisfactionPct: number | null;
  reopened: number;
  /** Live (ignore the period): requests not started / being worked on / paused for parts right now */
  notStartedNow: number;
  inProgressNow: number;
  onHoldNow: number;
  /** Per branch, busiest first */
  branches: BranchSatisfactionRow[];
  /** Ratings of LOW_RATING_MAX stars or fewer with a comment, newest first */
  lowRatings: LowRating[];
  /** Requests created in the period, by the creator's role, most first */
  sources: { role: string; count: number }[];
  /** Fixed windows, not the period: by type over 90 days, by brand over 12 months */
  failures: EquipmentFailures;
};

export type FailureRow = {
  key: string;
  typeNameEn: string;
  typeNameAr: string;
  /** null on the by-type report */
  brand: string | null;
  failures: number;
  devices: number;
  /** Failures per 100 devices, one decimal */
  per100: number;
};

export type EquipmentFailures = {
  /** Every device type, most failures first */
  byType: FailureRow[];
  /** Type + brand groups with at least FAILURES_MIN_DEVICES devices and a failure, highest rate first */
  byBrand: FailureRow[];
  /** Devices in scope with no brand recorded */
  devicesWithoutBrand: number;
  devices: number;
};

export const FAILURES_BY_TYPE_DAYS = 90;
export const FAILURES_BY_BRAND_DAYS = 365;
/** A brand group needs this many devices before its rate means anything */
export const FAILURES_MIN_DEVICES = 10;
const FAILURES_BY_BRAND_SHOWN = 8;

export type BranchSatisfactionRow = {
  buildingId: string;
  buildingNameEn: string;
  buildingNameAr: string;
  completed: number;
  /** % of the branch's tasks reviewed in the period accepted without a rejection (null = none reviewed) */
  satisfactionPct: number | null;
  reviewed: number;
  avgArrivalToStartMins: number | null;
  /** Completed tasks that were paused for parts, and their average pause */
  partsPaused: number;
  avgPartsPauseMins: number | null;
  reopened: number;
};

export type LowRating = {
  requestNumber: number;
  buildingNameEn: string;
  buildingNameAr: string;
  rating: number;
  comment: string;
  ratedAt: Date;
};

export const LOW_RATING_MAX = 3;
const LOW_RATINGS_SHOWN = 6;

export type OtherMaintenanceSummary = {
  requests: number;
  buildings: number;
  /** null = nothing started in the period */
  avgResponseMins: number | null;
  /** null = nothing completed in the period */
  avgCompletionMins: number | null;
  /** 1–5, null = no ratings in the period */
  avgRating: number | null;
  openNow: number;
  overdueNow: number;
  /** Technicians who worked on other maintenance in the period, most completed first */
  technicians: TechnicianPerformanceRow[];
  /** Requests created in the period by category (null = older request with no category), most first */
  byCategory: { category: string | null; count: number }[];
  /** Requests created in the period by building, most first */
  byBuilding: { buildingId: string; nameEn: string; nameAr: string; count: number }[];
  /** Units / places with RECURRING_MIN requests or more in the last RECURRING_DAYS days, most first */
  recurring: RecurringFaultRow[];
};

export type TechnicianPerformanceRow = {
  id: string;
  name: string;
  /** Category they handled most in the period (null = unknown) */
  specialty: string | null;
  completed: number;
  /** Start → completion (null = nothing completed) */
  avgCompletionMins: number | null;
  /** % of completions done before the due time (null = nothing completed) */
  slaPct: number | null;
  /** ★ 1–5 (null = no ratings) */
  avgRating: number | null;
};

export type RecurringFaultRow = {
  key: string;
  buildingNameEn: string;
  buildingNameAr: string;
  /** Unit name; null = a place in a common area (see `place`) */
  unitName: string | null;
  place: string | null;
  count: number;
  /** Most frequent issue: the job (or older request title) + its category key */
  topIssue: string;
  topCategory: string | null;
};

export const RECURRING_DAYS = 30;
export const RECURRING_MIN = 3;
const RECURRING_SHOWN = 8;

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
const REVIEW_ACTIONS = ["approved", "rejected", "approved_receptionist", "rejected_receptionist"];
const DAY_MS = 24 * 60 * 60 * 1000;
const OMAN_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC+4 all year

function periodStart(period: SummaryPeriod, now: number): Date {
  if (period === "7D") return new Date(now - 7 * DAY_MS);
  if (period === "30D") return new Date(now - 30 * DAY_MS);
  // Today = since midnight in Oman
  const omanNow = now + OMAN_OFFSET_MS;
  return new Date(omanNow - (omanNow % DAY_MS) - OMAN_OFFSET_MS);
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const toMins = (ms: number | null) => (ms === null ? null : Math.max(0, ms / 60000));
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

// Conditions are combined with AND — several of them use OR, and spreading
// them into one object would let one OR silently replace another.
async function baseWhere(scope: "ALL_EQUIPMENT" | "ALL_OTHER", scopeBuildingIds: string[] | null): Promise<Prisma.TaskWhereInput> {
  return {
    AND: [
      { type: "MAINTENANCE" },
      await categoryWhere(scope),
      scopeBuildingIds ? { buildingId: { in: scopeBuildingIds } } : {},
    ],
  };
}

/** Requests with something in the period: created, or any activity (start, completion, review…). */
const touchedSince = (since: Date): Prisma.TaskWhereInput => ({
  OR: [{ createdAt: { gte: since } }, { activities: { some: { createdAt: { gte: since } } } }],
});

/** `scopeBuildingIds` = buildings the caller may see (null = all). */
export async function getEquipmentMaintenanceSummary(
  period: SummaryPeriod,
  scopeBuildingIds: string[] | null,
): Promise<EquipmentMaintenanceSummary> {
  const now = Date.now();
  const since = periodStart(period, now);

  const base = await baseWhere("ALL_EQUIPMENT", scopeBuildingIds);
  const [failures, liveByStatus, tasks] = await Promise.all([
    getEquipmentFailures(base, scopeBuildingIds, now),
    prisma.task.groupBy({
      by: ["status"],
      where: { AND: [base, { status: { in: ["ASSIGNED", "WORK_STARTED", "IN_PROGRESS", "ON_HOLD"] } }] },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: { AND: [base, touchedSince(since)] },
      select: {
        status: true, createdAt: true, requestNumber: true, buildingId: true,
        building: { select: { nameEn: true, nameAr: true, shortName: true } },
        createdBy: { select: { role: true } },
        activities: {
          where: { action: { in: [...TIMELINE_ACTIONS, ...REVIEW_ACTIONS] } },
          orderBy: { createdAt: "asc" },
          select: { action: true, details: true, createdAt: true },
        },
        notes: {
          where: { text: { startsWith: "★" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, createdAt: true },
        },
      },
    }),
  ]);

  const liveCount = (status: TaskStatus) => liveByStatus.find((s) => s.status === status)?._count._all ?? 0;
  const all = newAccumulator();
  const byBuilding = new Map<string, { nameEn: string; nameAr: string; acc: Accumulator }>();
  const lowRatings: LowRating[] = [];
  const sourceCounts = new Map<string, number>();

  for (const t of tasks) {
    let branch = byBuilding.get(t.buildingId);
    if (!branch) {
      branch = {
        nameEn: t.building.shortName || t.building.nameEn,
        nameAr: t.building.shortName || t.building.nameAr,
        acc: newAccumulator(),
      };
      byBuilding.set(t.buildingId, branch);
    }

    const tl = analyzeTimeline(t.activities, t.status, now);
    const reviews = t.activities.filter((a) => REVIEW_ACTIONS.includes(a.action));
    const note = t.notes[0] && t.notes[0].createdAt >= since ? t.notes[0] : null;
    const { rating, comment } = parseRatingNote(note?.text);

    for (const acc of [all, branch.acc]) {
      if (tl.startedAt && tl.startedAt >= since) acc.arrivals.push(tl.startedAt.getTime() - t.createdAt.getTime());
      if (tl.completedAt && tl.completedAt >= since) {
        acc.completed++;
        if (tl.startedAt) acc.workTimes.push(tl.completedAt.getTime() - tl.startedAt.getTime() - tl.holdMs);
        if (tl.holdStarts.length > 0) acc.pauses.push(tl.holdMs);
      }
      if (reviews.some((a) => a.createdAt >= since)) {
        acc.reviewed++;
        if (!reviews.some((a) => a.action.startsWith("rejected"))) acc.acceptedClean++;
      }
      if (reviews.some((a) => a.action.startsWith("rejected") && a.createdAt >= since)) acc.reopened++;
    }

    if (rating !== null && rating <= LOW_RATING_MAX && comment && note) {
      lowRatings.push({
        requestNumber: t.requestNumber,
        buildingNameEn: branch.nameEn,
        buildingNameAr: branch.nameAr,
        rating,
        comment,
        ratedAt: note.createdAt,
      });
    }
    if (t.createdAt >= since) sourceCounts.set(t.createdBy.role, (sourceCounts.get(t.createdBy.role) ?? 0) + 1);
  }

  const branches: BranchSatisfactionRow[] = [...byBuilding.entries()]
    .map(([buildingId, b]) => ({
      buildingId,
      buildingNameEn: b.nameEn,
      buildingNameAr: b.nameAr,
      completed: b.acc.completed,
      satisfactionPct: pct(b.acc.acceptedClean, b.acc.reviewed),
      reviewed: b.acc.reviewed,
      avgArrivalToStartMins: toMins(average(b.acc.arrivals)),
      partsPaused: b.acc.pauses.length,
      avgPartsPauseMins: toMins(average(b.acc.pauses)),
      reopened: b.acc.reopened,
    }))
    // Only branches with something to show in the period
    .filter((b) => b.completed > 0 || b.reviewed > 0 || b.avgArrivalToStartMins !== null || b.reopened > 0)
    .sort((a, b) => b.completed - a.completed || a.buildingNameEn.localeCompare(b.buildingNameEn));

  return {
    completed: all.completed,
    avgArrivalToStartMins: toMins(average(all.arrivals)),
    avgWorkMins: toMins(average(all.workTimes)),
    partsPausedPct: pct(all.pauses.length, all.completed),
    avgPartsPauseMins: toMins(average(all.pauses)),
    satisfactionPct: pct(all.acceptedClean, all.reviewed),
    reopened: all.reopened,
    notStartedNow: liveCount("ASSIGNED"),
    inProgressNow: liveCount("WORK_STARTED") + liveCount("IN_PROGRESS"),
    onHoldNow: liveCount("ON_HOLD"),
    branches,
    lowRatings: lowRatings.sort((a, b) => b.ratedAt.getTime() - a.ratedAt.getTime()).slice(0, LOW_RATINGS_SHOWN),
    sources: [...sourceCounts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count),
    failures,
  };
}

/**
 * A failure = an equipment maintenance request (someone reported the device as
 * broken), matched to its device by the QR code in the title. Routine visits
 * logged by QR scan are not failures.
 */
async function getEquipmentFailures(
  /** Equipment maintenance requests in the caller's buildings (see baseWhere) */
  base: Prisma.TaskWhereInput,
  scopeBuildingIds: string[] | null,
  now: number,
): Promise<EquipmentFailures> {
  const brandSince = new Date(now - FAILURES_BY_BRAND_DAYS * DAY_MS);
  const typeSince = new Date(now - FAILURES_BY_TYPE_DAYS * DAY_MS);

  const [devices, types, requests] = await Promise.all([
    prisma.equipment.findMany({
      where: scopeBuildingIds ? { buildingId: { in: scopeBuildingIds } } : {},
      select: { qrCode: true, typeId: true, brandModel: true },
    }),
    prisma.equipmentType.findMany({ select: { id: true, nameEn: true, nameAr: true } }),
    prisma.task.findMany({
      where: { AND: [base, { createdAt: { gte: brandSince } }] },
      select: { title: true, createdAt: true },
    }),
  ]);

  const deviceByCode = new Map(devices.map((d) => [d.qrCode, d]));
  const typeById = new Map(types.map((t) => [t.id, t]));
  const brandOf = (d: { brandModel: string | null }) => d.brandModel?.trim().replace(/\s+/g, " ") || null;
  const groupKey = (typeId: string, brand: string) => `${typeId}|${brand.toLowerCase()}`;

  // Device counts per type and per type + brand
  const devicesByType = new Map<string, number>();
  const brandGroups = new Map<string, { typeId: string; brand: string; devices: number; failures: number }>();
  for (const d of devices) {
    devicesByType.set(d.typeId, (devicesByType.get(d.typeId) ?? 0) + 1);
    const brand = brandOf(d);
    if (!brand) continue;
    const key = groupKey(d.typeId, brand);
    const g = brandGroups.get(key) ?? { typeId: d.typeId, brand, devices: 0, failures: 0 };
    g.devices++;
    brandGroups.set(key, g);
  }

  // Failures per type (90 days) and per type + brand (12 months)
  const failuresByType = new Map<string, number>();
  for (const r of requests) {
    const code = splitDevice(r.title).code;
    const device = code ? deviceByCode.get(code) : undefined;
    if (!device) continue;
    if (r.createdAt >= typeSince) failuresByType.set(device.typeId, (failuresByType.get(device.typeId) ?? 0) + 1);
    const brand = brandOf(device);
    if (brand) brandGroups.get(groupKey(device.typeId, brand))!.failures++;
  }

  const per100 = (failures: number, count: number) => (count > 0 ? Math.round((failures / count) * 1000) / 10 : 0);
  const typeName = (typeId: string) => {
    const t = typeById.get(typeId);
    return { typeNameEn: t?.nameEn || t?.nameAr || "—", typeNameAr: t?.nameAr || "—" };
  };

  const byType: FailureRow[] = [...devicesByType.entries()]
    .map(([typeId, count]) => {
      const failures = failuresByType.get(typeId) ?? 0;
      return { key: typeId, ...typeName(typeId), brand: null, failures, devices: count, per100: per100(failures, count) };
    })
    .sort((a, b) => b.failures - a.failures || b.per100 - a.per100);

  const byBrand: FailureRow[] = [...brandGroups.entries()]
    .filter(([, g]) => g.devices >= FAILURES_MIN_DEVICES && g.failures > 0)
    .map(([key, g]) => ({ key, ...typeName(g.typeId), brand: g.brand, failures: g.failures, devices: g.devices, per100: per100(g.failures, g.devices) }))
    .sort((a, b) => b.per100 - a.per100)
    .slice(0, FAILURES_BY_BRAND_SHOWN);

  return {
    byType,
    byBrand,
    devicesWithoutBrand: devices.filter((d) => !brandOf(d)).length,
    devices: devices.length,
  };
}

type Accumulator = {
  completed: number;
  reviewed: number;
  acceptedClean: number;
  reopened: number;
  arrivals: number[];
  workTimes: number[];
  /** Total pause of each completed task that was paused for parts */
  pauses: number[];
};

const newAccumulator = (): Accumulator => ({
  completed: 0, reviewed: 0, acceptedClean: 0, reopened: 0, arrivals: [], workTimes: [], pauses: [],
});

/** `scopeBuildingIds` = buildings the caller may see (null = all). */
export async function getOtherMaintenanceSummary(
  period: SummaryPeriod,
  scopeBuildingIds: string[] | null,
): Promise<OtherMaintenanceSummary> {
  const now = Date.now();
  const since = periodStart(period, now);
  const base = await baseWhere("ALL_OTHER", scopeBuildingIds);
  const open: Prisma.TaskWhereInput = { status: { notIn: TERMINAL_STATUSES } };

  const recurringSince = new Date(now - RECURRING_DAYS * DAY_MS);
  const buildingSelect = { select: { nameEn: true, nameAr: true, shortName: true } } as const;

  const [tasks, openNow, overdueNow, recentRequests] = await Promise.all([
    prisma.task.findMany({
      where: { AND: [base, touchedSince(since)] },
      select: {
        status: true, createdAt: true, dueDate: true, buildingId: true, category: true,
        building: buildingSelect,
        assignedTo: { select: { id: true, name: true, email: true } },
        activities: {
          where: { action: { in: TIMELINE_ACTIONS } },
          orderBy: { createdAt: "asc" },
          select: { action: true, details: true, createdAt: true },
        },
        notes: {
          where: { text: { startsWith: "★" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { text: true, createdAt: true },
        },
      },
    }),
    prisma.task.count({ where: { AND: [base, open] } }),
    prisma.task.count({ where: { AND: [base, open, { dueDate: { lt: new Date(now) } }] } }),
    // Recurring faults always look at the last 30 days, whatever the period
    prisma.task.findMany({
      where: { AND: [base, { createdAt: { gte: recurringSince } }, { status: { not: "CANCELLED" } }] },
      select: {
        title: true, category: true, buildingId: true, unitId: true, unitNumber: true, room: true,
        building: buildingSelect,
        unit: { select: { name: true } },
      },
    }),
  ]);

  const created = tasks.filter((t) => t.createdAt >= since);
  const responses: number[] = [];
  const completions: number[] = [];
  const ratings: number[] = [];
  const techs = new Map<string, {
    name: string; completed: number; onTime: number; completionTimes: number[]; ratings: number[];
    categories: Map<string, number>;
  }>();

  for (const t of tasks) {
    const tl = analyzeTimeline(t.activities, t.status, now);
    const note = t.notes[0];
    const stars = note && note.createdAt >= since ? note.text.match(/^★\s*(\d+)/) : null;
    const rating = stars ? Math.min(5, Math.max(1, parseInt(stars[1], 10))) : null;

    let tech = techs.get(t.assignedTo.id);
    if (!tech) {
      tech = {
        name: t.assignedTo.name || t.assignedTo.email.split("@")[0],
        completed: 0, onTime: 0, completionTimes: [], ratings: [], categories: new Map(),
      };
      techs.set(t.assignedTo.id, tech);
    }
    if (t.category) tech.categories.set(t.category, (tech.categories.get(t.category) ?? 0) + 1);

    if (tl.startedAt && tl.startedAt >= since) {
      responses.push(tl.startedAt.getTime() - t.createdAt.getTime());
    }
    if (tl.startedAt && tl.completedAt && tl.completedAt >= since) {
      const ms = tl.completedAt.getTime() - tl.startedAt.getTime();
      completions.push(ms);
      tech.completed++;
      tech.completionTimes.push(ms);
      if (tl.completedAt <= t.dueDate) tech.onTime++;
    }
    if (rating !== null) {
      ratings.push(rating);
      tech.ratings.push(rating);
    }
  }

  const avgRating = average(ratings);
  const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
  const topKey = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const technicians: TechnicianPerformanceRow[] = [...techs.entries()]
    .map(([id, x]) => ({
      id,
      name: x.name,
      specialty: topKey(x.categories),
      completed: x.completed,
      avgCompletionMins: toMins(average(x.completionTimes)),
      slaPct: pct(x.onTime, x.completed),
      avgRating: round1(average(x.ratings)),
    }))
    .sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name));

  const categoryCounts = new Map<string | null, number>();
  const buildingCounts = new Map<string, { nameEn: string; nameAr: string; count: number }>();
  for (const t of created) {
    categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
    const b = buildingCounts.get(t.buildingId) ?? {
      nameEn: t.building.shortName || t.building.nameEn,
      nameAr: t.building.shortName || t.building.nameAr,
      count: 0,
    };
    b.count++;
    buildingCounts.set(t.buildingId, b);
  }

  return {
    requests: created.length,
    buildings: buildingCounts.size,
    avgResponseMins: toMins(average(responses)),
    avgCompletionMins: toMins(average(completions)),
    avgRating: round1(avgRating),
    openNow,
    overdueNow,
    technicians,
    byCategory: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    byBuilding: [...buildingCounts.entries()]
      .map(([buildingId, b]) => ({ buildingId, ...b }))
      .sort((a, b) => b.count - a.count),
    recurring: findRecurringFaults(recentRequests),
  };
}

/** Units (or common-area places) with RECURRING_MIN requests or more — a sign of a root problem. */
function findRecurringFaults(
  requests: {
    title: string; category: string | null; buildingId: string; unitId: string | null; unitNumber: string | null; room: string | null;
    building: { nameEn: string; nameAr: string; shortName: string | null };
    unit: { name: string } | null;
  }[],
): RecurringFaultRow[] {
  const groups = new Map<string, { rows: typeof requests; unitName: string | null; place: string | null }>();
  for (const r of requests) {
    const unitName = r.unit?.name || r.unitNumber || null;
    // A common-area request names its place in `room`; without unit or place there is no location to compare
    const place = unitName ? null : r.room;
    if (!unitName && !place) continue;
    const key = `${r.buildingId}|${unitName ? `u:${unitName}` : `p:${place!.toLowerCase()}`}`;
    const g = groups.get(key) ?? { rows: [], unitName, place };
    g.rows.push(r);
    groups.set(key, g);
  }

  return [...groups.entries()]
    .filter(([, g]) => g.rows.length >= RECURRING_MIN)
    .map(([key, g]) => {
      // The job is the part after "Category — " in new requests; older requests only have a free-text title
      const issues = new Map<string, { count: number; category: string | null }>();
      for (const r of g.rows) {
        const issue = r.category && r.title.includes(" — ") ? r.title.slice(r.title.indexOf(" — ") + 3) : r.title;
        const entry = issues.get(issue) ?? { count: 0, category: r.category };
        entry.count++;
        issues.set(issue, entry);
      }
      const [topIssue, top] = [...issues.entries()].sort((a, b) => b[1].count - a[1].count)[0];
      const b = g.rows[0].building;
      return {
        key,
        buildingNameEn: b.shortName || b.nameEn,
        buildingNameAr: b.shortName || b.nameAr,
        unitName: g.unitName,
        place: g.place,
        count: g.rows.length,
        topIssue,
        topCategory: top.category,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, RECURRING_SHOWN);
}
