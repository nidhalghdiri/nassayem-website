// ─────────────────────────────────────────────────────────────────────────────
// Task status definitions — labels, colours, valid transitions per type.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

import type { TTaskType } from "./constants";

export type TTaskStatus =
  | "PENDING_APPROVAL"
  | "ASSIGNED"
  | "CLEANING_STARTED"
  | "CLEANING_COMPLETED"
  | "INSPECTING"
  | "ISSUES_FOUND"
  | "NO_ISSUES"
  | "WORK_STARTED"
  | "WORK_COMPLETED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ON_HOLD"
  | "CANCELLED";

export const STATUS_CONFIG: Record<
  TTaskStatus,
  { labelEn: string; labelAr: string; badge: string }
> = {
  PENDING_APPROVAL: {
    labelEn: "Pending Approval",
    labelAr: "قيد الموافقة",
    badge: "bg-yellow-100 text-yellow-700",
  },
  ASSIGNED: {
    labelEn: "Assigned",
    labelAr: "مُعيَّن",
    badge: "bg-blue-100 text-blue-700",
  },
  CLEANING_STARTED: {
    labelEn: "Cleaning Started",
    labelAr: "بدأ التنظيف",
    badge: "bg-cyan-100 text-cyan-700",
  },
  CLEANING_COMPLETED: {
    labelEn: "Cleaning Completed",
    labelAr: "اكتمل التنظيف",
    badge: "bg-green-100 text-green-700",
  },
  INSPECTING: {
    labelEn: "Inspecting",
    labelAr: "قيد الفحص",
    badge: "bg-orange-100 text-orange-700",
  },
  ISSUES_FOUND: {
    labelEn: "Issues Found",
    labelAr: "تم اكتشاف مشاكل",
    badge: "bg-red-100 text-red-700",
  },
  NO_ISSUES: {
    labelEn: "No Issues",
    labelAr: "لا توجد مشاكل",
    badge: "bg-green-100 text-green-700",
  },
  WORK_STARTED: {
    labelEn: "Work Started",
    labelAr: "بدأ العمل",
    badge: "bg-blue-100 text-blue-700",
  },
  WORK_COMPLETED: {
    labelEn: "Work Completed",
    labelAr: "اكتمل العمل",
    badge: "bg-green-100 text-green-700",
  },
  IN_PROGRESS: {
    labelEn: "In Progress",
    labelAr: "جارٍ العمل",
    badge: "bg-blue-100 text-blue-700",
  },
  COMPLETED: {
    labelEn: "Completed",
    labelAr: "مكتمل",
    badge: "bg-green-100 text-green-700",
  },
  ON_HOLD: {
    labelEn: "On Hold",
    labelAr: "معلق",
    badge: "bg-gray-100 text-gray-600",
  },
  CANCELLED: {
    labelEn: "Cancelled",
    labelAr: "ملغي",
    badge: "bg-red-50 text-red-500",
  },
};

// ─── Valid status transitions per task type ──────────────────────────────────
// Key = current status → Value = statuses the assigned user can move to.
// Approval transitions (PENDING_APPROVAL → ASSIGNED / CANCELLED) are handled
// separately in the approve/reject endpoints and are not listed here.

export const STATUS_TRANSITIONS: Record<
  TTaskType,
  Partial<Record<TTaskStatus, TTaskStatus[]>>
> = {
  CLEANING: {
    ASSIGNED: ["CLEANING_STARTED", "ON_HOLD", "CANCELLED"],
    CLEANING_STARTED: ["CLEANING_COMPLETED", "ON_HOLD"],
    ON_HOLD: ["CLEANING_STARTED", "CANCELLED"],
  },
  INSPECTION: {
    ASSIGNED: ["INSPECTING", "ON_HOLD", "CANCELLED"],
    INSPECTING: ["ISSUES_FOUND", "NO_ISSUES", "ON_HOLD"],
    ISSUES_FOUND: ["ON_HOLD", "CANCELLED"],
    ON_HOLD: ["INSPECTING", "CANCELLED"],
  },
  MAINTENANCE: {
    // PENDING_APPROVAL is handled by approve/reject — not listed here
    ASSIGNED: ["WORK_STARTED", "ON_HOLD", "CANCELLED"],
    WORK_STARTED: ["WORK_COMPLETED", "ON_HOLD"],
    ON_HOLD: ["WORK_STARTED", "CANCELLED"],
  },
  WORK_ORDER: {
    ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "ON_HOLD"],
    ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  },
};

// ─── Action button labels for each target status ────────────────────────────
export const TRANSITION_BUTTON_LABEL: Partial<
  Record<TTaskStatus, { labelEn: string; labelAr: string }>
> = {
  CLEANING_STARTED: { labelEn: "Start Cleaning", labelAr: "ابدأ التنظيف" },
  CLEANING_COMPLETED: {
    labelEn: "Complete Cleaning",
    labelAr: "أكمل التنظيف",
  },
  INSPECTING: { labelEn: "Start Inspection", labelAr: "ابدأ الفحص" },
  ISSUES_FOUND: { labelEn: "Issues Found", labelAr: "تحديد وجود مشاكل" },
  NO_ISSUES: { labelEn: "No Issues", labelAr: "لا توجد مشاكل" },
  WORK_STARTED: { labelEn: "Start Work", labelAr: "ابدأ العمل" },
  WORK_COMPLETED: { labelEn: "Complete Work", labelAr: "أكمل العمل" },
  IN_PROGRESS: { labelEn: "Start Task", labelAr: "ابدأ المهمة" },
  COMPLETED: { labelEn: "Mark Complete", labelAr: "تحديد كمكتملة" },
  ON_HOLD: { labelEn: "Put On Hold", labelAr: "تعليق" },
  CANCELLED: { labelEn: "Cancel", labelAr: "إلغاء" },
  ASSIGNED: { labelEn: "Re-open", labelAr: "إعادة فتح" },
};

// ─── "Terminal" statuses — no further transitions possible ──────────────────
export const TERMINAL_STATUSES: TTaskStatus[] = [
  "CLEANING_COMPLETED",
  "NO_ISSUES",
  "WORK_COMPLETED",
  "COMPLETED",
  "CANCELLED",
];

/** Returns the initial status for a new task (or PENDING_APPROVAL for requests) */
export function getInitialStatus(
  type: TTaskType,
  requiresApproval: boolean,
): TTaskStatus {
  if (requiresApproval) return "PENDING_APPROVAL";
  return "ASSIGNED";
}
