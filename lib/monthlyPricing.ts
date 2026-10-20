// ─────────────────────────────────────────────────────────────────────────────
// Monthly pricing rules — the single source of truth shared by the website
// booking engine, the admin and the chatbot. Server-only (imports Prisma).
//
//   • Rates are set per building + unit type (MonthlyPrice), each with an
//     optional "شامل" (water + electricity included) and "غير شامل" rate.
//   • A stay is monthly when it is at least MONTHLY_MIN_NIGHTS nights, the
//     unit isn't daily-only, a rate exists, and NO night falls in July/August
//     (monthly rentals run until 30/06 and stop for Khareef).
//   • Total = monthly rate × nights ÷ 30 (prorated by the day).
//   • Payment: the first month is paid up front, the rest at reception.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import type { MonthlyOption, RentType, UnitType } from "@prisma/client";

export const MONTHLY_MIN_NIGHTS = 30;
const DAYS_PER_MONTH = 30;

export const MONTHLY_OPTIONS: MonthlyOption[] = ["INCLUSIVE", "EXCLUSIVE"];

export const MONTHLY_OPTION_LABELS: Record<MonthlyOption, { en: string; ar: string; detailEn: string; detailAr: string }> = {
  INCLUSIVE: {
    en: "Utilities included",
    ar: "شامل",
    detailEn: "Water and electricity included",
    detailAr: "شامل الماء والكهرباء",
  },
  EXCLUSIVE: {
    en: "Utilities not included",
    ar: "غير شامل",
    detailEn: "Water and electricity paid separately",
    detailAr: "غير شامل الماء والكهرباء",
  },
};

export function isMonthlyOption(v: unknown): v is MonthlyOption {
  return v === "INCLUSIVE" || v === "EXCLUSIVE";
}

/** True when any night in [start, end) falls in July or August. `end` (departure morning) is exclusive. */
export function stayTouchesKhareef(start: Date, end: Date): boolean {
  const cursor = new Date(start);
  while (cursor < end) {
    const m = cursor.getMonth();
    if (m === 6 || m === 7) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export type MonthlyRates = Partial<Record<MonthlyOption, number>>;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The building + type's monthly rates, or null when none are set. */
export async function getMonthlyRates(buildingId: string, unitType: UnitType): Promise<MonthlyRates | null> {
  const row = await prisma.monthlyPrice.findUnique({
    where: { buildingId_unitType: { buildingId, unitType } },
    select: { inclusivePrice: true, exclusivePrice: true },
  });
  if (!row) return null;
  const rates: MonthlyRates = {};
  if (row.inclusivePrice !== null) rates.INCLUSIVE = Number(row.inclusivePrice);
  if (row.exclusivePrice !== null) rates.EXCLUSIVE = Number(row.exclusivePrice);
  return Object.keys(rates).length > 0 ? rates : null;
}

/** Every building + type that has at least one monthly rate, keyed "buildingId|unitType". */
export async function getAllMonthlyRates(): Promise<Map<string, MonthlyRates>> {
  const rows = await prisma.monthlyPrice.findMany({
    select: { buildingId: true, unitType: true, inclusivePrice: true, exclusivePrice: true },
  });
  const map = new Map<string, MonthlyRates>();
  for (const r of rows) {
    const rates: MonthlyRates = {};
    if (r.inclusivePrice !== null) rates.INCLUSIVE = Number(r.inclusivePrice);
    if (r.exclusivePrice !== null) rates.EXCLUSIVE = Number(r.exclusivePrice);
    if (Object.keys(rates).length > 0) map.set(`${r.buildingId}|${r.unitType}`, rates);
  }
  return map;
}

/** Lowest monthly rate on offer — for "from X OMR / month" labels and price filters. */
export function lowestMonthlyRate(rates: MonthlyRates | null | undefined): { option: MonthlyOption; rate: number } | null {
  if (!rates) return null;
  let best: { option: MonthlyOption; rate: number } | null = null;
  for (const option of MONTHLY_OPTIONS) {
    const rate = rates[option];
    if (rate !== undefined && (!best || rate < best.rate)) best = { option, rate };
  }
  return best;
}

export type MonthlyQuoteOption = {
  option: MonthlyOption;
  monthlyRate: number;
  total: number;
  /** Paid up front: one month's rent (or the whole stay if it's shorter). */
  firstMonthAmount: number;
};

export type MonthlyQuote = {
  months: number;
  /** The option this quote is priced with (the guest's choice, or the default). */
  selected: MonthlyQuoteOption;
  /** Every option on offer, so the UI can show both side by side. */
  options: MonthlyQuoteOption[];
};

/**
 * Prices a stay at the monthly rate, or returns null when the stay isn't
 * eligible (too short, daily-only unit, no rate set, or touches Khareef).
 * An unavailable `preferred` option falls back to the lowest rate.
 */
export function quoteMonthlyStay(params: {
  rentType: RentType;
  rates: MonthlyRates | null;
  nights: number;
  start: Date;
  end: Date;
  preferred?: MonthlyOption | null;
}): MonthlyQuote | null {
  const { rentType, rates, nights, start, end, preferred } = params;
  if (rentType === "DAILY" || !rates || nights < MONTHLY_MIN_NIGHTS) return null;
  if (stayTouchesKhareef(start, end)) return null;

  const months = nights / DAYS_PER_MONTH;
  const options: MonthlyQuoteOption[] = [];
  for (const option of MONTHLY_OPTIONS) {
    const rate = rates[option];
    if (rate === undefined) continue;
    const total = round3(rate * months);
    options.push({ option, monthlyRate: rate, total, firstMonthAmount: round3(Math.min(rate, total)) });
  }
  if (options.length === 0) return null;

  const selected =
    options.find((o) => o.option === preferred) ??
    options.reduce((a, b) => (b.monthlyRate < a.monthlyRate ? b : a));
  return { months: round3(months), selected, options };
}
