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

    let scopeBuildingIds: string[] | null = null;
    if (user.role === "SUPERVISOR") {
      const assigned = await prisma.adminUserBuilding.findMany({
        where: { adminUserId: user.id },
        select: { buildingId: true },
      });
      if (assigned.length > 0) scopeBuildingIds = assigned.map((b) => b.buildingId);
    }

    return { ok: true, data: await queryReport(filters, scopeBuildingIds) };
  } catch (err) {
    console.error("getMaintenanceTasksReport failed:", err);
    return { ok: false, error: "SERVER" };
  }
}
