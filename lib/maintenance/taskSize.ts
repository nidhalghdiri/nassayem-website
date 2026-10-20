// ─────────────────────────────────────────────────────────────────────────────
// Size of a maintenance request, chosen in the "New maintenance request" form
// and used to compare technician performance on like-for-like work.
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
