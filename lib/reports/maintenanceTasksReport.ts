import prisma from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import { AUDITED_STATUSES, getAwaitingReview, type TAwaitingReview } from "@/lib/tasks/statuses";
import { analyzeTimeline, TIMELINE_ACTIONS } from "./taskTimeline";

// ─────────────────────────────────────────────────────────────────────────────
// Supervisor dashboard — "Maintenance tasks" report: every maintenance request
// with its device, location, issue, source, stage, arrival → start time and
// time paused for spare parts. Filterable and paginated.
//
// Filtering, ordering and paging run in two steps so the report stays fast:
//   1. a light query (id / status / created / approval count) for ALL matching
//      tasks → sorted by stage and paged in memory;
//   2. the full details (activity log for the timings) for the visible page only.
// ─────────────────────────────────────────────────────────────────────────────

export const MAINTENANCE_REPORT_PAGE_SIZE = 10;

export const STATUS_FILTERS = ["NOT_CLOSED", "ALL", "NEW", "IN_PROGRESS", "ON_HOLD", "AWAITING_REVIEW", "CLOSED", "CANCELLED"] as const;
export type MaintenanceStatusFilter = (typeof STATUS_FILTERS)[number];

export const SOURCE_FILTERS = ["ALL", "RECEPTIONIST", "SUPERVISOR", "MANAGER", "HOUSEKEEPING", "MAINTENANCE"] as const;
export type MaintenanceSourceFilter = (typeof SOURCE_FILTERS)[number];

export type MaintenanceReportFilters = {
  buildingId?: string;
  status: MaintenanceStatusFilter;
  source: MaintenanceSourceFilter;
  /** Arrival (created) date range, "YYYY-MM-DD" in Oman time. */
  from?: string;
  to?: string;
  page: number;
};

/** Where a request is in its life. */
export type MaintenanceStage = "NEW" | "IN_PROGRESS" | "ON_HOLD" | "AWAITING_REVIEW" | "CLOSED" | "CANCELLED";

export type MaintenanceReportRow = {
  id: string;
  deviceName: string;
  /** Equipment QR code when the request was created from a device. */
  deviceCode: string | null;
  buildingNameEn: string;
  buildingNameAr: string;
  unitName: string | null;
  issue: string | null;
  source: { role: string; name: string; buildingNameEn: string; buildingNameAr: string };
  technicianName: string;
  stage: MaintenanceStage;
  awaitingReview: TAwaitingReview | null;
  /** Open requests: time since creation. Finished ones: creation → completion. */
  elapsedMins: number;
  elapsedIsFinal: boolean;
  /** Arrival → first start, in minutes (null = not started). */
  arrivalToStartMins: number | null;
  /** Time on hold for spare parts (including an ongoing hold). */
  parts: { used: boolean; mins: number; ongoing: boolean };
};

export type MaintenanceReportResult = {
  rows: MaintenanceReportRow[];
  total: number;
  page: number;
  pageCount: number;
};

const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
const STAGE_RANK: Record<MaintenanceStage, number> = {
  NEW: 0, IN_PROGRESS: 1, ON_HOLD: 2, AWAITING_REVIEW: 3, CLOSED: 4, CANCELLED: 5,
};
const REVIEW_ACTIONS = ["approved", "rejected", "approved_receptionist", "rejected_receptionist"];
const mins = (ms: number) => Math.max(0, Math.round(ms / 60000));

/** "مكيف سبليت — HS-310-AC-01" → device + code. Older / free-text titles have no code. */
export function splitDevice(title: string): { name: string; code: string | null } {
  const idx = title.lastIndexOf(" — ");
  if (idx > 0) {
    const code = title.slice(idx + 3).trim();
    if (/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(code)) return { name: title.slice(0, idx).trim(), code };
  }
  return { name: title, code: null };
}

function getStage(status: string, approvedCount: number): MaintenanceStage {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "ON_HOLD") return "ON_HOLD";
  if (status === "ASSIGNED") return "NEW";
  if (AUDITED_STATUSES.includes(status as never)) return approvedCount > 0 ? "CLOSED" : "AWAITING_REVIEW";
  if (status === "COMPLETED" || status === "NO_ISSUES") return "CLOSED";
  return "IN_PROGRESS";
}

function statusWhere(status: MaintenanceStatusFilter): Prisma.TaskWhereInput {
  const approved: Prisma.TaskWhereInput = { activities: { some: { action: "approved" } } };
  const awaiting: Prisma.TaskWhereInput = { status: { in: AUDITED_STATUSES as TaskStatus[] }, NOT: approved };
  switch (status) {
    case "NOT_CLOSED": return { OR: [{ status: { notIn: TERMINAL_STATUSES } }, awaiting] };
    case "NEW": return { status: "ASSIGNED" };
    case "IN_PROGRESS": return { status: { in: ["WORK_STARTED", "IN_PROGRESS"] } };
    case "ON_HOLD": return { status: "ON_HOLD" };
    case "AWAITING_REVIEW": return awaiting;
    case "CLOSED":
      return { OR: [{ status: { in: AUDITED_STATUSES as TaskStatus[] }, ...approved }, { status: { in: ["COMPLETED", "NO_ISSUES"] } }] };
    case "CANCELLED": return { status: "CANCELLED" };
    default: return {};
  }
}

/** `scopeBuildingIds` = buildings the caller may see (null = all). */
export async function getMaintenanceTasksReport(
  filters: MaintenanceReportFilters,
  scopeBuildingIds: string[] | null,
): Promise<MaintenanceReportResult> {
  const now = Date.now();

  const and: Prisma.TaskWhereInput[] = [{ type: "MAINTENANCE" }, statusWhere(filters.status)];
  if (scopeBuildingIds) and.push({ buildingId: { in: scopeBuildingIds } });
  if (filters.buildingId) and.push({ buildingId: filters.buildingId });
  if (filters.source !== "ALL") and.push({ createdBy: { role: filters.source } });
  if (filters.from) and.push({ createdAt: { gte: new Date(`${filters.from}T00:00:00+04:00`) } });
  if (filters.to) and.push({ createdAt: { lte: new Date(`${filters.to}T23:59:59.999+04:00`) } });
  const where: Prisma.TaskWhereInput = { AND: and };

  // 1. Light query over every match → order by stage, then page
  const candidates = await prisma.task.findMany({
    where,
    select: {
      id: true, status: true, createdAt: true,
      _count: { select: { activities: { where: { action: "approved" } } } },
    },
  });

  const sorted = candidates
    .map((c) => ({ id: c.id, createdAt: c.createdAt, stage: getStage(c.status, c._count.activities) }))
    .sort((a, b) => {
      const byStage = STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
      if (byStage !== 0) return byStage;
      // open work: longest-waiting first; finished work: most recent first
      return a.stage === "NEW" || a.stage === "IN_PROGRESS" || a.stage === "ON_HOLD"
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime();
    });

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / MAINTENANCE_REPORT_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const pageItems = sorted.slice((page - 1) * MAINTENANCE_REPORT_PAGE_SIZE, page * MAINTENANCE_REPORT_PAGE_SIZE);
  if (pageItems.length === 0) return { rows: [], total, page, pageCount };

  // 2. Full details for the visible page only
  const details = await prisma.task.findMany({
    where: { id: { in: pageItems.map((p) => p.id) } },
    select: {
      id: true, title: true, description: true, status: true, createdAt: true, updatedAt: true, unitNumber: true,
      building: { select: { nameEn: true, nameAr: true, shortName: true } },
      unit: { select: { name: true } },
      createdBy: { select: { name: true, email: true, role: true } },
      assignedTo: { select: { name: true, email: true } },
      activities: {
        where: { action: { in: [...TIMELINE_ACTIONS, ...REVIEW_ACTIONS] } },
        orderBy: { createdAt: "asc" },
        select: { action: true, details: true, createdAt: true },
      },
    },
  });
  const byId = new Map(details.map((d) => [d.id, d]));

  const rows: MaintenanceReportRow[] = [];
  for (const item of pageItems) {
    const t = byId.get(item.id);
    if (!t) continue;
    const tl = analyzeTimeline(t.activities, t.status, now);
    const finished = item.stage === "AWAITING_REVIEW" || item.stage === "CLOSED";
    const endMs = finished ? (tl.completedAt ?? t.updatedAt).getTime() : now;
    const latestReview = [...t.activities].reverse().find((a) => REVIEW_ACTIONS.includes(a.action))?.action ?? null;
    const device = splitDevice(t.title);
    const buildingShort = (en: boolean) => (en ? t.building.shortName || t.building.nameEn : t.building.shortName || t.building.nameAr);

    rows.push({
      id: t.id,
      deviceName: device.name,
      deviceCode: device.code,
      buildingNameEn: buildingShort(true),
      buildingNameAr: buildingShort(false),
      unitName: t.unit?.name || t.unitNumber || null,
      issue: t.description,
      source: {
        role: t.createdBy.role,
        name: t.createdBy.name || t.createdBy.email.split("@")[0],
        buildingNameEn: buildingShort(true),
        buildingNameAr: buildingShort(false),
      },
      technicianName: t.assignedTo.name || t.assignedTo.email.split("@")[0],
      stage: item.stage,
      awaitingReview: item.stage === "AWAITING_REVIEW" ? getAwaitingReview(t.status, latestReview) : null,
      elapsedMins: mins(endMs - t.createdAt.getTime()),
      elapsedIsFinal: finished,
      arrivalToStartMins: tl.startedAt ? mins(tl.startedAt.getTime() - t.createdAt.getTime()) : null,
      parts: { used: tl.holdStarts.length > 0, mins: mins(tl.holdMs), ongoing: tl.holdSince !== null },
    });
  }

  return { rows, total, page, pageCount };
}
