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
import {
  checkNetsuiteAvailability,
  createNetsuiteReservation,
  isNetsuiteChatbotConfigured,
} from "@/lib/netsuite";
import { createNetsuitePaymentLink } from "@/lib/netsuitePaymentLink";
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
        return { available: remaining > 0, remaining, source: "netsuite" };
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
    building_id: realId.optional().describe("Filter to one building (from get_building_info)"),
    check_in: dateString.optional().describe("Check-in date YYYY-MM-DD"),
    check_out: dateString.optional().describe("Check-out date YYYY-MM-DD"),
    guests: z.number().int().min(1).max(20).optional().describe("Group size. Results also include units whose official capacity is ONE below this (capacity is a guideline — families with children often fit); such units carry a capacity_note. Present them honestly and let the customer decide."),
    rent_type: z.enum(["DAILY", "MONTHLY"]).optional().describe("DAILY for short stays, MONTHLY for 30+ nights"),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
    const where: Prisma.UnitWhereInput = { isPublished: true };
    if (input.unit_type) where.unitType = input.unit_type as UnitType;
    if (input.building_id) where.buildingId = input.building_id;
    // Capacity is a soft limit: include units officially sleeping ONE fewer
    // than the group (families with children usually fit) — flagged with a
    // capacity_note below so the bot presents them honestly instead of
    // telling the customer "nothing fits you".
    if (input.guests) where.guests = { gte: Math.max(1, input.guests - 1) };
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

    // Exact-capacity fits first; near-fits (one below) after.
    if (input.guests) {
      const g = input.guests;
      units.sort((a, b) => Number(b.guests >= g) - Number(a.guests >= g));
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
        ...(input.guests && unit.guests < input.guests
          ? {
              capacity_note: `Official capacity is ${unit.guests} and the group is ${input.guests}. Usually fine when the extra guest is a child — mention the capacity honestly and let the customer decide. Never refuse on their behalf.`,
            }
          : {}),
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
      select: { id: true, unitType: true, building: { select: { netsuiteId: true } } },
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
        description_en: b.descriptionEn?.slice(0, 300) ?? null,
        latitude: b.latitude,
        longitude: b.longitude,
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
    unit_id: realId.optional().describe("The unit they're interested in, if a specific one"),
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
    unit_id: realId,
    check_in: dateString,
    check_out: dateString,
  }),
  execute: async (input, ctx) => {
    const unit = await prisma.unit.findUnique({
      where: { id: input.unit_id, isPublished: true },
      select: { id: true, unitType: true, building: { select: { netsuiteId: true } } },
    });
    if (!unit) return { held: false, reason: "Unit not found." };

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

const createReservation = defineTool({
  name: "create_reservation",
  description:
    "Create a REAL reservation in our reservation system and get a card-payment link for the customer. Only call after the customer has EXPLICITLY confirmed: the exact unit, check-in/check-out dates, full name and phone number — repeat these back and get a clear yes first. The reservation is confirmed once the customer pays the link.",
  schema: z.object({
    unit_id: realId,
    check_in: dateString,
    check_out: dateString,
    customer_name: z.string().min(2).max(120),
    customer_phone: z.string().min(6).max(24).describe("Phone with country code, e.g. +96899123456"),
    customer_email: z.string().email().optional(),
  }),
  execute: async (input, ctx) => {
    const settings = await getChatbotSettings();
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

    const unit = await prisma.unit.findUnique({
      where: { id: input.unit_id, isPublished: true },
      include: { building: true },
    });
    if (!unit) return { reserved: false, reason: "Unit not found." };
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

    // Exact total from the website pricing engine (promos, per-day pricing).
    const price = await priceForStay(unit.id, input.check_in, input.check_out);
    if ("price_unavailable" in price) {
      return {
        reserved: false,
        reason: `Cannot price these dates online: ${price.price_unavailable}`,
        suggestion: "Save a lead (create_lead) so the call center completes the booking.",
      };
    }

    // 1. Reservation in NetSuite (it picks a free unit of this type).
    const reservation = await createNetsuiteReservation({
      netsuiteBuildingId: unit.building.netsuiteId,
      unitType: unit.unitType,
      checkIn: input.check_in,
      checkOut: input.check_out,
      customerName: input.customer_name,
      customerPhone: input.customer_phone,
      customerEmail: input.customer_email ?? null,
      totalAmount: price.total_omr,
      notes: `AI chatbot reservation — ${unit.titleEn} (${price.nights} nights)`,
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

    // 2. Card-payment link (same machinery as receptionist-issued links).
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
      amount: price.total_omr,
      description: "Reservation created by the Nassayem AI assistant",
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
        notes: `NetSuite reservation ${reservation.data.reservationRef ?? reservation.data.reservationId} created by chatbot; payment link sent.`,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: ctx.conversationId },
      data: { customerName: input.customer_name },
    });

    return {
      reserved: true,
      reservation_ref: reservation.data.reservationRef ?? reservation.data.reservationId,
      total_omr: price.total_omr,
      nights: price.nights,
      payment_url: paymentLink.url,
      payment_link_expires_at: paymentLink.expiresAt.toISOString(),
      next: "Tell the customer the reservation is held for them and becomes CONFIRMED once paid. Send the payment link (bare URL) and the total. Mention the link expiry.",
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
  createReservation,
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
