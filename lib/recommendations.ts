import type { RecommendationCategory } from "@prisma/client";

export const RECOMMENDATION_CATEGORIES: Record<
  RecommendationCategory,
  {
    labelEn: string;
    labelAr: string;
    iconPath: string;
    tone: string; // tailwind bg+text classes for chips
    accent: string; // tailwind accent for section headers
  }
> = {
  BEACH: {
    labelEn: "Beaches",
    labelAr: "الشواطئ",
    iconPath:
      "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z",
    tone: "bg-sky-50 text-sky-700",
    accent: "from-sky-500 to-cyan-500",
  },
  MOUNTAIN: {
    labelEn: "Mountains",
    labelAr: "الجبال",
    iconPath:
      "M3 20l5-12 4 8 3-5 6 9H3z",
    tone: "bg-emerald-50 text-emerald-700",
    accent: "from-emerald-500 to-teal-500",
  },
  WATERFALL: {
    labelEn: "Waterfalls",
    labelAr: "الشلالات",
    iconPath:
      "M12 2v10M8 6v8M16 6v8M6 14c2 3 4 4 6 4s4-1 6-4",
    tone: "bg-blue-50 text-blue-700",
    accent: "from-blue-500 to-indigo-500",
  },
  WADI: {
    labelEn: "Wadis",
    labelAr: "الأودية",
    iconPath:
      "M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0",
    tone: "bg-teal-50 text-teal-700",
    accent: "from-teal-500 to-emerald-500",
  },
  CULTURAL: {
    labelEn: "Cultural Sites",
    labelAr: "المواقع الثقافية",
    iconPath:
      "M3 22h18M5 22V10l7-4 7 4v12M9 22V14h6v8",
    tone: "bg-amber-50 text-amber-700",
    accent: "from-amber-500 to-orange-500",
  },
  RESTAURANT: {
    labelEn: "Restaurants & Cafes",
    labelAr: "المطاعم والمقاهي",
    iconPath:
      "M4 3v18M8 3v8a2 2 0 11-4 0V3M17 3v18M14 11h6v3a3 3 0 01-3 3z",
    tone: "bg-rose-50 text-rose-700",
    accent: "from-rose-500 to-pink-500",
  },
  EVENT: {
    labelEn: "Events",
    labelAr: "الفعاليات",
    iconPath:
      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    tone: "bg-fuchsia-50 text-fuchsia-700",
    accent: "from-fuchsia-500 to-purple-500",
  },
  ACTIVITY: {
    labelEn: "Activities",
    labelAr: "الأنشطة",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    tone: "bg-orange-50 text-orange-700",
    accent: "from-orange-500 to-amber-500",
  },
  OTHER: {
    labelEn: "Other",
    labelAr: "أخرى",
    iconPath:
      "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    tone: "bg-gray-50 text-gray-700",
    accent: "from-gray-500 to-slate-500",
  },
};

// Order in which categories appear on the public page.
export const CATEGORY_DISPLAY_ORDER: RecommendationCategory[] = [
  "BEACH",
  "MOUNTAIN",
  "WATERFALL",
  "WADI",
  "CULTURAL",
  "RESTAURANT",
  "ACTIVITY",
  "EVENT",
  "OTHER",
];
