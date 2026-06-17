// ─────────────────────────────────────────────────────────────────────────────
// Laundry custody workflow — the linear handoff chain and its rules.
// Safe to import in both Server and Client Components (no Prisma runtime).
//
// Chain: REQUESTED → AT_LAUNDRY → PROCESSING → READY
//        → OUT_FOR_DELIVERY → DELIVERED
// The supervisor physically collects from the building and brings it to the
// laundry, but the first tracked/counted event is the laundry man's receipt.
// Each forward step is performed by one role, optionally captures a counted
// quantity per item, and stamps a timestamp (and sometimes a person) on the
// order. CANCELLED is handled separately (see permissions.canCancelLaundry).
// ─────────────────────────────────────────────────────────────────────────────

import type { TStaffRole } from "@/lib/tasks/constants";
import type { TLaundryStatus, TLaundryCountField } from "./constants";
import { COUNT_FIELD_ORDER } from "./constants";

// Timestamp columns on LaundryOrder, one per stage entered.
export type TLaundryTimestampField =
  | "atLaundryAt"
  | "processingAt"
  | "readyAt"
  | "outForDeliveryAt"
  | "deliveredAt";

export type LaundryTransition = {
  from: TLaundryStatus;
  to: TLaundryStatus;
  /** Role expected to perform this step. MANAGER may always perform any step. */
  actorRole: TStaffRole;
  /** Per-item count captured at this step, or null if no count is needed. */
  countField: TLaundryCountField | null;
  /** Timestamp column stamped on the order when this step runs. */
  timestampField: TLaundryTimestampField;
  /** Person column to record the actor on, or null. */
  personField: "supervisorId" | "laundryUserId" | null;
  labelEn: string;
  labelAr: string;
};

// ─── The forward chain ───────────────────────────────────────────────────────
// Exactly one forward transition leaves each non-terminal status.
export const LAUNDRY_TRANSITIONS: LaundryTransition[] = [
  {
    from: "REQUESTED",
    to: "AT_LAUNDRY",
    actorRole: "LAUNDRY",
    countField: "atLaundryQty",
    timestampField: "atLaundryAt",
    personField: "laundryUserId",
    labelEn: "Receive at Laundry",
    labelAr: "استلام في المغسلة",
  },
  {
    from: "AT_LAUNDRY",
    to: "PROCESSING",
    actorRole: "LAUNDRY",
    countField: null,
    timestampField: "processingAt",
    personField: null,
    labelEn: "Start Processing",
    labelAr: "بدء المعالجة",
  },
  {
    from: "PROCESSING",
    to: "READY",
    actorRole: "LAUNDRY",
    countField: null,
    timestampField: "readyAt",
    personField: null,
    labelEn: "Mark Ready",
    labelAr: "تحديد كجاهز",
  },
  {
    from: "READY",
    to: "OUT_FOR_DELIVERY",
    actorRole: "SUPERVISOR",
    countField: "returnedQty",
    timestampField: "outForDeliveryAt",
    personField: "supervisorId",
    labelEn: "Collect Ready Laundry",
    labelAr: "استلام الغسيل الجاهز",
  },
  {
    from: "OUT_FOR_DELIVERY",
    to: "DELIVERED",
    actorRole: "RECEPTIONIST",
    countField: "deliveredQty",
    timestampField: "deliveredAt",
    personField: null,
    labelEn: "Receive & Verify",
    labelAr: "استلام وتحقق",
  },
];

export const TERMINAL_LAUNDRY_STATUSES: TLaundryStatus[] = [
  "DELIVERED",
  "CANCELLED",
];

export function isTerminalLaundryStatus(status: TLaundryStatus): boolean {
  return TERMINAL_LAUNDRY_STATUSES.includes(status);
}

/** The single forward transition leaving `status`, or null if terminal. */
export function getForwardTransition(
  status: TLaundryStatus,
): LaundryTransition | null {
  return LAUNDRY_TRANSITIONS.find((t) => t.from === status) ?? null;
}

/** Look up the transition for a specific (from → to) pair. */
export function getTransition(
  from: TLaundryStatus,
  to: TLaundryStatus,
): LaundryTransition | null {
  return LAUNDRY_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

// ─── Discrepancy engine ──────────────────────────────────────────────────────

export type ItemCounts = Partial<Record<TLaundryCountField, number | null>>;

export type LaundryLeg = {
  /** Count field at the end of this leg. */
  field: TLaundryCountField;
  /** The previous recorded count field (the baseline for this leg). */
  prevField: TLaundryCountField;
  prevValue: number;
  value: number;
  /** prevValue - value. Positive = pieces lost on this leg. */
  delta: number;
};

/**
 * Computes the per-leg deltas for a single item. Only legs where BOTH the
 * current and previous counts have been recorded are returned. A positive
 * `delta` means pieces went missing on that leg.
 */
export function getItemLegs(counts: ItemCounts): LaundryLeg[] {
  const legs: LaundryLeg[] = [];
  for (let i = 1; i < COUNT_FIELD_ORDER.length; i++) {
    const field = COUNT_FIELD_ORDER[i];
    const prevField = COUNT_FIELD_ORDER[i - 1];
    const value = counts[field];
    const prevValue = counts[prevField];
    if (
      value === null ||
      value === undefined ||
      prevValue === null ||
      prevValue === undefined
    ) {
      continue;
    }
    legs.push({
      field,
      prevField,
      prevValue,
      value,
      delta: prevValue - value,
    });
  }
  return legs;
}

/** Total pieces missing for an item so far (sum of positive leg deltas). */
export function getItemMissing(counts: ItemCounts): number {
  return getItemLegs(counts).reduce(
    (sum, leg) => sum + Math.max(0, leg.delta),
    0,
  );
}

/** True if any leg of the item shows a shortfall. */
export function itemHasDiscrepancy(counts: ItemCounts): boolean {
  return getItemLegs(counts).some((leg) => leg.delta > 0);
}
