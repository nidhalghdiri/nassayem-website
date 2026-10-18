/**
 * Content for the in-stay Digital Guest Guide (/{locale}/guest-guide).
 *
 * The page is reached from the QR code printed on the reservation paper, so it
 * is the one place guests look for practical help during their stay. All copy
 * lives here so operations can update it without touching the page layout.
 */

export type Bilingual = { en: string; ar: string };

export const CHECK_IN_TIME: Bilingual = { en: "2:00 PM", ar: "2:00 م" };
export const CHECK_OUT_TIME: Bilingual = { en: "12:00 PM", ar: "12:00 م" };

export type ApplianceKey = "ac" | "heater" | "power" | "tv" | "washer" | "kitchen";

export const APPLIANCES: { key: ApplianceKey; title: Bilingual; steps: Bilingual[]; tip?: Bilingual }[] = [
  {
    key: "ac",
    title: { en: "Air conditioning", ar: "المكيّف" },
    steps: [
      { en: "Point the remote at the indoor unit and press the power button.", ar: "وجّه جهاز التحكم نحو المكيّف واضغط زر التشغيل." },
      { en: "Choose Cool mode (snowflake ❄) and set 22–24°C for comfort.", ar: "اختر وضع التبريد (رمز ❄) واضبط الحرارة بين 22 و24 درجة." },
      { en: "Keep windows and the balcony door closed while it is running.", ar: "أبقِ النوافذ وباب الشرفة مغلقة أثناء التشغيل." },
    ],
    tip: {
      en: "During Khareef, Dry mode (droplet 💧) removes humidity without over-cooling.",
      ar: "في موسم الخريف، وضع التجفيف (رمز 💧) يزيل الرطوبة دون تبريد زائد.",
    },
  },
  {
    key: "heater",
    title: { en: "Hot water", ar: "سخان الماء" },
    steps: [
      { en: "Switch on the water-heater switch on the wall next to the bathroom (the indicator light turns on).", ar: "شغّل مفتاح السخان على الجدار بجانب الحمّام (يضيء المؤشر)." },
      { en: "Wait about 20–30 minutes for the water to heat up.", ar: "انتظر من 20 إلى 30 دقيقة حتى يسخن الماء." },
    ],
    tip: {
      en: "No hot water after 30 minutes? Check the switch first, then message us.",
      ar: "لا يوجد ماء ساخن بعد 30 دقيقة؟ تأكد من المفتاح أولاً ثم راسلنا.",
    },
  },
  {
    key: "power",
    title: { en: "Electricity & lights", ar: "الكهرباء والإنارة" },
    steps: [
      { en: "If a room loses power, find the breaker panel (usually near the entrance).", ar: "إذا انقطعت الكهرباء عن غرفة، ابحث عن لوحة القواطع (غالباً قرب المدخل)." },
      { en: "Push any switch that has dropped down back to the ON position.", ar: "ارفع أي قاطع منخفض إلى وضع التشغيل." },
      { en: "If it trips again, unplug the last device you connected and contact us.", ar: "إذا انفصل مجدداً، افصل آخر جهاز قمت بتوصيله وتواصل معنا." },
    ],
  },
  {
    key: "tv",
    title: { en: "TV", ar: "التلفزيون" },
    steps: [
      { en: "Turn on the TV with the remote's power button.", ar: "شغّل التلفزيون بزر التشغيل في جهاز التحكم." },
      { en: "No picture? Press Source / Input and select the right input (TV or HDMI).", ar: "لا تظهر صورة؟ اضغط Source أو Input واختر المدخل الصحيح (TV أو HDMI)." },
    ],
    tip: {
      en: "Using a Smart TV app? Remember to sign out of your accounts before check-out.",
      ar: "إذا استخدمت تطبيقات التلفزيون الذكي، لا تنسَ تسجيل الخروج من حساباتك قبل المغادرة.",
    },
  },
  {
    key: "washer",
    title: { en: "Washing machine", ar: "الغسالة" },
    steps: [
      { en: "Load the laundry and close the door until it clicks.", ar: "ضع الملابس وأغلق الباب حتى تسمع صوت الإغلاق." },
      { en: "Add detergent to the drawer, choose a program, then press Start.", ar: "ضع المنظف في الدرج، اختر البرنامج، ثم اضغط تشغيل (Start)." },
      { en: "The door unlocks a minute or two after the cycle finishes.", ar: "يُفتح الباب بعد دقيقة أو دقيقتين من انتهاء الدورة." },
    ],
  },
  {
    key: "kitchen",
    title: { en: "Kitchen", ar: "المطبخ" },
    steps: [
      { en: "Turn on the hob from its control knob or touch panel and pick a heat level.", ar: "شغّل الموقد من المفتاح أو لوحة اللمس واختر درجة الحرارة." },
      { en: "Never leave cooking unattended, and switch the hob off after use.", ar: "لا تترك الطهي دون مراقبة، وأطفئ الموقد بعد الاستخدام." },
      { en: "We recommend bottled water for drinking.", ar: "ننصح باستخدام المياه المعبأة للشرب." },
    ],
  },
];

export type NearbyKey = "pharmacy" | "supermarket" | "restaurant" | "hospital" | "atm" | "fuel" | "mosque" | "laundry";

/** Opened as Google Maps "near me" searches so results follow the guest's building. */
export const NEARBY: { key: NearbyKey; label: Bilingual; query: string }[] = [
  { key: "pharmacy", label: { en: "Pharmacy", ar: "صيدلية" }, query: "pharmacy" },
  { key: "supermarket", label: { en: "Supermarket", ar: "سوبرماركت" }, query: "supermarket" },
  { key: "restaurant", label: { en: "Restaurants", ar: "مطاعم" }, query: "restaurants" },
  { key: "hospital", label: { en: "Hospital & clinic", ar: "مستشفى وعيادة" }, query: "hospital" },
  { key: "atm", label: { en: "ATM", ar: "صراف آلي" }, query: "atm" },
  { key: "fuel", label: { en: "Fuel station", ar: "محطة وقود" }, query: "gas station" },
  { key: "mosque", label: { en: "Mosque", ar: "مسجد" }, query: "mosque" },
  { key: "laundry", label: { en: "Laundry", ar: "مغسلة ملابس" }, query: "laundry" },
];

export function nearbyMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(`${query} near me`)}`;
}

export const HOSPITAL_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "Sultan Qaboos Hospital, Salalah",
)}`;

export const HOUSE_RULES: Bilingual[] = [
  { en: "Smoking is not allowed inside the apartment.", ar: "يُمنع التدخين داخل الشقة." },
  { en: "Pets are not allowed.", ar: "لا يُسمح باصطحاب الحيوانات الأليفة." },
  { en: "Please keep noise low, especially at night, out of respect for neighbours.", ar: "يرجى خفض الصوت، خاصة ليلاً، احتراماً للجيران." },
  { en: "Turn off the AC, lights and water heater when you leave the apartment.", ar: "أطفئ المكيّف والإنارة والسخان عند مغادرة الشقة." },
];

export const CHECKOUT_STEPS: Bilingual[] = [
  { en: "Check drawers, wardrobes and the bathroom for your belongings.", ar: "تفقّد الأدراج والخزائن والحمّام للتأكد من أغراضك." },
  { en: "Switch off the AC, lights and water heater.", ar: "أطفئ المكيّف والإنارة والسخان." },
  { en: "Close the windows and the balcony door.", ar: "أغلق النوافذ وباب الشرفة." },
  { en: "Return the key / key card to reception.", ar: "سلّم المفتاح أو بطاقة الدخول إلى الاستقبال." },
];

export type IssueKey = "ac" | "water" | "electric" | "wifi" | "appliance" | "cleaning" | "other";

export const ISSUE_TYPES: { key: IssueKey; label: Bilingual }[] = [
  { key: "ac", label: { en: "Air conditioning", ar: "المكيّف" } },
  { key: "water", label: { en: "Water / plumbing", ar: "الماء والسباكة" } },
  { key: "electric", label: { en: "Electricity", ar: "الكهرباء" } },
  { key: "wifi", label: { en: "Wi-Fi / TV", ar: "الواي فاي / التلفزيون" } },
  { key: "appliance", label: { en: "Appliance", ar: "جهاز منزلي" } },
  { key: "cleaning", label: { en: "Cleaning", ar: "التنظيف" } },
  { key: "other", label: { en: "Other", ar: "أخرى" } },
];
