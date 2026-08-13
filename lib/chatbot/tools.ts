// ─────────────────────────────────────────────────────────────────────────────
// Chatbot tools — the ONLY way the model learns facts about units, prices,
// availability and promotions. Each tool is zod-validated and reuses the same
// battle-tested logic the website itself runs on:
//   • checkUnitAvailability / calculateBookingPrice (app/actions/booking.ts)
//   • getActivePromotionForUnit pricing priority incl. the Khareef gate
// Soft holds (ChatbotHold) are subtracted from availability HERE only — the
// public checkout flow is intentionally untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { differenceInDays, parseISO, startOfDay } from "date-fns";
import type { Prisma, UnitType } from "@prisma/client";
import {
  checkUnitAvailability,
  calculateBookingPrice,
} from "@/app/actions/booking";
import { getActivePromotionForUnit } from "@/app/actions/promotion";
import { getPeriodPricing } from "@/app/actions/pricing";
import { KHAREEF_NO_PROMO_ERROR } from "@/lib/bookingErrors";
import {
  checkNetsuiteAvailability,
  createNetsuiteReservation,
  isNetsuiteChatbotConfigured,
} from "@/lib/netsuite";
import { createNetsuitePaymentLink } from "@/lib/netsuitePaymentLink";
import {
  sendChatbotEscalationTemplate,
  sendWhatsAppText,
  sendWhatsAppDocument,
} from "../whatsapp";
import { UNIT_TYPE_LABELS } from "@/lib/unitTypes";
import { getChatbotSettings, type ChatbotSettings } from "./config";
import { salalahTodayISO } from "./prompt";

export type ToolContext = {
  conversationId: string;
};

const HOLD_MINUTES = 30;
const MAX_RESULTS = 6;
// Building descriptions carry the area write-up (nearby landmarks / popular
// places) the team maintains — give the model enough room to read it all,
// bounded so a very long description can't blow up the tool payload.
const BUILDING_DESC_CHARS = 900;

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://www.nassayem.com"
  );
}

function unitUrls(unitId: string) {
  return {
    page_url_en: `${baseUrl()}/en/properties/${unitId}`,
    page_url_ar: `${baseUrl()}/ar/properties/${unitId}`,
  };
}

function mapsLink(lat: number | null, lng: number | null): string | null {
  return lat != null && lng != null
    ? `https://maps.google.com/?q=${lat},${lng}`
    : null;
}

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

// Zod's uuid() accepts the nil/max UUIDs, which is exactly what the model
// fabricates when it has lost the real id from context. Reject them with an
// instruction that tells the model how to recover.
const realId = z
  .string()
  .uuid()
  .refine(
    (v) => !/^(0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i.test(v),
    {
      message:
        "This is a placeholder, not a real id. Copy the exact id from a search_units / get_unit_details / get_building_info result. If you no longer have it, call search_units again first.",
    },
  );

const UNIT_TYPES = [
  "STUDIO",
  "ONE_BEDROOM",
  "TWO_BEDROOM",
  "THREE_BEDROOM",
  "VILLA",
] as const;

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Website availability minus active chatbot holds. Holds from the SAME
 * conversation are ignored so a customer's own hold never blocks them.
 */
async function availabilityWithHolds(
  unitId: string,
  checkIn: string,
  checkOut: string,
  conversationId: string,
): Promise<{ available: boolean; remaining: number; error?: string }> {
  const base = await checkUnitAvailability(unitId, checkIn, checkOut);
  if (!base.available) {
    return { available: false, remaining: 0, error: base.error };
  }

  const start = startOfDay(parseISO(checkIn));
  const end = startOfDay(parseISO(checkOut));
  const holdCount = await prisma.chatbotHold.count({
    where: {
      unitId,
      status: "ACTIVE",
      expiresAt: { gt: new Date() },
      conversationId: { not: conversationId },
      AND: [{ checkIn: { lt: end } }, { checkOut: { gt: start } }],
    },
  });

  const remaining = Math.max(0, (base.remaining ?? 0) - holdCount);
  return { available: remaining > 0, remaining };
}

type UnifiedAvailability = {
  available: boolean;
  remaining: number;
  source: "netsuite" | "website";
  /** Pool size for the building+type (NetSuite only) — enables occupancy ranking. */
  totalUnits?: number;
  error?: string;
};

type AvailabilityMemo = Map<string, Promise<UnifiedAvailability>>;

/**
 * Availability source of truth: NetSuite (real-time, per building + unit
 * type), when the RESTlet is configured and the building is mapped. Falls
 * back to website bookings when NetSuite is unconfigured, the building has no
 * netsuiteId, or the call fails — the chat must keep working either way.
 * Chatbot soft holds are subtracted in both paths. The memo dedupes RESTlet
 * calls within one tool execution (several website units often share the same
 * building + type pool).
 */
async function unifiedAvailability(
  unit: { id: string; unitType: UnitType; buildingNetsuiteId: string | null },
  checkIn: string,
  checkOut: string,
  conversationId: string,
  memo?: AvailabilityMemo,
): Promise<UnifiedAvailability> {
  const subtractHolds = async (freeCount: number): Promise<number> => {
    const start = startOfDay(parseISO(checkIn));
    const end = startOfDay(parseISO(checkOut));
    const holdCount = await prisma.chatbotHold.count({
      where: {
        unitId: unit.id,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        conversationId: { not: conversationId },
        AND: [{ checkIn: { lt: end } }, { checkOut: { gt: start } }],
      },
    });
    return Math.max(0, freeCount - holdCount);
  };

  if (isNetsuiteChatbotConfigured() && unit.buildingNetsuiteId) {
    const key = `${unit.buildingNetsuiteId}|${unit.unitType}|${checkIn}|${checkOut}`;
    let pending = memo?.get(key);
    if (!pending) {
      pending = (async (): Promise<UnifiedAvailability> => {
        const ns = await checkNetsuiteAvailability({
          netsuiteBuildingId: unit.buildingNetsuiteId,
          unitType: unit.unitType,
          checkIn,
          checkOut,
        });
        if (!ns.ok) {
          console.error("[chatbot] NetSuite availability failed:", ns.error);
          const fallback = await availabilityWithHolds(
            unit.id,
            checkIn,
            checkOut,
            conversationId,
          );
          return { ...fallback, source: "website", error: ns.error };
        }
        const remaining = await subtractHolds(ns.data.freeUnits);
        return {
          available: remaining > 0,
          remaining,
          source: "netsuite",
          totalUnits: ns.data.totalUnits,
        };
      })();
      memo?.set(key, pending);
    }
    return pending;
  }

  const fallback = await availabilityWithHolds(unit.id, checkIn, checkOut, conversationId);
  return { ...fallback, available: fallback.available, source: "website" };
}



type PriceInfo =
  | {
      total_omr: number;
      nights: number;
      per_night_omr: number;
      promotion: { title_en: string; title_ar: string; savings_omr: number } | null;
      note?: string;
    }
  | { price_unavailable: string };

/** True when any night in [checkIn, checkOut) falls in July or August. */
function stayContainsKhareef(checkIn: string, checkOut: string): boolean {
  const cursor = startOfDay(parseISO(checkIn));
  const end = startOfDay(parseISO(checkOut));
  while (cursor < end) {
    const m = cursor.getMonth();
    if (m === 6 || m === 7) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

const KHAREEF_MONTHLY_NOTE =
  "Monthly rentals are NOT available during Khareef season (July–August). This total is calculated at the DAILY rate — tell the customer that monthly isn't offered in Khareef and this is the daily-rate total.";

/**
 * Daily-rate pricing for long Khareef stays. The website engine switches to
 * the monthly rate at 30+ nights, but monthly rentals do not exist during
 * Khareef — so we price such stays night-by-night using the same priority
 * the engine's daily branch uses: promotion > per-day pricing table
 * (Khareef gate applies — no published rate means call center).
 */
async function dailyRatePrice(
  unit: { id: string; buildingId: string; unitType: UnitType; dailyPrice: number | null },
  checkIn: string,
  checkOut: string,
): Promise<PriceInfo> {
  const nights = differenceInDays(
    startOfDay(parseISO(checkOut)),
    startOfDay(parseISO(checkIn)),
  );
  if (nights <= 0) return { price_unavailable: "Invalid date range." };

  const [promo, modulePricing] = await Promise.all([
    getActivePromotionForUnit(unit.id, checkIn, checkOut),
    getPeriodPricing({
      buildingId: unit.buildingId,
      unitType: unit.unitType,
      unitId: unit.id,
      startDate: checkIn,
      endDate: checkOut,
    }),
  ]);
  const moduleAllPriced =
    modulePricing !== null &&
    modulePricing.totals.unpricedNights === 0 &&
    modulePricing.totals.pricedNights > 0;

  if (promo) {
    const total = Math.round(promo.promoPrice * nights * 100) / 100;
    const originalDaily = unit.dailyPrice ?? promo.regularPrice;
    return {
      total_omr: total,
      nights,
      per_night_omr: Math.floor(promo.promoPrice),
      promotion: {
        title_en: promo.titleEn,
        title_ar: promo.titleAr,
        savings_omr: Math.round((originalDaily - promo.promoPrice) * nights * 100) / 100,
      },
      note: KHAREEF_MONTHLY_NOTE,
    };
  }
  if (moduleAllPriced) {
    const inclusiveSum = modulePricing!.totals.total ?? 0;
    const dailyAverage = Math.floor(inclusiveSum / (nights + 1));
    return {
      total_omr: dailyAverage * nights,
      nights,
      per_night_omr: dailyAverage,
      promotion: null,
      note: KHAREEF_MONTHLY_NOTE,
    };
  }
  return {
    price_unavailable:
      "Online rates for these Khareef (July/August) dates are not published, and monthly rates are not available in Khareef. The call center can quote and book these dates.",
  };
}

/** Full pricing via the website engine, translating its errors for the model. */
async function priceForStay(
  unitId: string,
  checkIn: string,
  checkOut: string,
): Promise<PriceInfo> {
  // Khareef exception: 30+ night stays would normally get the monthly rate,
  // but monthly rentals don't exist during Khareef — price them daily.
  const nights = differenceInDays(
    startOfDay(parseISO(checkOut)),
    startOfDay(parseISO(checkIn)),
  );
  if (nights >= 30 && stayContainsKhareef(checkIn, checkOut)) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, buildingId: true, unitType: true, dailyPrice: true },
    });
    if (!unit) return { price_unavailable: "Unit not found." };
    return dailyRatePrice(unit, checkIn, checkOut);
  }

  try {
    const p = await calculateBookingPrice(unitId, checkIn, checkOut);
    return {
      total_omr: p.grandTotal,
      nights: p.totalNights,
      per_night_omr: p.dailyAverage,
      promotion: p.promotion
        ? {
            title_en: p.promotion.titleEn,
            title_ar: p.promotion.titleAr,
            savings_omr: p.promotion.savings,
          }
        : null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === KHAREEF_NO_PROMO_ERROR) {
      return {
        price_unavailable:
          "Online rates for these Khareef (July/August) dates are not published. The call center can quote and book these dates.",
      };
    }
    return { price_unavailable: message };
  }
}

// ── Escalation recipients ─────────────────────────────────────────────────────

/** A WhatsApp escalation recipient and the template language they should get. */
type EscalationRecipient = { to: string; language: "ar" | "en" };

/** Coerce an AdminUser.preferredLanguage into the two languages we template. */
function toTemplateLang(pref: string | null | undefined): "ar" | "en" {
  return pref === "ar" ? "ar" : "en";
}

/** Merge recipient lists, keeping the first language seen for each number. */
function dedupeRecipients(list: EscalationRecipient[]): EscalationRecipient[] {
  const seen = new Set<string>();
  const out: EscalationRecipient[] = [];
  for (const r of list) {
    if (!r.to || seen.has(r.to)) continue;
    seen.add(r.to);
    out.push(r);
  }
  return out;
}

/** Call-center escalation WhatsApp numbers (digits only), falling back to the
 * configured contact WhatsApp number when none are set. These are notified in
 * Arabic (the call center's language). */
function callCenterEscalationNumbers(settings: ChatbotSettings): EscalationRecipient[] {
  const list = (settings.escalation_whatsapp_numbers || "")
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter((n) => n.length >= 8);
  if (list.length === 0) {
    const fallback = settings.contact_numbers.whatsapp.replace(/\D/g, "");
    if (fallback.length >= 8) list.push(fallback);
  }
  return list.map((to) => ({ to, language: "ar" }));
}

/**
 * Receptionists responsible for a building, each with their own template
 * language (AdminUser.preferredLanguage). Prefer receptionists scoped to that
 * building; if none are assigned there and `fallbackToAll` is set (default),
 * fall back to every receptionist with a number so a booking request is never
 * dropped. General escalations pass `fallbackToAll: false` so an unassigned
 * building doesn't ping every desk.
 */
async function receptionistRecipientsForBuilding(
  buildingId: string,
  opts: { fallbackToAll?: boolean } = {},
): Promise<EscalationRecipient[]> {
  const { fallbackToAll = true } = opts;
  const pick = (
    rows: { whatsappNumber: string | null; preferredLanguage: string }[],
  ): EscalationRecipient[] =>
    rows
      .map((r) => ({
        to: (r.whatsappNumber ?? "").replace(/\D/g, ""),
        language: toTemplateLang(r.preferredLanguage),
      }))
      .filter((r) => r.to.length >= 8);

  const scoped = await prisma.adminUser.findMany({
    where: {
      role: "RECEPTIONIST",
      whatsappNumber: { not: null },
      assignedBuildings: { some: { buildingId } },
    },
    select: { whatsappNumber: true, preferredLanguage: true },
  });
  const scopedRecipients = pick(scoped);
  if (scopedRecipients.length > 0) return scopedRecipients;
  if (!fallbackToAll) return [];

  const all = await prisma.adminUser.findMany({
    where: { role: "RECEPTIONIST", whatsappNumber: { not: null } },
    select: { whatsappNumber: true, preferredLanguage: true },
  });
  return pick(all);
}

/**
 * Resolve a free-text building name (as the model passes it) to a building id.
 * Returns the id only when exactly one building matches — a name we can't match,
 * or an ambiguous one, yields null so we never notify the wrong building's desk.
 */
async function resolveBuildingIdByName(name: string): Promise<string | null> {
  const q = name.trim();
  if (q.length < 2) return null;
  const matches = await prisma.building.findMany({
    where: {
      OR: [
        { nameAr: { contains: q, mode: "insensitive" } },
        { nameEn: { contains: q, mode: "insensitive" } },
        { shortName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true },
    take: 2,
  });
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Unified conversation escalation and staff notification (WhatsApp template + email).
 * Used by createLead, escalateToHuman, and booking-request lead fallbacks.
 */
async function triggerEscalation(params: {
  conversationId: string;
  reason: string;
  customerName?: string | null;
  customerPhone?: string | null;
  buildingId?: string | null;
  buildingName?: string | null;
  dates?: string | null;
  persons?: string | number | null;
  summary: string;
  emailSubject?: string;
  emailHtml?: string;
}): Promise<void> {
  const settings = await getChatbotSettings();
  const clean = (s?: string | null) => {
    const t = (s ?? "").trim();
    return t.length > 0 ? t : undefined;
  };

  const conversation = await prisma.chatbotConversation.update({
    where: { id: params.conversationId },
    data: {
      status: "ESCALATED",
      escalationReason: params.reason,
      escalatedAt: new Date(),
      followUpStatus: "PENDING",
      ...(clean(params.customerName)
        ? { customerName: clean(params.customerName) }
        : {}),
    },
  });

  const waNumber =
    conversation.channel === "WHATSAPP"
      ? conversation.externalId.replace(/\D/g, "")
      : "";
  const waPhone = waNumber.length >= 8 ? `+${waNumber}` : undefined;
  const customerName =
    clean(params.customerName) ??
    clean(conversation.customerName) ??
    waPhone ??
    "غير محدد";
  const customerPhone = clean(params.customerPhone) ?? waPhone ?? "غير محدد";

  // WhatsApp escalation template:
  // Call-center numbers (from settings.escalation_whatsapp_numbers or contact WhatsApp)
  const recipients = callCenterEscalationNumbers(settings);

  // Plus building receptionist(s) if buildingId or buildingName is known
  let bId = params.buildingId;
  let bName = params.buildingName;
  if (!bId && bName && bName !== "غير محدد") {
    bId = await resolveBuildingIdByName(bName);
  }
  if (bId) {
    const receptionists = await receptionistRecipientsForBuilding(bId, {
      fallbackToAll: false,
    });
    recipients.push(...receptionists);
    if (!bName || bName === "غير محدد") {
      const b = await prisma.building.findUnique({
        where: { id: bId },
        select: { nameAr: true },
      });
      if (b) bName = b.nameAr;
    }
  }

  const finalBuildingName = bName ?? "غير محدد";

  for (const r of dedupeRecipients(recipients)) {
    sendChatbotEscalationTemplate({
      to: r.to,
      language: r.language,
      building: finalBuildingName,
      customer: customerName,
      phone: customerPhone,
      dates: params.dates ?? "غير محدد",
      persons: params.persons ? String(params.persons) : "غير محدد",
      summary: params.summary,
    }).catch((err) =>
      console.error("[chatbot] escalation template failed:", err),
    );
  }

  // Best-effort staff email notification
  if (settings.escalation_email && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        process.env.EMAIL_FROM ?? "Nassayem Salalah <bookings@nassayem.com>";
      const subject =
        params.emailSubject ??
        `Chatbot escalation — ${conversation.channel === "WHATSAPP" ? "WhatsApp" : "Web"} customer needs help`;
      const html =
        params.emailHtml ??
        `<p><strong>Reason:</strong> ${params.reason}</p>
<p><strong>Channel:</strong> ${conversation.channel}<br/>
<strong>Customer:</strong> ${customerName} (${customerPhone})<br/>
<strong>Building:</strong> ${finalBuildingName}<br/>
<strong>Dates:</strong> ${params.dates ?? "Not specified"}</p>
<p>Open the transcript: ${baseUrl()}/en/admin/chatbot/conversations/${conversation.id}</p>`;

      await resend.emails.send({
        from,
        to: settings.escalation_email,
        subject,
        html,
      });
    } catch (err) {
      console.error("[chatbot] escalation email failed:", err);
    }
  }
}

// ── Tool registry ─────────────────────────────────────────────────────────────

type ToolDef<S extends z.ZodType> = {
  name: string;
  description: string;
  schema: S;
  execute: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
};

function defineTool<S extends z.ZodType>(def: ToolDef<S>): ToolDef<z.ZodType> {
  return def as unknown as ToolDef<z.ZodType>;
}

const searchUnits = defineTool({
  name: "search_units",
  description:
    "Search available apartments. Use whenever the customer describes what they need (type, dates, building). Group size NEVER restricts results — we welcome any group size in any apartment type; ask the customer which TYPE they prefer (studio / one / two / three bedrooms / villa) and search by that. With check_in/check_out, results are filtered to available units and include exact total prices. Without dates, returns matching units with indicative base rates only.",
  schema: z.object({
    unit_type: z.enum(UNIT_TYPES).optional().describe("Apartment type the CUSTOMER chose — always ask their preference instead of guessing from group size"),
    building_id: realId.optional().describe("Filter to one building (from get_building_info)"),
    check_in: dateString.optional().describe("Check-in date YYYY-MM-DD"),
    check_out: dateString.optional().describe("Check-out date YYYY-MM-DD"),
    rent_type: z.enum(["DAILY", "MONTHLY"]).optional().describe("DAILY for short stays, MONTHLY for 30+ nights"),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();

    // Business rule: NO monthly rentals during Khareef (July–August).
    if (
      input.rent_type === "MONTHLY" &&
      input.check_in &&
      input.check_out &&
      stayContainsKhareef(input.check_in, input.check_out)
    ) {
      return {
        count: 0,
        units: [],
        note: "Monthly rentals are NOT available during Khareef season (July–August) — only daily rentals. Tell the customer this and ask if they would like the stay calculated at the daily rate; if yes, search again without rent_type MONTHLY.",
      };
    }

    // Deliberately NO guest-count filtering: any group size may take any
    // apartment type — the customer chooses the type; `sleeps` is shown as
    // information only.
    const where: Prisma.UnitWhereInput = { isPublished: true };
    if (input.unit_type) where.unitType = input.unit_type as UnitType;
    if (input.building_id) where.buildingId = input.building_id;
    if (input.rent_type === "DAILY") where.rentType = { in: ["DAILY", "BOTH"] };
    if (input.rent_type === "MONTHLY") where.rentType = { in: ["MONTHLY", "BOTH"] };

    const units = await prisma.unit.findMany({
      where,
      include: {
        building: true,
        images: { orderBy: { displayOrder: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Featured building (admin config) floats to the top of results — the
    // prompt tells the model to present it first when it fits. It stays pinned
    // above the vacancy ranking applied further below.
    const featured = settings.featured_building.trim().toLowerCase();
    const isFeaturedUnit = (u: (typeof units)[number]) =>
      featured.length > 0 &&
      (u.building.nameEn.toLowerCase().includes(featured) ||
        u.building.nameAr.includes(settings.featured_building.trim()));
    if (featured) {
      units.sort((a, b) => Number(isFeaturedUnit(b)) - Number(isFeaturedUnit(a)));
    }


    const hasDates = !!(input.check_in && input.check_out);

    // With dates: check availability for all candidates in parallel, keep the
    // first MAX_RESULTS bookable ones, then price those in parallel. Serial
    // per-unit round trips were the dominant latency cost.
    let candidates: {
      unit: (typeof units)[number];
      availability: { available: boolean; remaining: number } | null;
      price: PriceInfo | null;
    }[];

    if (hasDates) {
      const memo: AvailabilityMemo = new Map();
      const checked = await Promise.all(
        units.map(async (unit) => ({
          unit,
          availability: await unifiedAvailability(
            {
              id: unit.id,
              unitType: unit.unitType,
              buildingNetsuiteId: unit.building.netsuiteId,
            },
            input.check_in!,
            input.check_out!,
            ctx.conversationId,
            memo,
          ),
        })),
      );
      const bookableAll = checked.filter((c) => c.availability.available);

      // Strong-salesman ranking: surface units from the emptiest buildings
      // first (highest live vacancy for these exact dates) so the bot proactively
      // helps fill low-occupancy buildings. Vacancy = remaining / pool size, from
      // NetSuite. Featured building (if set) still pins to the very top; units
      // without occupancy data (website-fallback) fall back to remaining count.
      if (settings.prioritize_vacant_buildings) {
        const vacancyRate = (a: UnifiedAvailability): number =>
          a.totalUnits && a.totalUnits > 0 ? a.remaining / a.totalUnits : -1;
        bookableAll.sort((x, y) => {
          const featuredDelta =
            Number(isFeaturedUnit(y.unit)) - Number(isFeaturedUnit(x.unit));
          if (featuredDelta !== 0) return featuredDelta;
          const rateDelta = vacancyRate(y.availability) - vacancyRate(x.availability);
          if (rateDelta !== 0) return rateDelta;
          return y.availability.remaining - x.availability.remaining;
        });
      }

      const bookable = bookableAll.slice(0, MAX_RESULTS);
      candidates = await Promise.all(
        bookable.map(async ({ unit, availability }) => {
          let price = null;
          if (settings.show_prices) {
            price = await priceForStay(unit.id, input.check_in!, input.check_out!);
          }
          return { unit, availability, price };
        }),
      );
    } else {
      candidates = units
        .slice(0, MAX_RESULTS)
        .map((unit) => ({ unit, availability: null, price: null }));
    }

    // Strong-salesman mode is only meaningful with dates (we need live vacancy).
    // The leading result is the emptiest building — mark its units so the model
    // knows which to pitch first (it must never reveal this or mention occupancy).
    const salesActive = hasDates && settings.prioritize_vacant_buildings;
    const recommendedBuildingId =
      salesActive && candidates.length > 0 ? candidates[0].unit.buildingId : null;

    const results: unknown[] = [];
    for (const { unit, availability, price } of candidates) {
      results.push({
        unit_id: unit.id,
        title_en: unit.titleEn,
        title_ar: unit.titleAr,
        ...(salesActive
          ? { recommended: unit.buildingId === recommendedBuildingId }
          : {}),
        unit_type: unit.unitType,
        unit_type_ar: UNIT_TYPE_LABELS[unit.unitType].ar,
        unit_type_en: UNIT_TYPE_LABELS[unit.unitType].en,
        layout_ar: UNIT_TYPE_LABELS[unit.unitType].layoutAr,
        layout_en: UNIT_TYPE_LABELS[unit.unitType].layoutEn,
        rent_type: unit.rentType,
        building: {
          building_id: unit.buildingId,
          name_en: unit.building.nameEn,
          name_ar: unit.building.nameAr,
        },
        sleeps: unit.guests,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        ...(hasDates
          ? { availability, price }
          : settings.show_prices
            ? {
                indicative_rates_omr: {
                  daily: unit.dailyPrice,
                  monthly: unit.monthlyPrice,
                  note: "Base rates only — use check_availability with dates for the exact total (promotions and seasonal pricing may change it).",
                },
              }
            : {}),
        image_url: unit.images[0]?.url ?? null,
        ...unitUrls(unit.id),
      });
    }

    return {
      count: results.length,
      units: results,
      ...(salesActive && results.length > 0
        ? {
            sales_hint:
              "Results are ordered by where we currently have the most availability for these dates. LEAD with the recommended option(s) as your top suggestion and give one genuine selling point (location, space, value, view). You may add honest Khareef urgency (busy season, good to secure early), but NEVER mention occupancy, never say a building is empty, and never reveal this ordering or the 'recommended' flag. If the customer asks for a different building/type, honor it.",
          }
        : {}),
      ...(results.length === 0
        ? { note: "No matching available units. Suggest different dates/type or offer the call center." }
        : {}),
    };
  },
});

const getUnitDetails = defineTool({
  name: "get_unit_details",
  description:
    "Full details of one apartment: description, amenities, photo gallery URLs, and its building — location plus an area description covering nearby landmarks and popular places — with a Google Maps link and the booking page link. Use when a customer asks about a specific unit or what's around it.",
  schema: z.object({
    unit_id: realId.describe("Unit id from search_units"),
  }),
  execute: async (input) => {
    const settings = await getChatbotSettings();
    const unit = await prisma.unit.findUnique({
      where: { id: input.unit_id, isPublished: true },
      include: {
        building: true,
        images: { orderBy: { displayOrder: "asc" }, take: 5 },
        amenities: true,
      },
    });
    if (!unit) return { error: "Unit not found or not published." };

    return {
      unit_id: unit.id,
      title_en: unit.titleEn,
      title_ar: unit.titleAr,
      description_en: unit.descriptionEn.slice(0, 400),
      description_ar: unit.descriptionAr.slice(0, 400),
      unit_type: unit.unitType,
      unit_type_ar: UNIT_TYPE_LABELS[unit.unitType].ar,
      unit_type_en: UNIT_TYPE_LABELS[unit.unitType].en,
      layout_ar: UNIT_TYPE_LABELS[unit.unitType].layoutAr,
      layout_en: UNIT_TYPE_LABELS[unit.unitType].layoutEn,
      rent_type: unit.rentType,
      sleeps: unit.guests,
      bedrooms: unit.bedrooms,
      beds: unit.beds,
      bathrooms: unit.bathrooms,
      ...(settings.show_prices
        ? {
            indicative_rates_omr: {
              daily: unit.dailyPrice,
              monthly: unit.monthlyPrice,
              note: "Use check_availability with dates for the exact total.",
            },
          }
        : {}),
      amenities_en: unit.amenities.map((a) => a.nameEn),
      amenities_ar: unit.amenities.map((a) => a.nameAr),
      gallery_urls: unit.images.map((i) => i.url),
      building: {
        building_id: unit.building.id,
        name_en: unit.building.nameEn,
        name_ar: unit.building.nameAr,
        location_en: unit.building.locationEn,
        location_ar: unit.building.locationAr,
        description_en: unit.building.descriptionEn?.slice(0, BUILDING_DESC_CHARS) ?? null,
        description_ar: unit.building.descriptionAr?.slice(0, BUILDING_DESC_CHARS) ?? null,
        latitude: unit.building.latitude,
        longitude: unit.building.longitude,
        maps_link: mapsLink(unit.building.latitude, unit.building.longitude),
      },
      ...unitUrls(unit.id),
    };
  },
});

const checkAvailability = defineTool({
  name: "check_availability",
  description:
    "Check whether one specific unit is free for exact dates, with the exact total price. ALWAYS use this before quoting availability or a total for specific dates.",
  schema: z.object({
    unit_id: realId,
    check_in: dateString,
    check_out: dateString,
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
    const unit = await prisma.unit.findUnique({
      where: { id: input.unit_id, isPublished: true },
      select: {
        id: true,
        buildingId: true,
        unitType: true,
        building: { select: { netsuiteId: true } },
      },
    });
    if (!unit) return { error: "Unit not found or not published." };

    const availability = await unifiedAvailability(
      {
        id: unit.id,
        unitType: unit.unitType,
        buildingNetsuiteId: unit.building.netsuiteId,
      },
      input.check_in,
      input.check_out,
      ctx.conversationId,
    );
    if (!availability.available) {
      return {
        available: false,
        reason: availability.error ?? "Fully booked for these dates.",
        suggestion: "Offer nearby dates or search_units for alternatives.",
      };
    }
    let price: unknown = undefined;
    if (settings.show_prices) {
      price = await priceForStay(input.unit_id, input.check_in, input.check_out);
    }

    return {
      available: true,
      units_left: availability.remaining,
      ...(price ? { price } : {}),
    };
  },
});

const getActivePromotions = defineTool({
  name: "get_active_promotions",
  description:
    "List currently running promotions with their date ranges and discounted nightly prices per building/unit type. Use when a customer asks generally about current offers or deals. If the customer already specified stay dates (check_in / check_out), pass them so only offers strictly covering those dates are returned.",
  schema: z.object({
    check_in: dateString.optional().describe("Optional customer check-in date (YYYY-MM-DD) to filter for applicable promotions"),
    check_out: dateString.optional().describe("Optional customer check-out date (YYYY-MM-DD) to filter for applicable promotions"),
  }),
  execute: async (input) => {
    const settings = await getChatbotSettings();
    const today = startOfDay(new Date());
    let whereClause: any = { isActive: true, endDate: { gte: today } };

    if (input.check_in && input.check_out) {
      const start = startOfDay(parseISO(input.check_in));
      const end = startOfDay(parseISO(input.check_out));
      whereClause = {
        isActive: true,
        startDate: { lte: start },
        endDate: { gte: end },
      };
    }

    const promotions = await prisma.promotion.findMany({
      where: whereClause,
      include: { rows: { include: { building: true } } },
      orderBy: { startDate: "asc" },
    });

    if (input.check_in && input.check_out && promotions.length === 0) {
      return {
        count: 0,
        message: `No promotions cover the requested dates (${input.check_in} to ${input.check_out}). Standard published rates apply. Do NOT quote or promise any promotion for these dates.`,
        promotions: [],
      };
    }

    return {
      count: promotions.length,
      promotions: promotions.map((p) => ({
        title_en: p.titleEn,
        title_ar: p.titleAr,
        description_en: p.descriptionEn?.slice(0, 300) ?? null,
        valid_from: p.startDate.toISOString().slice(0, 10),
        valid_to: p.endDate.toISOString().slice(0, 10),
        validity_rule: `CRITICAL: This promotion is ONLY valid for stays within ${p.startDate.toISOString().slice(0, 10)} to ${p.endDate.toISOString().slice(0, 10)}. It CANNOT be applied to any stay dates outside this range.`,
        page_url: `${baseUrl()}/en/promotions/${p.id}`,
        offers: p.rows.map((r) => ({
          building: r.building
            ? { name_en: r.building.nameEn, name_ar: r.building.nameAr }
            : "all buildings",
          unit_type: r.unitType ?? "all types",
          ...(settings.show_prices
            ? {
                regular_price_omr: r.regularPrice,
                promo_price_omr: r.promoPrice,
              }
            : {}),
        })),
      })),
    };
  },
});

const getBuildingInfo = defineTool({
  name: "get_building_info",
  description:
    "Information about our buildings: location, an area description covering nearby landmarks and popular places, Google Maps link, and available unit types. Call without building_id to list all buildings (e.g. when the customer asks 'where are you located?', 'what's nearby?', or which area suits them).",
  schema: z.object({
    building_id: realId.optional(),
  }),
  execute: async (input) => {
    const where = input.building_id ? { id: input.building_id } : {};
    const buildings = await prisma.building.findMany({
      where,
      include: {
        units: {
          where: { isPublished: true },
          select: { unitType: true },
        },
      },
    });
    if (buildings.length === 0) return { error: "Building not found." };

    return {
      buildings: buildings.map((b) => ({
        building_id: b.id,
        name_en: b.nameEn,
        name_ar: b.nameAr,
        location_en: b.locationEn,
        location_ar: b.locationAr,
        description_en: b.descriptionEn?.slice(0, BUILDING_DESC_CHARS) ?? null,
        description_ar: b.descriptionAr?.slice(0, BUILDING_DESC_CHARS) ?? null,
        latitude: b.latitude,
        longitude: b.longitude,
        maps_link: mapsLink(b.latitude, b.longitude),
        page_url: `${baseUrl()}/en/buildings/${b.id}`,
        published_units: b.units.length,
        unit_types: [...new Set(b.units.map((u) => u.unitType))].map((t) => ({
          type: t,
          ar: UNIT_TYPE_LABELS[t].ar,
          en: UNIT_TYPE_LABELS[t].en,
        })),
      })),
    };
  },
});

const createLead = defineTool({
  name: "create_lead",
  description:
    "Save contact details ONLY when the customer explicitly asks for a phone callback and does NOT want to proceed with booking through the chat assistant. DO NOT use this tool when a customer provides details to reserve — instead, collect their ID/Passport and call create_reservation directly.",
  schema: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(6).max(24).describe("Phone with country code, e.g. +96899123456"),
    unit_id: realId.optional().describe("The unit they're interested in, if a specific one"),
    unit_interest: z.string().max(200).optional().describe("Free-text interest, e.g. 'two-bedroom near Ittin road in August'"),
    check_in: dateString.optional(),
    check_out: dateString.optional(),
    guests: z.number().int().min(1).max(20).optional(),
    notes: z.string().max(500).optional().describe("Anything else the team should know"),
  }),
  execute: async (input, ctx) => {
    let unitId = input.unit_id;
    let checkIn = input.check_in;
    let checkOut = input.check_out;

    // If unit_id or dates were omitted, check if there's a recent active hold
    if (!unitId) {
      const recentHold = await prisma.chatbotHold.findFirst({
        where: {
          conversationId: ctx.conversationId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: { unitId: true, checkIn: true, checkOut: true },
      });
      if (recentHold) {
        unitId = recentHold.unitId;
        if (!checkIn && recentHold.checkIn)
          checkIn = recentHold.checkIn.toISOString().slice(0, 10);
        if (!checkOut && recentHold.checkOut)
          checkOut = recentHold.checkOut.toISOString().slice(0, 10);
      }
    }

    let unitTitle: string | null = null;
    let buildingId: string | null = null;
    let buildingName: string | null = null;

    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        select: {
          id: true,
          titleAr: true,
          buildingId: true,
          building: { select: { id: true, nameAr: true } },
        },
      });
      if (unit) {
        unitTitle = unit.titleAr;
        buildingId = unit.buildingId;
        buildingName = unit.building.nameAr;
      }
    } else if (input.unit_interest) {
      buildingId = await resolveBuildingIdByName(input.unit_interest);
      if (buildingId) {
        const b = await prisma.building.findUnique({
          where: { id: buildingId },
          select: { nameAr: true },
        });
        if (b) buildingName = b.nameAr;
      }
    }

    await prisma.chatbotLead.create({
      data: {
        conversationId: ctx.conversationId,
        name: input.name,
        phone: input.phone,
        unitId: unitId ?? null,
        unitInterest:
          input.unit_interest ??
          (unitTitle ? `${unitTitle} (${buildingName})` : null),
        checkIn: checkIn ? startOfDay(parseISO(checkIn)) : null,
        checkOut: checkOut ? startOfDay(parseISO(checkOut)) : null,
        guests: input.guests ?? null,
        notes: input.notes ?? null,
      },
    });

    const datesStr =
      checkIn && checkOut ? `${checkIn} - ${checkOut}` : undefined;
    const itemInterest = unitTitle
      ? `${unitTitle} (${buildingName || ""})`
      : input.unit_interest || "شقق نسائم";
    const summary = `طلب تواصل جديد — ${itemInterest}.${input.notes ? ` ملاحظات: ${input.notes}.` : ""} يرجى التواصل مع العميل لمتابعة الحجز.`;

    await triggerEscalation({
      conversationId: ctx.conversationId,
      reason: `طلب تواصل / مهتم بالحجز — ${itemInterest}`,
      customerName: input.name,
      customerPhone: input.phone,
      buildingId,
      buildingName,
      dates: datesStr,
      persons: input.guests,
      summary,
      emailSubject: `طلب تواصل جديد من عميل — ${input.name}`,
    });

    return {
      saved: true,
      next: "Tell the customer the team will contact them soon (during business hours).",
    };
  },
});

const createReservation = defineTool({
  name: "create_reservation",
  description:
    "Submit the customer's booking so we can finalize it. Only call after the customer has EXPLICITLY confirmed: the exact unit, check-in/check-out dates, full name, phone number AND national ID/passport number — repeat these back and get a clear 'yes' first. This does NOT charge the customer. After it returns, follow the returned `next` instruction EXACTLY for what to tell the customer (it will either say our reservations team will contact them shortly to finish the booking, or return a payment link to send).",
  schema: z.object({
    unit_id: realId,
    check_in: dateString,
    check_out: dateString,
    customer_name: z.string().min(2).max(120),
    customer_phone: z.string().min(6).max(24).describe("Phone with country code, e.g. +96899123456"),
    id_passport: z.string().min(4).max(40).describe("National ID number or passport number — required for every reservation"),
    customer_email: z.string().email().optional(),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();

    const unit = await prisma.unit.findUnique({
      where: { id: input.unit_id, isPublished: true },
      include: { building: true },
    });
    if (!unit) return { reserved: false, reason: "Unit not found." };

    // Exact total from the website pricing engine (promos, per-day pricing).
    // Best-effort context for the team in paused mode; required in enabled mode.
    // priceForStay never throws — it returns { price_unavailable } on failure.
    const price = settings.show_prices
      ? await priceForStay(unit.id, input.check_in, input.check_out)
      : null;
    const priced = price && !("price_unavailable" in price) ? price : null;
    const finalTotal = priced?.total_omr ?? 0;

    // ── Paused mode (default) ────────────────────────────────────────────────
    // The bot does NOT create the reservation. Save the booking-ready customer
    // as a lead and notify the reservations team + the building receptionist(s)
    // on WhatsApp so a human confirms the unit and arranges payment.
    if (!settings.reservations_enabled) {
      const nights = differenceInDays(
        startOfDay(parseISO(input.check_out)),
        startOfDay(parseISO(input.check_in)),
      );
      const priceLine = priced ? ` · الإجمالي التقريبي ${finalTotal} ر.ع` : "";
      await prisma.chatbotLead.create({
        data: {
          conversationId: ctx.conversationId,
          name: input.customer_name,
          phone: input.customer_phone,
          unitId: unit.id,
          checkIn: startOfDay(parseISO(input.check_in)),
          checkOut: startOfDay(parseISO(input.check_out)),
          idNumber: input.id_passport,
          status: "CONTACTED",
          notes:
            `طلب حجز عبر المساعد الذكي — ${unit.titleAr} (${unit.building.nameAr})` +
            ` · ${input.check_in} ← ${input.check_out}` +
            (nights > 0 ? ` · ${nights} ليالٍ` : "") +
            priceLine +
            ` · الهوية/الجواز: ${input.id_passport} · بانتظار تأكيد الموظف والدفع.`,
        },
      });
      await triggerEscalation({
        conversationId: ctx.conversationId,
        reason: `طلب حجز — ${unit.titleAr} (${input.check_in} ← ${input.check_out})`,
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        buildingId: unit.buildingId,
        buildingName: unit.building.nameAr,
        dates: `${input.check_in} - ${input.check_out}`,
        persons: "غير محدد",
        summary:
          `طلب حجز جديد — ${unit.titleAr}. الهوية/الجواز ${input.id_passport}.` +
          (priced ? ` الإجمالي التقريبي ${finalTotal} ر.ع.` : "") +
          ` يرجى التواصل مع العميل لتأكيد الحجز وترتيب الدفع.`,
        emailSubject: `طلب حجز جديد — ${unit.titleAr} (${input.customer_name})`,
      });

      return {
        request_registered: true,
        handed_to: "reservations_team",
        ...(priced
          ? {
              approx_total_omr: finalTotal,
              nights: priced.nights,
            }
          : {}),
        next:
          "Tell the customer warmly that their booking request has been received and our reservations team will contact them very shortly (during working hours) to confirm the apartment and arrange the payment. Do NOT claim the reservation is confirmed, do NOT send any payment link, and do NOT invent a reservation number. You may share the call center number if they'd like to reach us first.",
      };
    }

    // ── Enabled mode: real NetSuite reservation + 50% advance payment link ───
    if (!settings.show_prices) {
      return {
        reserved: false,
        reason:
          "Online booking is disabled while price quoting is off. Save the customer as a lead (create_lead) and give them the call center number.",
      };
    }
    if (!isNetsuiteChatbotConfigured()) {
      return {
        reserved: false,
        reason:
          "The reservation system connection is not configured. Save the customer as a lead (create_lead) and give them the call center number.",
      };
    }
    if (!unit.building.netsuiteId) {
      return {
        reserved: false,
        reason:
          "This building is not linked to the reservation system yet. Save a lead and offer the call center.",
      };
    }

    // Re-check real-time availability right before reserving.
    const availability = await unifiedAvailability(
      { id: unit.id, unitType: unit.unitType, buildingNetsuiteId: unit.building.netsuiteId },
      input.check_in,
      input.check_out,
      ctx.conversationId,
    );
    if (!availability.available) {
      return {
        reserved: false,
        reason: "The unit just became unavailable for these dates.",
        suggestion: "Apologize and offer alternative dates or units (search_units).",
      };
    }

    if (!priced) {
      return {
        reserved: false,
        reason: `Cannot price these dates online: ${
          price && "price_unavailable" in price ? price.price_unavailable : "unknown"
        }`,
        suggestion: "Save a lead (create_lead) so the call center completes the booking.",
      };
    }

    // 1. Reservation in NetSuite (it picks a free unit of this type).
    // 30+ night Khareef stays stay on the DAILY cycle — no monthly in Khareef.
    const forceDaily =
      priced.nights >= 30 && stayContainsKhareef(input.check_in, input.check_out);
    const reservation = await createNetsuiteReservation({
      netsuiteBuildingId: unit.building.netsuiteId,
      unitType: unit.unitType,
      checkIn: input.check_in,
      checkOut: input.check_out,
      customerName: input.customer_name,
      customerPhone: input.customer_phone,
      customerEmail: input.customer_email ?? null,
      idPassport: input.id_passport,
      totalAmount: finalTotal,
      notes: `AI chatbot reservation — ${unit.titleEn} (${priced.nights} nights${forceDaily ? ", daily rate — Khareef" : ""})`,
      forceDaily,
      conversationId: ctx.conversationId,
    });
    if (!reservation.ok) {
      console.error("[chatbot] NetSuite reservation failed:", reservation.error);
      return {
        reserved: false,
        reason: "The reservation system did not accept the booking right now.",
        suggestion: "Apologize, save a lead (create_lead) and offer the call center.",
        // Internal diagnostic — visible in the admin tool trace. Do not read
        // this to the customer.
        system_error: String(reservation.error).slice(0, 400),
      };
    }
    
    // 1.5 Send the generated PDF Reservation document to the customer
    if (reservation.data.reservationPdfUrl) {
      await sendWhatsAppDocument(
        input.customer_phone,
        reservation.data.reservationPdfUrl,
        `Reservation_${reservation.data.reservationRef ?? reservation.data.reservationId}.pdf`,
        "Here is your official reservation document."
      ).catch((err) => console.error("[chatbot] failed to send reservation PDF:", err));
    }

    // 2. Card-payment link for the 50% ADVANCE (same machinery as
    // receptionist-issued links). The remaining 50% is paid at reception —
    // the NetSuite reservation itself carries the full total.
    const advance = Math.round(finalTotal * 0.5 * 1000) / 1000;
    const remaining = Math.round((finalTotal - advance) * 1000) / 1000;
    const conversation = await prisma.chatbotConversation.findUnique({
      where: { id: ctx.conversationId },
      select: { language: true },
    });
    const paymentLink = await createNetsuitePaymentLink({
      netsuiteReservationId: reservation.data.reservationId,
      netsuiteReservationRef: reservation.data.reservationRef ?? null,
      netsuiteBuildingId: unit.building.netsuiteId,
      unitCode: reservation.data.unitCode ?? unit.unitCode ?? null,
      checkIn: input.check_in,
      checkOut: input.check_out,
      customerName: input.customer_name,
      customerPhone: input.customer_phone,
      customerEmail: input.customer_email ?? null,
      amount: advance,
      description: `Advance payment (50%) — total ${finalTotal} OMR, remaining ${remaining} OMR at reception. Created by the Nassayem AI assistant.`,
      locale: conversation?.language === "ar" ? "ar" : "en",
    });

    // 3. Lead row so the team sees it in the pipeline.
    await prisma.chatbotLead.create({
      data: {
        conversationId: ctx.conversationId,
        name: input.customer_name,
        phone: input.customer_phone,
        unitId: unit.id,
        checkIn: startOfDay(parseISO(input.check_in)),
        checkOut: startOfDay(parseISO(input.check_out)),
        status: "CONTACTED",
        idNumber: input.id_passport,
        reservationNumber:
          reservation.data.reservationRef ?? reservation.data.reservationId,
        notes: `NetSuite reservation ${reservation.data.reservationRef ?? reservation.data.reservationId} created by chatbot; ID/passport: ${input.id_passport}; 50% advance link sent (${advance} OMR of ${finalTotal}).`,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: ctx.conversationId },
      data: { customerName: input.customer_name },
    });

    return {
      reserved: true,
      reservation_ref: reservation.data.reservationRef ?? reservation.data.reservationId,
      total_omr: priced.total_omr,
      advance_paid_online_omr: advance,
      remaining_at_reception_omr: remaining,
      nights: priced.nights,
      payment_url: paymentLink.url,
      payment_link_expires_at: paymentLink.expiresAt.toISOString(),
      next: `Tell the customer: their reservation has been registered in the system (Ref: ${reservation.data.reservationRef ?? reservation.data.reservationId}). Send the 50% advance payment link (${paymentLink.url} as a bare URL) to pay ${advance} OMR now to confirm the reservation. The remaining ${remaining} OMR will be paid upon arrival at reception. Total: ${finalTotal} OMR (${priced.nights} nights). Do not tell the customer a team member will contact them unless they explicitly ask for escalation.`,
    };
  },
});

const escalateToHuman = defineTool({
  name: "escalate_to_human",
  description:
    "Flag this conversation for a human agent — the call center is notified on WhatsApp immediately. Use when an escalation trigger applies (complaint, refund, group/corporate booking, explicit request for a human, or you cannot help). Fill in every detail you know from the conversation (building, name, phone, dates, persons) — the team reads them in the notification. After calling, give the customer the call-center number and reassure them.",
  schema: z.object({
    reason: z.string().min(3).max(300).describe("Short summary a staff member will read (in Arabic)"),
    building: z.string().max(120).optional().describe("Building name discussed, if any"),
    customer_name: z.string().max(120).optional(),
    customer_phone: z.string().max(24).optional(),
    check_in: dateString.optional(),
    check_out: dateString.optional(),
    guests: z.number().int().min(1).max(50).optional().describe("Number of persons, if mentioned"),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
    const datesStr =
      input.check_in && input.check_out
        ? `${input.check_in} - ${input.check_out}`
        : undefined;

    await triggerEscalation({
      conversationId: ctx.conversationId,
      reason: input.reason,
      customerName: input.customer_name,
      customerPhone: input.customer_phone,
      buildingName: input.building,
      dates: datesStr,
      persons: input.guests,
      summary: input.reason,
    });

    return {
      escalated: true,
      call_center: settings.contact_numbers.call_center,
      whatsapp: `+${settings.contact_numbers.whatsapp}`,
    };
  },
});

const submitSurveyFeedback = defineTool({
  name: "submit_survey_feedback",
  description:
    "Submit the final categorized feedback summary for a customer's recent stay. Call this when the customer has finished giving feedback about their stay. DO NOT call this for new bookings.",
  schema: z.object({
    phone: z.string().describe("The customer's phone number exactly as found in the conversation context (the externalId)."),
    category: z.enum(["COMPLAINT", "SUGGESTION", "COMPLIMENT", "MIXED"]).describe("The overall sentiment/category of the feedback."),
    subjects: z.array(z.string()).describe("A list of subjects mentioned in the feedback. Pick from: 'MAINTENANCE', 'CLEANING', 'STAFF', 'PRICING', 'MISREPRESENTATION', 'AMENITIES', 'LOCATION', or add other relevant keywords if needed."),
    summary: z.string().min(10).describe("A concise summary of the customer's feedback, in Arabic, focusing on actionable points."),
  }),
  execute: async (input) => {
    // We match by phone (with or without '+')
    let phone = input.phone;
    if (!phone.startsWith("+")) phone = "+" + phone;
    
    // Check both exact and without '+' just in case
    const campaignCustomer = await prisma.campaignCustomer.findFirst({
      where: { 
        OR: [
          { phone: input.phone },
          { phone: input.phone.replace("+", "") },
          { phone: "+" + input.phone.replace("+", "") }
        ]
      },
      orderBy: { createdAt: "desc" },
    });

    if (campaignCustomer) {
      await prisma.campaignCustomer.update({
        where: { id: campaignCustomer.id },
        data: {
          status: "DONE",
          summary: input.summary,
          category: input.category,
          subjects: input.subjects,
        },
      });
      return { success: true, message: "Feedback submitted successfully." };
    }
    return { success: false, error: "Campaign customer not found." };
  },
});

const TOOLS: ToolDef<z.ZodType>[] = [
  searchUnits,
  getUnitDetails,
  checkAvailability,
  getActivePromotions,
  getBuildingInfo,
  createLead,
  createReservation,
  escalateToHuman,
  submitSurveyFeedback,
];

// ── Public surface ────────────────────────────────────────────────────────────

export function getAnthropicTools(): Anthropic.Tool[] {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: z.toJSONSchema(tool.schema) as Anthropic.Tool.InputSchema,
  }));
}

export type ToolExecution = {
  result: unknown;
  isError: boolean;
};

export async function executeChatbotTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<ToolExecution> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    return { result: { error: `Unknown tool: ${name}` }, isError: true };
  }

  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      result: { error: "Invalid arguments", details: parsed.error.issues },
      isError: true,
    };
  }

  try {
    const result = await tool.execute(parsed.data, ctx);
    return { result, isError: false };
  } catch (err) {
    console.error(`[chatbot] tool ${name} failed:`, err);
    return {
      result: {
        error:
          "The system could not complete this lookup right now. Apologize and offer the call center.",
      },
      isError: true,
    };
  }
}
