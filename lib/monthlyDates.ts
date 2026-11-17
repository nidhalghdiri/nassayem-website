// ─────────────────────────────────────────────────────────────────────────────
// Calendar-month helpers for monthly stays. Pure (no Prisma) so they can run in
// client components (search widgets) as well as in the pricing engine.
//
// A monthly stay is counted in calendar months, never days:
//   3 months from 17/11/2026 → check-out 17/02/2027.
// When the start day doesn't exist in the target month, it clamps to that
// month's last day (1 month from 31/01 → 28/02 or 29/02).
// ─────────────────────────────────────────────────────────────────────────────

import { addMonths, format, parseISO } from "date-fns";

export const MONTHLY_DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" + N calendar months → "YYYY-MM-DD" (or "" for a bad date). */
export function addMonthsISO(startISO: string, months: number): string {
  if (!ISO.test(startISO) || !(months > 0)) return "";
  return format(addMonths(parseISO(startISO), months), "yyyy-MM-dd");
}

/**
 * Whole calendar months between two dates when `end` falls exactly N months
 * after `start` (N ≥ 1); null otherwise (an odd-length, day-based range).
 */
export function calendarMonthsBetween(start: Date, end: Date): number | null {
  if (!(end > start)) return null;
  const approx =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  for (const n of [approx, approx + 1]) {
    if (n < 1) continue;
    const candidate = addMonths(start, n);
    if (
      candidate.getFullYear() === end.getFullYear() &&
      candidate.getMonth() === end.getMonth() &&
      candidate.getDate() === end.getDate()
    ) {
      return n;
    }
  }
  return null;
}

/** Same as calendarMonthsBetween, for "YYYY-MM-DD" strings. */
export function calendarMonthsBetweenISO(startISO: string, endISO: string): number | null {
  if (!ISO.test(startISO) || !ISO.test(endISO)) return null;
  return calendarMonthsBetween(parseISO(startISO), parseISO(endISO));
}

/** True when any night in [startISO, endISO) falls in July or August (Khareef). */
export function rangeTouchesKhareefISO(startISO: string, endISO: string): boolean {
  if (!ISO.test(startISO) || !ISO.test(endISO)) return false;
  const cursor = parseISO(startISO);
  const end = parseISO(endISO);
  while (cursor < end) {
    const m = cursor.getMonth();
    if (m === 6 || m === 7) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" for display. */
export function formatISODisplay(iso: string): string {
  if (!ISO.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "3 months" / "3 أشهر". */
export function monthsLabel(n: number, isEn: boolean): string {
  if (isEn) return n === 1 ? "1 month" : `${n} months`;
  if (n === 1) return "شهر واحد";
  if (n === 2) return "شهرين";
  if (n <= 10) return `${n} أشهر`;
  return `${n} شهرًا`;
}
