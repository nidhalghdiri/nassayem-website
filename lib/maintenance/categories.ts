// ─────────────────────────────────────────────────────────────────────────────
// Maintenance request categories, common jobs, rooms and common-area places —
// the single bilingual source for the "New maintenance request" form, the
// server-side validation and the reports.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

export type MaintenanceJob = { key: string; en: string; ar: string };

/** "Other…" inside a category — needs written details. */
export const OTHER_JOB_KEY = "OTHER";
const OTHER_JOB: MaintenanceJob = { key: OTHER_JOB_KEY, en: "Other…", ar: "أخرى…" };

export const EQUIPMENT_CATEGORY = "EQUIPMENT" as const;

export type MaintenanceCategoryKey =
  | typeof EQUIPMENT_CATEGORY
  | "PLUMBING"
  | "ELECTRICAL"
  | "FURNITURE"
  | "PAINTING"
  | "INSTALLATION"
  | "DOORS_WINDOWS"
  | "GENERAL"
  | "OTHER";

export type OtherCategoryKey = Exclude<MaintenanceCategoryKey, typeof EQUIPMENT_CATEGORY>;

export const CATEGORY_LABELS: Record<MaintenanceCategoryKey, { en: string; ar: string }> = {
  EQUIPMENT: { en: "Equipment", ar: "أجهزة" },
  PLUMBING: { en: "Plumbing", ar: "سباكة" },
  ELECTRICAL: { en: "Electrical", ar: "كهرباء" },
  FURNITURE: { en: "Furniture & carpentry", ar: "أثاث ونجارة" },
  PAINTING: { en: "Painting & plastering", ar: "دهان وجبس" },
  INSTALLATION: { en: "Installation", ar: "تركيب" },
  DOORS_WINDOWS: { en: "Doors, locks & windows", ar: "أبواب وأقفال ونوافذ" },
  GENERAL: { en: "General maintenance", ar: "صيانة عامة" },
  OTHER: { en: "Other", ar: "أخرى" },
};

/** Categories of the "Other maintenance" path, in display order, with their common jobs. */
export const OTHER_CATEGORIES: { key: OtherCategoryKey; jobs: MaintenanceJob[] }[] = [
  {
    key: "PLUMBING",
    jobs: [
      { key: "SHOWER_SET", en: "Change shower set", ar: "تغيير طقم الدش" },
      { key: "LEAK", en: "Fix a leak", ar: "إصلاح تسريب" },
      { key: "FAUCET", en: "Fix or change a faucet", ar: "إصلاح أو تغيير الخلاط" },
      { key: "DRAIN", en: "Blocked drain", ar: "انسداد المجرى" },
      { key: "TOILET", en: "Toilet repair or seat cover", ar: "إصلاح المرحاض أو غطائه" },
      { key: "BATHROOM", en: "Bathroom plumbing", ar: "سباكة الحمام" },
      OTHER_JOB,
    ],
  },
  {
    key: "ELECTRICAL",
    jobs: [
      { key: "LIGHT_SWITCH", en: "Fix a light or switch", ar: "إصلاح إنارة أو مفتاح" },
      { key: "SOCKET", en: "Fix a socket", ar: "إصلاح مقبس كهرباء" },
      { key: "AC_SWITCH", en: "Change AC switch", ar: "تغيير مفتاح المكيف" },
      { key: "POWER_CUT", en: "Power cut / breaker tripping", ar: "انقطاع الكهرباء / فصل القاطع" },
      OTHER_JOB,
    ],
  },
  {
    key: "FURNITURE",
    jobs: [
      { key: "BED", en: "Fix a bed", ar: "إصلاح سرير" },
      { key: "KITCHEN_CABINET", en: "Fix kitchen cabinet", ar: "إصلاح خزانة المطبخ" },
      { key: "WARDROBE", en: "Fix a wardrobe", ar: "إصلاح دولاب الملابس" },
      { key: "TABLE_CHAIR", en: "Fix a table or chair", ar: "إصلاح طاولة أو كرسي" },
      { key: "SOFA", en: "Fix a sofa", ar: "إصلاح كنبة" },
      OTHER_JOB,
    ],
  },
  {
    key: "PAINTING",
    jobs: [
      { key: "PAINTING", en: "Painting", ar: "دهان" },
      { key: "NEW_PLASTER", en: "New plastering", ar: "جبس / بياض جديد" },
      { key: "REMOVE_PLASTER", en: "Remove plaster", ar: "إزالة الجبس" },
      { key: "WALL_REPAIR", en: "Wall repair", ar: "إصلاح جدار" },
      OTHER_JOB,
    ],
  },
  {
    key: "INSTALLATION",
    jobs: [
      { key: "CURTAINS", en: "Install curtains", ar: "تركيب ستائر" },
      { key: "TV_BRACKET", en: "Install a TV or bracket", ar: "تركيب تلفاز أو حامل" },
      { key: "SHELF_MIRROR", en: "Install a shelf or mirror", ar: "تركيب رف أو مرآة" },
      { key: "NEW_ITEM", en: "Install a new item", ar: "تركيب قطعة جديدة" },
      { key: "REPLACE_ITEM", en: "Replace an item", ar: "استبدال قطعة" },
      OTHER_JOB,
    ],
  },
  {
    key: "DOORS_WINDOWS",
    jobs: [
      { key: "DOOR_LOCK", en: "Door lock", ar: "قفل الباب" },
      { key: "DOOR_ADJUST", en: "Door handle or alignment", ar: "مقبض أو ضبط الباب" },
      { key: "WINDOW", en: "Window", ar: "نافذة" },
      { key: "SLIDING_DOOR", en: "Sliding door", ar: "باب منزلق" },
      OTHER_JOB,
    ],
  },
  {
    key: "GENERAL",
    jobs: [
      { key: "FULL_MAINTENANCE", en: "Full maintenance", ar: "صيانة شاملة" },
      { key: "CHECKOUT_REPAIRS", en: "Check-out repairs", ar: "إصلاحات ما بعد المغادرة" },
      { key: "PRE_ARRIVAL", en: "Pre-arrival check", ar: "فحص قبل الوصول" },
      OTHER_JOB,
    ],
  },
  // Free text only — the details are required
  { key: "OTHER", jobs: [] },
];

/** Rooms inside a unit (optional). */
export const ROOMS: { key: string; en: string; ar: string }[] = [
  { key: "LIVING_ROOM", en: "Living room", ar: "الصالة" },
  { key: "MASTER_BEDROOM", en: "Master bedroom", ar: "غرفة النوم الرئيسية" },
  { key: "BEDROOM_2", en: "Bedroom 2", ar: "غرفة النوم 2" },
  { key: "BEDROOM_3", en: "Bedroom 3", ar: "غرفة النوم 3" },
  { key: "KITCHEN", en: "Kitchen", ar: "المطبخ" },
  { key: "BATHROOM", en: "Bathroom", ar: "الحمام" },
  { key: "LAUNDRY", en: "Laundry room", ar: "غرفة الغسيل" },
  { key: "BALCONY", en: "Balcony", ar: "الشرفة" },
  { key: "ENTRANCE", en: "Entrance", ar: "المدخل" },
];

/** Quick picks for a request about a common area (the place is free text). */
export const COMMON_AREA_PLACES: { key: string; en: string; ar: string }[] = [
  { key: "LOBBY", en: "Lobby", ar: "اللوبي" },
  { key: "RECEPTION", en: "Reception", ar: "الاستقبال" },
  { key: "CORRIDOR", en: "Corridor", ar: "الممر" },
  { key: "STAIRS", en: "Stairs", ar: "الدرج" },
  { key: "ELEVATOR", en: "Elevator", ar: "المصعد" },
  { key: "PARKING", en: "Parking", ar: "المواقف" },
  { key: "ROOF", en: "Roof", ar: "السطح" },
  { key: "POOL", en: "Pool", ar: "المسبح" },
  { key: "GARDEN", en: "Garden", ar: "الحديقة" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isCategoryKey(value: string | null | undefined): value is MaintenanceCategoryKey {
  return !!value && value in CATEGORY_LABELS;
}

export function categoryLabel(key: string | null | undefined, isEn: boolean): string | null {
  if (!isCategoryKey(key)) return null;
  return isEn ? CATEGORY_LABELS[key].en : CATEGORY_LABELS[key].ar;
}

export function getJobs(category: string): MaintenanceJob[] {
  return OTHER_CATEGORIES.find((c) => c.key === category)?.jobs ?? [];
}

export function findJob(category: string, jobKey: string): MaintenanceJob | undefined {
  return getJobs(category).find((j) => j.key === jobKey);
}

/**
 * `room` holds a room key for a unit ("KITCHEN") or free text for a common
 * area ("Lobby"). Known keys are translated; anything else is shown as typed.
 */
export function roomLabel(value: string | null | undefined, isEn: boolean): string | null {
  if (!value) return null;
  const room = ROOMS.find((r) => r.key === value);
  return room ? (isEn ? room.en : room.ar) : value;
}
