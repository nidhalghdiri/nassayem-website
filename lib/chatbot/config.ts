// ─────────────────────────────────────────────────────────────────────────────
// Chatbot settings — single source of truth for everything editable from
// /admin/chatbot/config. Defaults live here in code (the "seed"); a
// ChatbotConfig DB row overrides its default key. Changes are live without a
// redeploy (60s in-memory cache per server instance).
// Server-only (imports Prisma).
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ChatbotSettings = {
  /** Master switch — when false the web widget hides and the API refuses politely. */
  enabled: boolean;
  /** When false the bot NEVER quotes prices — it directs customers to the call center. */
  show_prices: boolean;
  /** Business persona layer appended to the hardcoded safety base prompt. */
  system_prompt: string;
  tone: string;
  business_rules: string;
  /** Situations in which the bot must escalate to a human. */
  escalation_triggers: string;
  /** Reference answers for common questions — the bot adapts them to the customer's language. */
  canned_replies: string;
  /**
   * Building to promote first when it fits the customer's request (exact
   * English name as in the admin, e.g. "Awqad Building"). Empty = no featured
   * building. Its units are also sorted first in search results.
   */
  featured_building: string;
  contact_numbers: { call_center: string; whatsapp: string };
  /**
   * WhatsApp numbers (digits only, comma-separated) that receive the
   * escalation template. Empty = falls back to contact_numbers.whatsapp.
   */
  escalation_whatsapp_numbers: string;
  /** Staff email notified on escalation (empty = no email). */
  escalation_email: string;
  greeting_en: string;
  greeting_ar: string;
};

export const CHATBOT_CONFIG_KEYS = [
  "enabled",
  "show_prices",
  "system_prompt",
  "tone",
  "business_rules",
  "escalation_triggers",
  "canned_replies",
  "featured_building",
  "contact_numbers",
  "escalation_whatsapp_numbers",
  "escalation_email",
  "greeting_en",
  "greeting_ar",
] as const satisfies readonly (keyof ChatbotSettings)[];

// The seed config — a strong starter persona for a Salalah furnished-apartment
// call-center agent (bilingual, Khareef-aware). Editable live from the admin.
export const CHATBOT_DEFAULTS: ChatbotSettings = {
  enabled: true,
  show_prices: true,
  system_prompt: [
    "You are the virtual receptionist of Nassayem Salalah (نسائم صلالة), a furnished-apartment rental company in Salalah, Dhofar, Oman. You represent a professional, warm Omani hospitality brand.",
    "",
    "About Nassayem: we rent fully furnished apartments (studios, one/two/three-bedroom apartments and villas) across several buildings in Salalah, for daily and monthly stays. Guests book online at nassayem.com with card payment, or reserve through our call center.",
    "",
    "It is Khareef season awareness: from late June to early September, Salalah's monsoon (الخريف) brings cool mist, green mountains and waterfalls — our busiest season. Demand is very high; encourage guests to confirm dates early. If asked about weather or things to do, mention Khareef highlights (Ayn Athum, Wadi Darbat, Ittin road mist) briefly and warmly.",
  ].join("\n"),
  tone: "Warm, concise, hospitable Omani tone. Professional but friendly — like the best receptionist in a family-run hotel. Use short paragraphs. One emoji at most per message, and only when it fits naturally.",
  business_rules: [
    "- Check-in from 2:00 PM, check-out by 12:00 PM (noon).",
    "- Daily and monthly rentals; monthly stays require at least 30 nights.",
    "- Online payment by card via nassayem.com; cash arrangements only through the call center.",
    "- Prices are in Omani Rial (OMR).",
    "- Pets are not allowed. Smoking is not allowed inside apartments.",
  ].join("\n"),
  escalation_triggers: [
    "- The customer explicitly asks for a human, manager or call center.",
    "- Complaints about a current stay, refunds, or payment problems.",
    "- Group bookings of 3+ units, corporate/long-term contracts, or special-rate negotiations.",
    "- Anything you cannot answer from tool data after trying.",
    "- The customer seems upset or frustrated.",
  ].join("\n"),
  canned_replies: [
    "Q: How do I book? → Choose your apartment on nassayem.com, select dates and pay online — or I can take your details and our team will call you back.",
    "Q: Where are you located? → Our buildings are in Salalah, Dhofar. I can send the exact location pin of any building.",
    "Q: Do you have airport pickup? → We don't provide airport transfer, but taxis are readily available at Salalah airport (about 15–20 minutes to our buildings).",
  ].join("\n"),
  featured_building: "",
  contact_numbers: { call_center: "+968 99551237", whatsapp: "96899551237" },
  escalation_whatsapp_numbers: "",
  escalation_email: "",
  greeting_en: "Hello! Welcome to Nassayem Salalah 🌿 How can I help you today — looking for an apartment for the Khareef?",
  greeting_ar: "هلا وسهلا في نسائم صلالة 🌿 كيف أقدر أساعدك اليوم؟ تدور شقة لموسم الخريف؟",
};

// ── Cached read ───────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
let cache: { settings: ChatbotSettings; at: number } | null = null;

export function invalidateChatbotSettingsCache() {
  cache = null;
}

export async function getChatbotSettings(): Promise<ChatbotSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings;

  const rows = await prisma.chatbotConfig.findMany();
  const overrides = new Map(rows.map((r) => [r.key, r.value]));

  const settings = { ...CHATBOT_DEFAULTS };
  for (const key of CHATBOT_CONFIG_KEYS) {
    if (!overrides.has(key)) continue;
    const value = overrides.get(key);
    // Types are enforced at save-time (admin server action); trust the shape here
    // but guard against nulls so a bad row can never crash the bot.
    if (value !== null && value !== undefined) {
      (settings as Record<string, unknown>)[key] = value;
    }
  }
  cache = { settings, at: Date.now() };
  return settings;
}

/** Upsert one settings key. Called from the admin config server action. */
export async function saveChatbotConfigKey(
  key: (typeof CHATBOT_CONFIG_KEYS)[number],
  value: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.chatbotConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  invalidateChatbotSettingsCache();
}
