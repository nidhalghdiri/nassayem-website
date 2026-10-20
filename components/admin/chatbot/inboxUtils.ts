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

// ── Image compression (browser only) ─────────────────────────────────────────
// Staff photos go through a Server Action, whose request body is capped at
// 1 MB by Next.js. Anything at or above that is downscaled and re-encoded as
// JPEG until it fits, with headroom for the rest of the form data.

const IMAGE_LIMIT_BYTES = 1024 * 1024;
const IMAGE_TARGET_BYTES = 900 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image"));
    };
    img.src = url;
  });
}

/** Returns the file unchanged when under 1 MB; otherwise a smaller JPEG. */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size < IMAGE_LIMIT_BYTES) return file;

  const img = await loadImage(file);
  let maxSide = 2048;
  let quality = 0.85;

  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    // JPEG has no transparency — paint white so PNG cut-outs don't turn black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= IMAGE_TARGET_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    }
    // Lower quality first, then resolution.
    if (quality > 0.6) quality -= 0.1;
    else maxSide = Math.round(maxSide * 0.75);
  }
  throw new Error("This image is too large to send — please choose a smaller one.");
}
