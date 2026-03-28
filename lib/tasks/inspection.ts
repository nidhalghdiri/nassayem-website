// ─────────────────────────────────────────────────────────────────────────────
// Inspection checklist defaults and types.
// Safe to import in both Server and Client Components.
// ─────────────────────────────────────────────────────────────────────────────

export type TItemStatus = "pending" | "pass" | "fail" | "na";
export type TSeverity = "minor" | "major" | "critical";
export type TOverallRating = "excellent" | "good" | "fair" | "poor";

export const OVERALL_RATING_CONFIG: Record<
  TOverallRating,
  { labelEn: string; labelAr: string; badge: string; bg: string; border: string }
> = {
  excellent: { labelEn: "Excellent", labelAr: "ممتاز", badge: "bg-green-100 text-green-700", bg: "bg-green-50", border: "border-green-300" },
  good:      { labelEn: "Good",      labelAr: "جيد",   badge: "bg-blue-100 text-blue-700",  bg: "bg-blue-50",  border: "border-blue-300"  },
  fair:      { labelEn: "Fair",      labelAr: "مقبول", badge: "bg-yellow-100 text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-300" },
  poor:      { labelEn: "Poor",      labelAr: "ضعيف",  badge: "bg-red-100 text-red-700",    bg: "bg-red-50",   border: "border-red-300"   },
};

export const SEVERITY_CONFIG: Record<
  TSeverity,
  { labelEn: string; labelAr: string; badge: string }
> = {
  minor:    { labelEn: "Minor",    labelAr: "طفيف",  badge: "bg-yellow-100 text-yellow-700" },
  major:    { labelEn: "Major",    labelAr: "كبير",  badge: "bg-orange-100 text-orange-700" },
  critical: { labelEn: "Critical", labelAr: "حرج",   badge: "bg-red-100 text-red-700" },
};

type DefaultItem = { category: string; labelEn: string; labelAr: string };

export const DEFAULT_CHECKLIST_ITEMS: DefaultItem[] = [
  // General
  { category: "General", labelEn: "Doors & locks working",    labelAr: "الأبواب والأقفال تعمل" },
  { category: "General", labelEn: "Windows intact",           labelAr: "النوافذ سليمة" },
  { category: "General", labelEn: "Walls & ceiling condition", labelAr: "حالة الجدران والسقف" },
  { category: "General", labelEn: "Flooring condition",       labelAr: "حالة الأرضيات" },
  { category: "General", labelEn: "Light fixtures working",   labelAr: "تركيبات الإضاءة تعمل" },
  { category: "General", labelEn: "AC / heating working",     labelAr: "التكييف / التدفئة يعمل" },
  { category: "General", labelEn: "Electrical outlets working", labelAr: "مقابس الكهرباء تعمل" },

  // Kitchen
  { category: "Kitchen", labelEn: "Appliances working",       labelAr: "الأجهزة تعمل" },
  { category: "Kitchen", labelEn: "Sink & faucet condition",  labelAr: "حالة الحوض والصنبور" },
  { category: "Kitchen", labelEn: "Cabinets & drawers",       labelAr: "الخزائن والأدراج" },
  { category: "Kitchen", labelEn: "Countertops clean / undamaged", labelAr: "أسطح العمل نظيفة / غير تالفة" },

  // Bathroom
  { category: "Bathroom", labelEn: "Toilet working",          labelAr: "المرحاض يعمل" },
  { category: "Bathroom", labelEn: "Shower / tub condition",  labelAr: "حالة الدش / البانيو" },
  { category: "Bathroom", labelEn: "Sink & faucet",           labelAr: "الحوض والصنبور" },
  { category: "Bathroom", labelEn: "Tiles & grout",           labelAr: "البلاط والمرتسمات" },
  { category: "Bathroom", labelEn: "Water pressure OK",       labelAr: "ضغط الماء طبيعي" },
  { category: "Bathroom", labelEn: "Drainage OK",             labelAr: "الصرف طبيعي" },

  // Furniture
  { category: "Furniture", labelEn: "Beds & mattresses",      labelAr: "الأسرة والمراتب" },
  { category: "Furniture", labelEn: "Sofas & chairs",         labelAr: "الأرائك والكراسي" },
  { category: "Furniture", labelEn: "Tables",                  labelAr: "الطاولات" },
  { category: "Furniture", labelEn: "Wardrobes / closets",    labelAr: "خزائن الملابس" },
  { category: "Furniture", labelEn: "Curtains / blinds",      labelAr: "الستائر والبرالي" },

  // Safety
  { category: "Safety", labelEn: "Smoke detector working",    labelAr: "كاشف الدخان يعمل" },
  { category: "Safety", labelEn: "Fire extinguisher present", labelAr: "طفاية الحريق موجودة" },
  { category: "Safety", labelEn: "Emergency exit signs",      labelAr: "لافتات مخرج الطوارئ" },
  { category: "Safety", labelEn: "First aid kit present",     labelAr: "حقيبة الإسعافات الأولية موجودة" },

  // Cleanliness
  { category: "Cleanliness", labelEn: "Overall cleanliness",  labelAr: "النظافة العامة" },
  { category: "Cleanliness", labelEn: "Dust / cobwebs",       labelAr: "الغبار / خيوط العنكبوت" },
  { category: "Cleanliness", labelEn: "Odor check",           labelAr: "فحص الروائح" },
  { category: "Cleanliness", labelEn: "Pest signs",           labelAr: "علامات الحشرات" },
];

export const CHECKLIST_CATEGORIES = [
  ...new Set(DEFAULT_CHECKLIST_ITEMS.map((i) => i.category)),
];
