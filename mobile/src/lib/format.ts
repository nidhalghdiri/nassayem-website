import type { Language } from '@/lib/api/schemas';

// Every Nassayem building is in Salalah: show times in Oman time whatever the
// phone's own time zone. Latin digits, like the website.
const TIME_ZONE = 'Asia/Muscat';
const LOCALE: Record<Language, string> = { en: 'en-GB', ar: 'ar-OM-u-nu-latn' };

export function formatDateTime(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE[language], {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/** "Tuesday, 17 November" in Oman time. */
export function formatLongDate(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(LOCALE[language], {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/** The current hour (0–23) in Oman, for greetings. */
export function omanHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false }).format(date);
  return Number(hour) % 24;
}
