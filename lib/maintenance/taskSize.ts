// ─────────────────────────────────────────────────────────────────────────────
// Size of a task, used to compare performance on like-for-like work.
//
// The size is CLASSIFIED from the expected duration entered when the task is
// created — it is never picked by hand, so an employee cannot inflate their own
// rating by choosing a bigger size:
//
//   hours < 5        → SMALL   (صغيرة)
//   5 <= hours < 7   → MEDIUM  (متوسطة)
//   hours >= 7       → LARGE   (كبيرة)
//
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

export const TASK_SIZES = ["LARGE", "MEDIUM", "SMALL"] as const;
export type TaskSize = (typeof TASK_SIZES)[number];

export const TASK_SIZE_LABELS: Record<TaskSize, { en: string; ar: string }> = {
  LARGE: { en: "Large", ar: "كبيرة" },
  MEDIUM: { en: "Medium", ar: "متوسطة" },
  SMALL: { en: "Small", ar: "صغيرة" },
};

export function isTaskSize(value: unknown): value is TaskSize {
  return typeof value === "string" && (TASK_SIZES as readonly string[]).includes(value);
}

export function taskSizeLabel(value: string | null | undefined, isEn: boolean): string | null {
  if (!isTaskSize(value)) return null;
  return isEn ? TASK_SIZE_LABELS[value].en : TASK_SIZE_LABELS[value].ar;
}

// ── Classification from the expected duration ───────────────────────────────

/** Minimum expected duration, and the step the form's input moves in. */
export const EXPECTED_HOURS_MIN = 1;
export const EXPECTED_HOURS_STEP = 0.5;
/** Guard against a typo like "800" hours. */
export const EXPECTED_HOURS_MAX = 100;

/** Boundaries of the size bands, in hours. */
export const SIZE_THRESHOLDS = { medium: 5, large: 7 } as const;

/**
 * The size band for an expected duration in hours.
 * Returns null when there is no usable number, so older tasks (and anything
 * mis-typed) stay unsized rather than being guessed at.
 */
export function classifyTaskSize(hours: number | null | undefined): TaskSize | null {
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < EXPECTED_HOURS_MIN) return null;
  if (hours < SIZE_THRESHOLDS.medium) return "SMALL";
  if (hours < SIZE_THRESHOLDS.large) return "MEDIUM";
  return "LARGE";
}

/** Validates and normalises an expected-hours value coming from a form. */
export function parseExpectedHours(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n < EXPECTED_HOURS_MIN || n > EXPECTED_HOURS_MAX) return null;
  // Snap to the half-hour step the form uses.
  return Math.round(n / EXPECTED_HOURS_STEP) * EXPECTED_HOURS_STEP;
}

/** Tailwind classes for the size badge, matching the colours in the spec. */
export const TASK_SIZE_BADGE: Record<TaskSize, string> = {
  SMALL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LARGE: "bg-red-50 text-red-700 border-red-200",
};

/** Shown where a task has no size (created before the field existed). */
export function taskSizeLabelOrUnset(value: string | null | undefined, isEn: boolean): string {
  return taskSizeLabel(value, isEn) ?? (isEn ? "Unspecified" : "غير محدد");
}

// ── Anti-inflation controls ─────────────────────────────────────────────────
// The expected duration is typed by whoever creates the task and carries 35 of
// the 100 ranking points, so three guards keep it honest:
//   • a task whose actual duration differs by more than VARIANCE_FLAG_PCT is
//     flagged for review,
//   • a LARGE task only scores its full hours once a manager approves the size,
//   • every edit of the expected duration is written to the activity log.

/** Flag a task when |actual − expected| exceeds this share of the expected. */
export const VARIANCE_FLAG_PCT = 50;

/** Signed difference between actual and expected, as a percentage. */
export function durationVariancePct(
  expectedHours: number | null | undefined,
  actualHours: number | null | undefined,
): number | null {
  if (typeof expectedHours !== "number" || expectedHours <= 0) return null;
  if (typeof actualHours !== "number") return null;
  return Math.round(((actualHours - expectedHours) / expectedHours) * 100);
}

/** Does this task need a review because expected and actual diverged too far? */
export function needsVarianceReview(
  expectedHours: number | null | undefined,
  actualHours: number | null | undefined,
): boolean {
  const v = durationVariancePct(expectedHours, actualHours);
  return v !== null && Math.abs(v) > VARIANCE_FLAG_PCT;
}

/** Does this task's size require a manager's approval to count in full? */
export function sizeNeedsApproval(taskSize: string | null | undefined): boolean {
  return taskSize === "LARGE";
}

/**
 * The size the scoring should use. A LARGE task counts as MEDIUM until a
 * manager approves it, so an inflated estimate cannot lift a rating by itself.
 */
export function effectiveTaskSize(
  taskSize: string | null | undefined,
  sizeApprovedAt: Date | string | null | undefined,
): TaskSize | null {
  if (!isTaskSize(taskSize)) return null;
  if (taskSize === "LARGE" && !sizeApprovedAt) return "MEDIUM";
  return taskSize;
}

/**
 * The hours the scoring should credit. A LARGE task awaiting approval is capped
 * at the top of the MEDIUM band, so the extra hours only count once approved.
 */
export function effectiveExpectedHours(
  expectedHours: number | null | undefined,
  taskSize: string | null | undefined,
  sizeApprovedAt: Date | string | null | undefined,
): number | null {
  if (typeof expectedHours !== "number") return null;
  if (taskSize === "LARGE" && !sizeApprovedAt) {
    // Just under the LARGE threshold — credited as a medium task would be.
    return Math.min(expectedHours, SIZE_THRESHOLDS.large);
  }
  return expectedHours;
}
