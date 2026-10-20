// ─────────────────────────────────────────────────────────────────────────────
// Priority choices on the "New maintenance request" form. Each one maps to a
// task priority and how soon the work is due.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

import type { TTaskPriority } from "@/lib/tasks/constants";

export const REQUEST_PRIORITIES: {
  key: TTaskPriority;
  dueInHours: number;
  en: string;
  ar: string;
  /** Tailwind bg colour for the dot */
  dot: string;
}[] = [
  { key: "URGENT", dueInHours: 2, en: "Urgent — within 2 hours", ar: "عاجل — خلال ساعتين", dot: "bg-red-500" },
  { key: "HIGH", dueInHours: 8, en: "High — within 8 hours", ar: "مرتفع — خلال 8 ساعات", dot: "bg-orange-500" },
  { key: "MEDIUM", dueInHours: 24, en: "Normal — within 24 hours", ar: "عادي — خلال 24 ساعة", dot: "bg-green-500" },
  { key: "LOW", dueInHours: 7 * 24, en: "Scheduled / preventive", ar: "مجدول / وقائي", dot: "bg-blue-500" },
];

export const DEFAULT_REQUEST_PRIORITY: TTaskPriority = "MEDIUM";

export function findRequestPriority(key: string | undefined) {
  return REQUEST_PRIORITIES.find((p) => p.key === key);
}
