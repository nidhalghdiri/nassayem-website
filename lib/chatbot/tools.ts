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
import { parseISO, startOfDay } from "date-fns";
import type { Prisma, UnitType } from "@prisma/client";
import {
  checkUnitAvailability,
  calculateBookingPrice,
} from "@/app/actions/booking";
import { KHAREEF_NO_PROMO_ERROR } from "@/lib/bookingErrors";
import { getChatbotSettings } from "./config";

export type ToolContext = {
  conversationId: string;
};

const HOLD_MINUTES = 30;
const MAX_RESULTS = 6;

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

type PriceInfo =
  | {
      total_omr: number;
      nights: number;
      per_night_omr: number;
      promotion: { title_en: string; title_ar: string; savings_omr: number } | null;
    }
  | { price_unavailable: string };

/** Full pricing via the website engine, translating its errors for the model. */
async function priceForStay(
  unitId: string,
  checkIn: string,
  checkOut: string,
): Promise<PriceInfo> {
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
    "Search available apartments. Use whenever the customer describes what they need (type, dates, guests, building). With check_in/check_out, results are filtered to available units and include exact total prices. Without dates, returns matching units with indicative base rates only.",
  schema: z.object({
    unit_type: z.enum(UNIT_TYPES).optional().describe("Filter by apartment type"),
    building_id: z.string().uuid().optional().describe("Filter to one building (from get_building_info)"),
    check_in: dateString.optional().describe("Check-in date YYYY-MM-DD"),
    check_out: dateString.optional().describe("Check-out date YYYY-MM-DD"),
    guests: z.number().int().min(1).max(20).optional().describe("Number of guests the unit must sleep"),
    rent_type: z.enum(["DAILY", "MONTHLY"]).optional().describe("DAILY for short stays, MONTHLY for 30+ nights"),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
    const where: Prisma.UnitWhereInput = { isPublished: true };
    if (input.unit_type) where.unitType = input.unit_type as UnitType;
    if (input.building_id) where.buildingId = input.building_id;
    if (input.guests) where.guests = { gte: input.guests };
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
      const checked = await Promise.all(
        units.map(async (unit) => ({
          unit,
          availability: await availabilityWithHolds(
            unit.id,
            input.check_in!,
            input.check_out!,
            ctx.conversationId,
          ),
        })),
      );
      const bookable = checked
        .filter((c) => c.availability.available)
        .slice(0, MAX_RESULTS);
      candidates = await Promise.all(
        bookable.map(async ({ unit, availability }) => ({
          unit,
          availability,
          price: settings.show_prices
            ? await priceForStay(unit.id, input.check_in!, input.check_out!)
            : null,
        })),
      );
    } else {
      candidates = units
        .slice(0, MAX_RESULTS)
        .map((unit) => ({ unit, availability: null, price: null }));
    }

    const results: unknown[] = [];
    for (const { unit, availability, price } of candidates) {
      results.push({
        unit_id: unit.id,
        title_en: unit.titleEn,
        title_ar: unit.titleAr,
        unit_type: unit.unitType,
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
      ...(results.length === 0
        ? { note: "No matching available units. Suggest different dates/type or offer the call center." }
        : {}),
    };
  },
});

const getUnitDetails = defineTool({
  name: "get_unit_details",
  description:
    "Full details of one apartment: description, amenities, photo gallery URLs, building location with Google Maps link, and the booking page link. Use when a customer asks about a specific unit.",
  schema: z.object({
    unit_id: z.string().uuid().describe("Unit id from search_units"),
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
    unit_id: z.string().uuid(),
    check_in: dateString,
    check_out: dateString,
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
    const availability = await availabilityWithHolds(
      input.unit_id,
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
    return {
      available: true,
      units_left: availability.remaining,
      ...(settings.show_prices
        ? { price: await priceForStay(input.unit_id, input.check_in, input.check_out) }
        : {}),
    };
  },
});

const getActivePromotions = defineTool({
  name: "get_active_promotions",
  description:
    "List currently running promotions with their date ranges and discounted nightly prices per building/unit type. Use when a customer asks about offers, discounts or deals.",
  schema: z.object({}),
  execute: async () => {
    const settings = await getChatbotSettings();
    const today = startOfDay(new Date());
    const promotions = await prisma.promotion.findMany({
      where: { isActive: true, endDate: { gte: today } },
      include: { rows: { include: { building: true } } },
      orderBy: { startDate: "asc" },
    });

    return {
      count: promotions.length,
      promotions: promotions.map((p) => ({
        title_en: p.titleEn,
        title_ar: p.titleAr,
        description_en: p.descriptionEn?.slice(0, 300) ?? null,
        from: p.startDate.toISOString().slice(0, 10),
        to: p.endDate.toISOString().slice(0, 10),
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
    "Information about our buildings: location, Google Maps link, and available unit types. Call without building_id to list all buildings (e.g. when the customer asks 'where are you located?').",
  schema: z.object({
    building_id: z.string().uuid().optional(),
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
        description_en: b.descriptionEn?.slice(0, 300) ?? null,
        maps_link: mapsLink(b.latitude, b.longitude),
        page_url: `${baseUrl()}/en/buildings/${b.id}`,
        published_units: b.units.length,
        unit_types: [...new Set(b.units.map((u) => u.unitType))],
      })),
    };
  },
});

const createLead = defineTool({
  name: "create_lead",
  description:
    "Save the customer's contact details so the reservations team follows up. Use when the customer agrees to a callback, wants dates we couldn't price online (e.g. Khareef call-center rates), or shows strong interest without booking. Always confirm name and phone with the customer first.",
  schema: z.object({
    name: z.string().min(2).max(120),
    phone: z.string().min(6).max(24).describe("Phone with country code, e.g. +96899123456"),
    unit_id: z.string().uuid().optional().describe("The unit they're interested in, if a specific one"),
    unit_interest: z.string().max(200).optional().describe("Free-text interest, e.g. 'two-bedroom near Ittin road in August'"),
    check_in: dateString.optional(),
    check_out: dateString.optional(),
    guests: z.number().int().min(1).max(20).optional(),
    notes: z.string().max(500).optional().describe("Anything else the team should know"),
  }),
  execute: async (input, ctx) => {
    await prisma.chatbotLead.create({
      data: {
        conversationId: ctx.conversationId,
        name: input.name,
        phone: input.phone,
        unitId: input.unit_id ?? null,
        unitInterest: input.unit_interest ?? null,
        checkIn: input.check_in ? startOfDay(parseISO(input.check_in)) : null,
        checkOut: input.check_out ? startOfDay(parseISO(input.check_out)) : null,
        guests: input.guests ?? null,
        notes: input.notes ?? null,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: ctx.conversationId },
      data: { customerName: input.name },
    });
    return {
      saved: true,
      next: "Tell the customer the team will contact them soon (during business hours).",
    };
  },
});

const createHold = defineTool({
  name: "create_hold",
  description:
    `Place a soft reservation on a unit for ${HOLD_MINUTES} minutes while the customer decides. It is NOT a confirmed booking and no payment is taken — always say so. Verify the customer wants it before calling.`,
  schema: z.object({
    unit_id: z.string().uuid(),
    check_in: dateString,
    check_out: dateString,
  }),
  execute: async (input, ctx) => {
    const availability = await availabilityWithHolds(
      input.unit_id,
      input.check_in,
      input.check_out,
      ctx.conversationId,
    );
    if (!availability.available) {
      return { held: false, reason: "The unit is no longer available for these dates." };
    }

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
    await prisma.chatbotHold.create({
      data: {
        unitId: input.unit_id,
        conversationId: ctx.conversationId,
        checkIn: startOfDay(parseISO(input.check_in)),
        checkOut: startOfDay(parseISO(input.check_out)),
        expiresAt,
      },
    });

    return {
      held: true,
      minutes: HOLD_MINUTES,
      expires_at: expiresAt.toISOString(),
      booking_link: `${baseUrl()}/en/properties/${input.unit_id}`,
      next: `Tell the customer the unit is set aside for ${HOLD_MINUTES} minutes and they can complete the booking online now, or the team can call them (offer create_lead).`,
    };
  },
});

const escalateToHuman = defineTool({
  name: "escalate_to_human",
  description:
    "Flag this conversation for a human agent. Use when an escalation trigger applies (complaint, refund, group/corporate booking, explicit request for a human, or you cannot help). After calling, give the customer the call-center number and reassure them.",
  schema: z.object({
    reason: z.string().min(3).max(300).describe("Short reason a staff member will read"),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
    const conversation = await prisma.chatbotConversation.update({
      where: { id: ctx.conversationId },
      data: { status: "ESCALATED", escalationReason: input.reason },
    });

    // Best-effort staff notification — never fail the customer reply over it.
    if (settings.escalation_email && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from =
          process.env.EMAIL_FROM ?? "Nassayem Salalah <bookings@nassayem.com>";
        await resend.emails.send({
          from,
          to: settings.escalation_email,
          subject: `Chatbot escalation — ${conversation.channel === "WHATSAPP" ? "WhatsApp" : "Web"} customer needs help`,
          html: `<p><strong>Reason:</strong> ${input.reason}</p>
<p><strong>Channel:</strong> ${conversation.channel}<br/>
<strong>Customer:</strong> ${conversation.customerName ?? "Unknown"} (${conversation.externalId})</p>
<p>Open the transcript: ${baseUrl()}/en/admin/chatbot/conversations/${conversation.id}</p>`,
        });
      } catch (err) {
        console.error("[chatbot] escalation email failed:", err);
      }
    }

    return {
      escalated: true,
      call_center: settings.contact_numbers.call_center,
      whatsapp: `+${settings.contact_numbers.whatsapp}`,
    };
  },
});

const TOOLS: ToolDef<z.ZodType>[] = [
  searchUnits,
  getUnitDetails,
  checkAvailability,
  getActivePromotions,
  getBuildingInfo,
  createLead,
  createHold,
  escalateToHuman,
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
