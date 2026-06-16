// ─────────────────────────────────────────────────────────────────────────────
// Laundry status & count-stage definitions — labels, colours, custody stages.
// Safe to import in both Server and Client Components (no Prisma runtime).
// Priority reuses the shared Task priority config.
// ─────────────────────────────────────────────────────────────────────────────

export type TLaundryStatus =
  | "REQUESTED"
  | "PICKED_UP"
  | "AT_LAUNDRY"
  | "PROCESSING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

// The per-item count columns, in custody order. Each is captured by a
// different custodian, so a missing piece can be traced to the exact leg.
export type TLaundryCountField =
  | "requestedQty"
  | "pickedUpQty"
  | "atLaundryQty"
  | "returnedQty"
  | "deliveredQty";

export const LAUNDRY_STATUS_CONFIG: Record<
  TLaundryStatus,
  { labelEn: string; labelAr: string; badge: string; step: number }
> = {
  REQUESTED: {
    labelEn: "Requested",
    labelAr: "تم الطلب",
    badge: "bg-blue-100 text-blue-700",
    step: 1,
  },
  PICKED_UP: {
    labelEn: "Picked Up",
    labelAr: "تم الاستلام",
    badge: "bg-cyan-100 text-cyan-700",
    step: 2,
  },
  AT_LAUNDRY: {
    labelEn: "At Laundry",
    labelAr: "في المغسلة",
    badge: "bg-indigo-100 text-indigo-700",
    step: 3,
  },
  PROCESSING: {
    labelEn: "Processing",
    labelAr: "قيد المعالجة",
    badge: "bg-purple-100 text-purple-700",
    step: 4,
  },
  READY: {
    labelEn: "Ready",
    labelAr: "جاهز",
    badge: "bg-teal-100 text-teal-700",
    step: 5,
  },
  OUT_FOR_DELIVERY: {
    labelEn: "Out for Delivery",
    labelAr: "قيد التوصيل",
    badge: "bg-amber-100 text-amber-700",
    step: 6,
  },
  DELIVERED: {
    labelEn: "Delivered",
    labelAr: "تم التسليم",
    badge: "bg-green-100 text-green-700",
    step: 7,
  },
  CANCELLED: {
    labelEn: "Cancelled",
    labelAr: "ملغي",
    badge: "bg-red-50 text-red-500",
    step: 0,
  },
};

// ─── Custody stages ──────────────────────────────────────────────────────────
// Ordered list driving the per-item count table. `field` is the column the
// custodian fills; `byRoleEn/Ar` names who is responsible at that stage.
export const COUNT_STAGES: {
  field: TLaundryCountField;
  labelEn: string;
  labelAr: string;
  byRoleEn: string;
  byRoleAr: string;
}[] = [
  {
    field: "requestedQty",
    labelEn: "Requested",
    labelAr: "مطلوب",
    byRoleEn: "Receptionist",
    byRoleAr: "موظف الاستقبال",
  },
  {
    field: "pickedUpQty",
    labelEn: "Picked Up",
    labelAr: "تم الاستلام",
    byRoleEn: "Supervisor",
    byRoleAr: "المشرف",
  },
  {
    field: "atLaundryQty",
    labelEn: "At Laundry",
    labelAr: "في المغسلة",
    byRoleEn: "Laundry",
    byRoleAr: "المغسلة",
  },
  {
    field: "returnedQty",
    labelEn: "Returned",
    labelAr: "تم الإرجاع",
    byRoleEn: "Supervisor",
    byRoleAr: "المشرف",
  },
  {
    field: "deliveredQty",
    labelEn: "Delivered",
    labelAr: "تم التسليم",
    byRoleEn: "Receptionist",
    byRoleAr: "موظف الاستقبال",
  },
];

// Field order used by the discrepancy engine (see lib/laundry/workflow.ts).
export const COUNT_FIELD_ORDER: TLaundryCountField[] = COUNT_STAGES.map(
  (s) => s.field,
);
