// ─────────────────────────────────────────────────────────────────────────────
// Task type definitions — colours, labels, icons
// Safe to import in both Server and Client Components (no Prisma runtime).
// ─────────────────────────────────────────────────────────────────────────────

export type TTaskType = "CLEANING" | "INSPECTION" | "MAINTENANCE" | "WORK_ORDER";
export type TTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TStaffRole =
  | "MANAGER"
  | "SUPERVISOR"
  | "RECEPTIONIST"
  | "HOUSEKEEPING"
  | "MAINTENANCE";

export const TASK_TYPE_CONFIG: Record<
  TTaskType,
  {
    labelEn: string;
    labelAr: string;
    /** Tailwind bg colour for card left border / badge */
    bg: string;
    /** Tailwind text colour */
    text: string;
    /** Tailwind border colour */
    border: string;
    /** SVG path for the type icon */
    iconPath: string;
  }
> = {
  CLEANING: {
    labelEn: "Cleaning",
    labelAr: "تنظيف",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-300",
    iconPath:
      "M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zM13 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM13 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3z",
  },
  INSPECTION: {
    labelEn: "Inspection",
    labelAr: "فحص",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-300",
    iconPath:
      "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  },
  MAINTENANCE: {
    labelEn: "Maintenance",
    labelAr: "صيانة",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-300",
    iconPath:
      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
  WORK_ORDER: {
    labelEn: "Work Order",
    labelAr: "أمر عمل",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-300",
    iconPath:
      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  },
};

export const TASK_PRIORITY_CONFIG: Record<
  TTaskPriority,
  { labelEn: string; labelAr: string; badge: string; dot: string }
> = {
  LOW: {
    labelEn: "Low",
    labelAr: "منخفض",
    badge: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
  MEDIUM: {
    labelEn: "Medium",
    labelAr: "متوسط",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  HIGH: {
    labelEn: "High",
    labelAr: "عالٍ",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
  },
  URGENT: {
    labelEn: "Urgent",
    labelAr: "عاجل",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
};

export const STAFF_ROLE_CONFIG: Record<
  TStaffRole,
  { labelEn: string; labelAr: string; badge: string }
> = {
  MANAGER: {
    labelEn: "Manager",
    labelAr: "مدير",
    badge: "bg-purple-100 text-purple-700",
  },
  SUPERVISOR: {
    labelEn: "Supervisor",
    labelAr: "مشرف",
    badge: "bg-blue-100 text-blue-700",
  },
  RECEPTIONIST: {
    labelEn: "Receptionist",
    labelAr: "موظف استقبال",
    badge: "bg-green-100 text-green-700",
  },
  HOUSEKEEPING: {
    labelEn: "Housekeeping",
    labelAr: "تدبير المنازل",
    badge: "bg-teal-100 text-teal-700",
  },
  MAINTENANCE: {
    labelEn: "Maintenance",
    labelAr: "صيانة",
    badge: "bg-orange-100 text-orange-700",
  },
};
