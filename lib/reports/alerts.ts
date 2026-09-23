import prisma from "@/lib/prisma";
import type { BuildingPerformance } from "./buildingPerformance";
import type { TaskStatus } from "@prisma/client";

export type DashboardAlert = {
  id: string;
  type: "performance" | "issue" | "delay" | "info";
  severity: "high" | "medium";
  textEn: string;
  textAr: string;
};

export async function getDashboardAlerts(
  visibilityFilter: object, 
  buildingPerformance: BuildingPerformance[]
): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = [];
  
  // 1. Performance Alert
  for (const b of buildingPerformance) {
    if (b.val < 75) {
      alerts.push({
        id: `perf-${b.id}`,
        type: "performance",
        severity: "high",
        textEn: `${b.labelEn}: Time adherence < 75% in the last 30 days`,
        textAr: `${b.labelAr}: نسبة الالتزام بالوقت أقل من 75% في آخر 30 يوماً`
      });
    }
  }

  // 2. Unresolved Issues Alert
  const issuesCount = await prisma.task.count({
    where: {
      status: "ISSUES_FOUND",
      ...visibilityFilter
    }
  });

  if (issuesCount > 0) {
    alerts.push({
      id: "issues-found",
      type: "issue",
      severity: "high",
      textEn: `${issuesCount} tasks have unresolved issues reported during inspection`,
      textAr: `يوجد ${issuesCount} مهام تم الإبلاغ عن مشاكل بها أثناء التفتيش (تحتاج متابعة)`
    });
  }

  // 3. Severely Delayed Tasks Alert (overdue by more than 2 days)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const TERMINAL_STATUSES: TaskStatus[] = ["CLEANING_COMPLETED", "NO_ISSUES", "WORK_COMPLETED", "COMPLETED", "CANCELLED"];
  const delayedCount = await prisma.task.count({
    where: {
      dueDate: { lt: twoDaysAgo },
      status: { notIn: TERMINAL_STATUSES },
      ...visibilityFilter
    }
  });

  if (delayedCount > 0) {
    alerts.push({
      id: "severely-delayed",
      type: "delay",
      severity: "medium",
      textEn: `${delayedCount} active tasks are severely delayed (over 48 hours overdue)`,
      textAr: `${delayedCount} مهام نشطة متأخرة بشكل كبير (أكثر من 48 ساعة)`
    });
  }

  return alerts;
}
