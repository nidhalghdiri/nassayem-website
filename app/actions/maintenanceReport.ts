"use server";

import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canSeeAllTasks } from "@/lib/tasks/permissions";
import {
  getMaintenanceTasksReport as queryReport,
  CATEGORY_FILTERS,
  SOURCE_FILTERS,
  STATUS_FILTERS,
  type MaintenanceReportFilters,
  type MaintenanceReportResult,
} from "@/lib/reports/maintenanceTasksReport";
import {
  getEquipmentMaintenanceSummary as queryEquipmentSummary,
  getOtherMaintenanceSummary as queryOtherSummary,
  SUMMARY_PERIODS,
  type EquipmentMaintenanceSummary,
  type OtherMaintenanceSummary,
  type SummaryPeriod,
  type SummaryRange,
} from "@/lib/reports/maintenanceSummary";
import {
  getEquipmentCardTasks as queryEquipmentCard,
  getOtherCardTasks as queryOtherCard,
  EQUIPMENT_CARDS,
  OTHER_CARDS,
  type DrilldownResult,
  type EquipmentCard,
  type OtherCard,
} from "@/lib/reports/maintenanceDrilldown";
import type { TStaffRole } from "@/lib/tasks/constants";

export type MaintenanceReportError = "UNAUTHORIZED" | "FORBIDDEN" | "SERVER";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Loads the Supervisor dashboard's maintenance-tasks report. The filters come
 * from the browser, so they are validated here; a supervisor linked to specific
 * buildings only ever sees those buildings (same rule as the audit report).
 */
export async function getMaintenanceTasksReport(input: {
  buildingId?: string;
  status: string;
  source: string;
  category?: string;
  from?: string;
  to?: string;
  page: number;
}): Promise<{ ok: true; data: MaintenanceReportResult } | { ok: false; error: MaintenanceReportError }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!canSeeAllTasks(user.role as TStaffRole)) return { ok: false, error: "FORBIDDEN" };

    const filters: MaintenanceReportFilters = {
      buildingId: typeof input.buildingId === "string" && input.buildingId.length > 0 && input.buildingId.length <= 64 ? input.buildingId : undefined,
      status: (STATUS_FILTERS as readonly string[]).includes(input.status) ? (input.status as MaintenanceReportFilters["status"]) : "NOT_CLOSED",
      source: (SOURCE_FILTERS as readonly string[]).includes(input.source) ? (input.source as MaintenanceReportFilters["source"]) : "ALL",
      category: (CATEGORY_FILTERS as readonly string[]).includes(input.category ?? "") ? (input.category as MaintenanceReportFilters["category"]) : "ALL",
      from: input.from && DATE_RE.test(input.from) ? input.from : undefined,
      to: input.to && DATE_RE.test(input.to) ? input.to : undefined,
      page: Number.isInteger(input.page) && input.page > 0 ? Math.min(input.page, 1000) : 1,
    };

    return { ok: true, data: await queryReport(filters, await getScopeBuildingIds(user)) };
  } catch (err) {
    console.error("getMaintenanceTasksReport failed:", err);
    return { ok: false, error: "SERVER" };
  }
}

type RangeInput = { period: string; from?: string; to?: string };

/** Loads the "Equipment maintenance" summary cards for the chosen period. */
export async function getEquipmentMaintenanceSummary(
  range: RangeInput,
): Promise<{ ok: true; data: EquipmentMaintenanceSummary } | { ok: false; error: MaintenanceReportError }> {
  return loadSummary(range, queryEquipmentSummary, "getEquipmentMaintenanceSummary");
}

/** Loads the "Other maintenance" summary cards for the chosen period. */
export async function getOtherMaintenanceSummary(
  range: RangeInput,
): Promise<{ ok: true; data: OtherMaintenanceSummary } | { ok: false; error: MaintenanceReportError }> {
  return loadSummary(range, queryOtherSummary, "getOtherMaintenanceSummary");
}

/** The range comes from the browser: unknown periods become 7 days, a custom range needs a valid "from" ≤ "to". */
function safeRange(input: RangeInput): SummaryRange {
  const period = (SUMMARY_PERIODS as readonly string[]).includes(input?.period) ? (input.period as SummaryPeriod) : "7D";
  if (period !== "CUSTOM") return { period };
  const from = typeof input.from === "string" && DATE_RE.test(input.from) ? input.from : undefined;
  const to = typeof input.to === "string" && DATE_RE.test(input.to) ? input.to : undefined;
  if (!from || (to && to < from)) return { period: "7D" };
  return { period, from, to };
}

async function loadSummary<T>(
  range: RangeInput,
  query: (range: SummaryRange, scopeBuildingIds: string[] | null) => Promise<T>,
  name: string,
): Promise<{ ok: true; data: T } | { ok: false; error: MaintenanceReportError }> {
  try {
    const user = await getCurrentAdminUser();
    if (!user) return { ok: false, error: "UNAUTHORIZED" };
    if (!canSeeAllTasks(user.role as TStaffRole)) return { ok: false, error: "FORBIDDEN" };

    return { ok: true, data: await query(safeRange(range), await getScopeBuildingIds(user)) };
  } catch (err) {
    console.error(`${name} failed:`, err);
    return { ok: false, error: "SERVER" };
  }
}

/** A supervisor linked to specific buildings only sees those (null = all buildings). */
async function getScopeBuildingIds(user: { id: string; role: string }): Promise<string[] | null> {
  if (user.role !== "SUPERVISOR") return null;
  const assigned = await prisma.adminUserBuilding.findMany({
    where: { adminUserId: user.id },
    select: { buildingId: true },
  });
  return assigned.length > 0 ? assigned.map((b) => b.buildingId) : null;
}

/** Tasks behind one "Equipment maintenance" summary card (opened from the card). */
export async function getEquipmentCardTasks(
  card: string,
  range: RangeInput,
): Promise<{ ok: true; data: DrilldownResult } | { ok: false; error: MaintenanceReportError }> {
  if (!(EQUIPMENT_CARDS as readonly string[]).includes(card)) return { ok: false, error: "SERVER" };
  return loadSummary(range, (r, scope) => queryEquipmentCard(card as EquipmentCard, r, scope), "getEquipmentCardTasks");
}

/** Tasks behind one "Other maintenance" summary card (opened from the card). */
export async function getOtherCardTasks(
  card: string,
  range: RangeInput,
): Promise<{ ok: true; data: DrilldownResult } | { ok: false; error: MaintenanceReportError }> {
  if (!(OTHER_CARDS as readonly string[]).includes(card)) return { ok: false, error: "SERVER" };
  return loadSummary(range, (r, scope) => queryOtherCard(card as OtherCard, r, scope), "getOtherCardTasks");
}
