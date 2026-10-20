// Shared presentation helpers for the admin messaging inbox (list + chat pane).

const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-cyan-700",
];

/** Stable per-customer avatar colour, so the same person is recognisable at a glance. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/** One or two initials; falls back to "#" for phone-number-only customers. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^[+\d]/.test(w));
  if (words.length === 0) return "#";
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function intlLocale(locale: string) {
  return locale === "ar" ? "ar-OM" : "en-GB";
}

/** WhatsApp-style list timestamp: time today, "Yesterday", weekday this week, else date. */
export function listTimeLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) {
    return d.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return locale === "ar" ? "أمس" : "Yesterday";
  if (days < 7) return d.toLocaleDateString(intlLocale(locale), { weekday: "short" });
  return d.toLocaleDateString(intlLocale(locale), { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Day separator inside a chat: "Today", "Yesterday" or a full date. */
export function dayLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return locale === "ar" ? "اليوم" : "Today";
  if (days === 1) return locale === "ar" ? "أمس" : "Yesterday";
  return d.toLocaleDateString(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export const STATUS_STYLES: Record<
  string,
  { en: string; ar: string; pill: string; dot: string }
> = {
  ACTIVE: { en: "Active", ar: "نشطة", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  ESCALATED: { en: "Escalated", ar: "مصعّدة", pill: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  CLOSED: { en: "Closed", ar: "مغلقة", pill: "bg-gray-100 text-gray-600 ring-gray-200", dot: "bg-gray-400" },
  PENDING_RETRY: { en: "Retry pending", ar: "بانتظار إعادة المحاولة", pill: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
};
