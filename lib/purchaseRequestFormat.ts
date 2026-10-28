/**
 * Presentation helpers for purchase requests, shared by the server page and the
 * client list/detail components. No server-only imports, so it is safe in both.
 */

import {
  PURCHASE_REQUEST_STATUS_LABELS,
  type PurchaseRequestPriority,
  type PurchaseRequestRejectStage,
  type PurchaseRequestStatus,
} from "@/lib/netsuitePurchaseRequests";

/** OMR with 2 decimals — "7.00 OMR" / "7.00 ر.ع". */
export function formatOmr(amount: number, isEn: boolean): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toFixed(2)} ${isEn ? "OMR" : "ر.ع"}`;
}

/** Quantity: integers plain, fractions to 2 decimals. */
export function formatQuantity(qty: number): string {
  const n = Number.isFinite(qty) ? qty : 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function statusLabel(status: PurchaseRequestStatus, isEn: boolean): string {
  const labels = PURCHASE_REQUEST_STATUS_LABELS[status];
  if (!labels) return status;
  return isEn ? labels.en : labels.ar;
}

/** Badge classes per status — pending stages amber, approved green, rejected red. */
export const STATUS_BADGE_STYLES: Record<PurchaseRequestStatus, string> = {
  pending_supervisor: "bg-amber-100 text-amber-800 border-amber-200",
  pending_accounts: "bg-sky-100 text-sky-800 border-sky-200",
  pending_gm: "bg-indigo-100 text-indigo-800 border-indigo-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

export function priorityLabel(priority: PurchaseRequestPriority, isEn: boolean): string {
  return priority === "urgent"
    ? isEn
      ? "Urgent"
      : "عاجل"
    : isEn
      ? "Normal"
      : "عادي";
}

/** Urgent has to stand out; normal stays quiet. */
export const PRIORITY_BADGE_STYLES: Record<PurchaseRequestPriority, string> = {
  urgent: "bg-red-600 text-white border-red-700",
  normal: "bg-gray-100 text-gray-600 border-gray-200",
};

export function rejectStageLabel(
  stage: PurchaseRequestRejectStage,
  isEn: boolean,
): string {
  switch (stage) {
    case "supervisor":
      return isEn ? "Supervisor" : "المشرف";
    case "accounts":
      return isEn ? "Accounts" : "الحسابات";
    case "gm":
      return isEn ? "General Manager" : "المدير العام";
  }
}

/**
 * Formats an ISO timestamp from NetSuite for display. Returns null for empty or
 * unparseable values so callers can fall back rather than print "Invalid Date".
 */
export function formatDateTime(iso: string | null | undefined, isEn: boolean): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(isEn ? "en-GB" : "ar-OM", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a YYYY-MM-DD request date; falls back to the raw string. */
export function formatDate(value: string | null | undefined, isEn: boolean): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(isEn ? "en-GB" : "ar-OM", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}
