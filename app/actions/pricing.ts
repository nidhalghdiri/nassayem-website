"use server";

import prisma from "@/lib/prisma";
import { requireManager } from "@/lib/adminAuth";
import { Prisma, UnitType } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────
// Public types — re-exported for clients
// ─────────────────────────────────────────────────────────────

export type PeriodPricingDay = {
  date: string; // YYYY-MM-DD
  basePrice: number | null;
  overridePrice: number | null;
  effectivePrice: number | null;
  isUnpriced: boolean;
};

export type PeriodPricingResult = {
  days: PeriodPricingDay[];
  totals: {
    nights: number; // count of dates in range, inclusive
    pricedNights: number;
    unpricedNights: number;
    initialPrice: number | null; // first day's effective price
    finalPrice: number | null; // last day's effective price
    total: number | null; // sum of priced days; null if any are unpriced
  };
};

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// Reject prices above this cap. Surfaces typos like 250000 vs 25.000.
const MAX_DAILY_PRICE = 10000;
const UPSERT_CHUNK_SIZE = 500;

// Accepted UnitType values + their bilingual labels (matches the rest of the app).
// Keep keys uppercase here; we normalize incoming CSV values to uppercase first.
const UNIT_TYPE_LABEL_TO_ENUM: Record<string, UnitType> = {
  STUDIO: UnitType.STUDIO,
  "1 BEDROOM": UnitType.ONE_BEDROOM,
  "ONE BEDROOM": UnitType.ONE_BEDROOM,
  ONE_BEDROOM: UnitType.ONE_BEDROOM,
  "2 BEDROOMS": UnitType.TWO_BEDROOM,
  "TWO BEDROOMS": UnitType.TWO_BEDROOM,
  TWO_BEDROOM: UnitType.TWO_BEDROOM,
  "3 BEDROOMS": UnitType.THREE_BEDROOM,
  "THREE BEDROOMS": UnitType.THREE_BEDROOM,
  THREE_BEDROOM: UnitType.THREE_BEDROOM,
  VILLA: UnitType.VILLA,
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CsvRowInput = {
  rowNumber: number; // 1-based index in the source CSV (header excluded)
  building: string; // raw value from CSV
  unitType: string; // raw value from CSV
  date: string; // raw value from CSV (expect YYYY-MM-DD)
  dailyPrice: string; // raw value from CSV
};

export type ValidatedRow = {
  rowNumber: number;
  buildingId: string;
  buildingName: string;
  unitType: UnitType;
  unitTypeLabel: string;
  date: string; // ISO YYYY-MM-DD
  dailyPrice: number;
};

export type RowError = {
  rowNumber: number;
  raw: CsvRowInput;
  reason: string;
};

export type ValidationResult = {
  valid: ValidatedRow[];
  errors: RowError[];
  totalRows: number;
};

export type ImportResult = {
  inserted: number;
  updated: number;
  rejected: number;
};

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

// Strict ISO date: YYYY-MM-DD. Anything else is rejected — we don't try
// to disambiguate DD/MM vs MM/DD silently.
function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // Treat the value as a calendar date (no timezone). Constructing with
  // Date.UTC keeps the day stable regardless of server TZ.
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Round-trip check rejects impossible dates (e.g. 2026-02-30).
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function normalizeUnitType(raw: string): UnitType | null {
  const key = raw.trim().toUpperCase();
  return UNIT_TYPE_LABEL_TO_ENUM[key] ?? null;
}

function unitTypeLabel(t: UnitType): string {
  switch (t) {
    case UnitType.STUDIO:
      return "Studio";
    case UnitType.ONE_BEDROOM:
      return "1 Bedroom";
    case UnitType.TWO_BEDROOM:
      return "2 Bedrooms";
    case UnitType.THREE_BEDROOM:
      return "3 Bedrooms";
    case UnitType.VILLA:
      return "Villa";
  }
}

/**
 * Validate parsed CSV rows against the DB. Returns both the validated rows
 * (ready to upsert) and the rejected rows with reasons. Also flags duplicate
 * (building, unit_type, date) triples within the same file.
 */
export async function validatePricingRows(
  rows: CsvRowInput[],
): Promise<ValidationResult> {
  await requireManager();

  if (rows.length === 0) {
    return { valid: [], errors: [], totalRows: 0 };
  }

  // Single DB round-trip: load all buildings and build name + id lookups.
  const buildings = await prisma.building.findMany({
    select: { id: true, nameEn: true, nameAr: true },
  });
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const byName = new Map<string, (typeof buildings)[number]>();
  for (const b of buildings) {
    byName.set(b.nameEn.trim().toLowerCase(), b);
    byName.set(b.nameAr.trim().toLowerCase(), b);
  }

  const valid: ValidatedRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>(); // key → first rowNumber that used it

  for (const row of rows) {
    const reasons: string[] = [];

    // Building lookup — try as ID first, then as name (case-insensitive).
    const rawBuilding = row.building?.trim() ?? "";
    let building: (typeof buildings)[number] | undefined;
    if (rawBuilding) {
      building =
        byId.get(rawBuilding) ?? byName.get(rawBuilding.toLowerCase());
    }
    if (!building) {
      reasons.push(`Unknown building "${rawBuilding}"`);
    }

    // Unit type
    const unitType = normalizeUnitType(row.unitType ?? "");
    if (!unitType) {
      reasons.push(`Unknown unit type "${row.unitType}"`);
    }

    // Date — strict ISO only
    const date = parseIsoDate((row.date ?? "").trim());
    if (!date) {
      reasons.push(`Invalid date "${row.date}" (expected YYYY-MM-DD)`);
    }

    // Price
    const priceNum = Number(row.dailyPrice);
    if (
      row.dailyPrice == null ||
      row.dailyPrice === "" ||
      !Number.isFinite(priceNum)
    ) {
      reasons.push(`Invalid price "${row.dailyPrice}"`);
    } else if (priceNum < 0) {
      reasons.push("Price cannot be negative");
    } else if (priceNum > MAX_DAILY_PRICE) {
      reasons.push(`Price exceeds maximum of ${MAX_DAILY_PRICE}`);
    }

    if (reasons.length > 0 || !building || !unitType || !date) {
      errors.push({ rowNumber: row.rowNumber, raw: row, reason: reasons.join("; ") });
      continue;
    }

    // De-duplicate inside the file. Last-write-wins would be confusing —
    // we surface the conflict to the user instead.
    const isoDate = date.toISOString().slice(0, 10);
    const key = `${building.id}|${unitType}|${isoDate}`;
    if (seen.has(key)) {
      errors.push({
        rowNumber: row.rowNumber,
        raw: row,
        reason: `Duplicate of row ${seen.get(key)} (same building + unit type + date)`,
      });
      continue;
    }
    seen.set(key, row.rowNumber);

    valid.push({
      rowNumber: row.rowNumber,
      buildingId: building.id,
      buildingName: building.nameEn,
      unitType,
      unitTypeLabel: unitTypeLabel(unitType),
      date: isoDate,
      dailyPrice: Math.round(priceNum * 1000) / 1000,
    });
  }

  return { valid, errors, totalRows: rows.length };
}

// ─────────────────────────────────────────────────────────────
// Confirm import — upsert validated rows in batches
// ─────────────────────────────────────────────────────────────

/**
 * Upserts the validated rows into UnitTypeDailyPrice. Counts insert vs update
 * by checking how many of the keys already exist before the write.
 */
export async function confirmPricingImport(
  validRows: ValidatedRow[],
): Promise<ImportResult> {
  await requireManager();

  if (validRows.length === 0) {
    return { inserted: 0, updated: 0, rejected: 0 };
  }

  // Count how many keys already exist so we can report inserted vs updated.
  // We chunk this to avoid pathological IN-list sizes.
  let existing = 0;
  for (let i = 0; i < validRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + UPSERT_CHUNK_SIZE);
    const count = await prisma.unitTypeDailyPrice.count({
      where: {
        OR: chunk.map((r) => ({
          buildingId: r.buildingId,
          unitType: r.unitType,
          date: new Date(r.date),
        })),
      },
    });
    existing += count;
  }

  // Upsert in chunks via individual upserts inside a transaction per chunk.
  // (Prisma's createMany doesn't support onConflict with composite uniques
  // on PostgreSQL through the typed client yet, so we use upsert per row.)
  for (let i = 0; i < validRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + UPSERT_CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.unitTypeDailyPrice.upsert({
          where: {
            buildingId_unitType_date: {
              buildingId: r.buildingId,
              unitType: r.unitType,
              date: new Date(r.date),
            },
          },
          create: {
            buildingId: r.buildingId,
            unitType: r.unitType,
            date: new Date(r.date),
            dailyPrice: new Prisma.Decimal(r.dailyPrice),
          },
          update: {
            dailyPrice: new Prisma.Decimal(r.dailyPrice),
          },
        }),
      ),
    );
  }

  revalidatePath("/admin/pricing");

  return {
    inserted: validRows.length - existing,
    updated: existing,
    rejected: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Monthly grid — load + per-cell mutations + copy action
// ─────────────────────────────────────────────────────────────

export type MonthlyGridCell = {
  date: string; // YYYY-MM-DD
  basePrice: number | null;
  hasUnitOverride: boolean; // ★ at least one unit in (building, type) has an override on this date
};

// All days in [first-of-month, last-of-month] for the given building+type,
// joined with the override-presence flag per date.
export async function getMonthlyPricingGrid(params: {
  buildingId: string;
  unitType: UnitType;
  year: number;
  month: number; // 1-12
}): Promise<MonthlyGridCell[]> {
  await requireManager();
  const { buildingId, unitType, year, month } = params;

  // First and last day of the month, UTC midnight (matches @db.Date semantics).
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const daysInMonth = end.getUTCDate();

  const [bases, overrides] = await Promise.all([
    prisma.unitTypeDailyPrice.findMany({
      where: { buildingId, unitType, date: { gte: start, lte: end } },
      select: { date: true, dailyPrice: true },
    }),
    prisma.unitDailyPriceOverride.groupBy({
      by: ["date"],
      where: {
        date: { gte: start, lte: end },
        unit: { buildingId, unitType },
      },
      _count: { _all: true },
    }),
  ]);

  const baseByDate = new Map(
    bases.map((b) => [b.date.toISOString().slice(0, 10), Number(b.dailyPrice)]),
  );
  const overrideDates = new Set(
    overrides.map((o) => o.date.toISOString().slice(0, 10)),
  );

  const cells: MonthlyGridCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = new Date(Date.UTC(year, month - 1, d)).toISOString().slice(0, 10);
    cells.push({
      date: iso,
      basePrice: baseByDate.get(iso) ?? null,
      hasUnitOverride: overrideDates.has(iso),
    });
  }
  return cells;
}

// Upsert a single (building, type, date) price. Used by the grid editor for
// inline edits. Returns the new cell value.
export async function setBasePrice(params: {
  buildingId: string;
  unitType: UnitType;
  date: string; // YYYY-MM-DD
  price: number;
}): Promise<{ basePrice: number }> {
  await requireManager();
  const { buildingId, unitType, date, price } = params;

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a non-negative number");
  }
  if (price > MAX_DAILY_PRICE) {
    throw new Error(`Price exceeds maximum of ${MAX_DAILY_PRICE}`);
  }
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error("Invalid date (expected YYYY-MM-DD)");

  const rounded = Math.round(price * 1000) / 1000;
  await prisma.unitTypeDailyPrice.upsert({
    where: {
      buildingId_unitType_date: { buildingId, unitType, date: parsed },
    },
    create: {
      buildingId,
      unitType,
      date: parsed,
      dailyPrice: new Prisma.Decimal(rounded),
    },
    update: { dailyPrice: new Prisma.Decimal(rounded) },
  });

  revalidatePath("/admin/pricing");
  return { basePrice: rounded };
}

// Remove a base price row (cell cleared in the grid editor).
export async function clearBasePrice(params: {
  buildingId: string;
  unitType: UnitType;
  date: string;
}): Promise<void> {
  await requireManager();
  const { buildingId, unitType, date } = params;
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error("Invalid date (expected YYYY-MM-DD)");

  await prisma.unitTypeDailyPrice.deleteMany({
    where: { buildingId, unitType, date: parsed },
  });
  revalidatePath("/admin/pricing");
}

// Copy base prices from a source (building, type, year, month) into a target
// (building, type, year, month). Source and target may differ in any combination.
// When `overwrite` is false, only empty target cells are filled.
export async function copyMonthlyPricing(params: {
  source: { buildingId: string; unitType: UnitType; year: number; month: number };
  target: { buildingId: string; unitType: UnitType; year: number; month: number };
  overwrite: boolean;
}): Promise<{ written: number; skipped: number }> {
  await requireManager();
  const { source, target, overwrite } = params;

  const srcStart = new Date(Date.UTC(source.year, source.month - 1, 1));
  const srcEnd = new Date(Date.UTC(source.year, source.month, 0));

  const sourceRows = await prisma.unitTypeDailyPrice.findMany({
    where: {
      buildingId: source.buildingId,
      unitType: source.unitType,
      date: { gte: srcStart, lte: srcEnd },
    },
    select: { date: true, dailyPrice: true },
  });

  if (sourceRows.length === 0) return { written: 0, skipped: 0 };

  // Pre-load target keys to compute skipped without trying every upsert.
  const tgtStart = new Date(Date.UTC(target.year, target.month - 1, 1));
  const tgtEnd = new Date(Date.UTC(target.year, target.month, 0));
  const existing = await prisma.unitTypeDailyPrice.findMany({
    where: {
      buildingId: target.buildingId,
      unitType: target.unitType,
      date: { gte: tgtStart, lte: tgtEnd },
    },
    select: { date: true },
  });
  const existingDays = new Set(existing.map((e) => e.date.getUTCDate()));

  let written = 0;
  let skipped = 0;
  const ops = [];
  for (const row of sourceRows) {
    const day = row.date.getUTCDate();
    const tgtDate = new Date(Date.UTC(target.year, target.month - 1, day));
    // Guard against month-length mismatches (e.g. Jan 31 → Feb 31 doesn't exist).
    if (tgtDate.getUTCMonth() !== target.month - 1) {
      skipped++;
      continue;
    }
    if (!overwrite && existingDays.has(day)) {
      skipped++;
      continue;
    }
    ops.push(
      prisma.unitTypeDailyPrice.upsert({
        where: {
          buildingId_unitType_date: {
            buildingId: target.buildingId,
            unitType: target.unitType,
            date: tgtDate,
          },
        },
        create: {
          buildingId: target.buildingId,
          unitType: target.unitType,
          date: tgtDate,
          dailyPrice: row.dailyPrice,
        },
        update: { dailyPrice: row.dailyPrice },
      }),
    );
    written++;
  }
  if (ops.length > 0) {
    // Chunk to respect prepared-statement limits if a month is huge.
    for (let i = 0; i < ops.length; i += UPSERT_CHUNK_SIZE) {
      await prisma.$transaction(ops.slice(i, i + UPSERT_CHUNK_SIZE));
    }
  }
  revalidatePath("/admin/pricing");
  return { written, skipped };
}

// ─────────────────────────────────────────────────────────────
// Period pricing — bulk-fill a (building, unit-type) base price over a
// date range. Expands the range into one row per day and upserts.
// ─────────────────────────────────────────────────────────────

export type PeriodPricingWriteResult = {
  written: number; // days inserted or updated
  skipped: number; // days left untouched when overwrite=false
  totalDays: number; // length of the range, inclusive
};

export async function setPeriodPricing(params: {
  buildingId: string;
  unitType: UnitType;
  fromDate: string; // YYYY-MM-DD, inclusive
  toDate: string; // YYYY-MM-DD, inclusive
  price: number;
  overwrite: boolean;
}): Promise<PeriodPricingWriteResult> {
  await requireManager();
  const { buildingId, unitType, fromDate, toDate, price, overwrite } = params;

  if (!buildingId) throw new Error("Building is required");
  if (!unitType) throw new Error("Unit type is required");

  const from = parseIsoDate(fromDate);
  const to = parseIsoDate(toDate);
  if (!from) throw new Error("Invalid From date (expected YYYY-MM-DD)");
  if (!to) throw new Error("Invalid To date (expected YYYY-MM-DD)");
  if (from > to) throw new Error("From date must be on or before To date");

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a non-negative number");
  }
  if (price > MAX_DAILY_PRICE) {
    throw new Error(`Price exceeds maximum of ${MAX_DAILY_PRICE}`);
  }

  const rounded = Math.round(price * 1000) / 1000;
  const decimalPrice = new Prisma.Decimal(rounded);

  // Expand the range into one Date per day, inclusive of both endpoints.
  const dates: Date[] = [];
  for (
    let cursor = new Date(from);
    cursor <= to;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dates.push(new Date(cursor));
  }
  const totalDays = dates.length;

  // When overwrite=false we need to know which target days already exist.
  let existingDates = new Set<string>();
  if (!overwrite) {
    const existing = await prisma.unitTypeDailyPrice.findMany({
      where: {
        buildingId,
        unitType,
        date: { gte: from, lte: to },
      },
      select: { date: true },
    });
    existingDates = new Set(existing.map((e) => toIsoDate(e.date)));
  }

  let written = 0;
  let skipped = 0;
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const d of dates) {
    if (!overwrite && existingDates.has(toIsoDate(d))) {
      skipped++;
      continue;
    }
    ops.push(
      prisma.unitTypeDailyPrice.upsert({
        where: {
          buildingId_unitType_date: { buildingId, unitType, date: d },
        },
        create: { buildingId, unitType, date: d, dailyPrice: decimalPrice },
        update: { dailyPrice: decimalPrice },
      }),
    );
    written++;
  }

  // Chunk to respect prepared-statement limits for long ranges.
  for (let i = 0; i < ops.length; i += UPSERT_CHUNK_SIZE) {
    await prisma.$transaction(ops.slice(i, i + UPSERT_CHUNK_SIZE));
  }

  revalidatePath("/admin/pricing");
  return { written, skipped, totalDays };
}

// ─────────────────────────────────────────────────────────────
// Per-unit override mutations
// ─────────────────────────────────────────────────────────────

export async function setUnitOverride(params: {
  unitId: string;
  date: string;
  price: number;
}): Promise<{ overridePrice: number }> {
  await requireManager();
  const { unitId, date, price } = params;

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a non-negative number");
  }
  if (price > MAX_DAILY_PRICE) {
    throw new Error(`Price exceeds maximum of ${MAX_DAILY_PRICE}`);
  }
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error("Invalid date (expected YYYY-MM-DD)");

  const rounded = Math.round(price * 1000) / 1000;
  await prisma.unitDailyPriceOverride.upsert({
    where: { unitId_date: { unitId, date: parsed } },
    create: {
      unitId,
      date: parsed,
      dailyPrice: new Prisma.Decimal(rounded),
    },
    update: { dailyPrice: new Prisma.Decimal(rounded) },
  });
  revalidatePath("/admin/pricing");
  return { overridePrice: rounded };
}

export async function clearUnitOverride(params: {
  unitId: string;
  date: string;
}): Promise<void> {
  await requireManager();
  const { unitId, date } = params;
  const parsed = parseIsoDate(date);
  if (!parsed) throw new Error("Invalid date (expected YYYY-MM-DD)");

  await prisma.unitDailyPriceOverride.deleteMany({
    where: { unitId, date: parsed },
  });
  revalidatePath("/admin/pricing");
}

// ─────────────────────────────────────────────────────────────
// Period preview — single source of truth for both admin + public
// ─────────────────────────────────────────────────────────────

type RawPricingRow = {
  priced_date: Date;
  base_price: string | null;
  override_price: string | null;
  effective_price: string | null;
  is_unpriced: boolean;
};

function decimalToNumber(v: string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(d: Date): string {
  // Date returned from PG `date` arrives as a JS Date at UTC midnight.
  // We render YYYY-MM-DD from UTC parts to avoid TZ-shift bugs.
  return d.toISOString().slice(0, 10);
}

/**
 * Calls the SQL resolution function get_period_pricing and shapes the result
 * for both admin preview UIs and the public-site period query. Both dates
 * inclusive.
 */
export async function getPeriodPricing(params: {
  buildingId: string;
  unitType: UnitType;
  unitId?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}): Promise<PeriodPricingResult> {
  const { buildingId, unitType, unitId = null, startDate, endDate } = params;

  if (!buildingId || !unitType || !startDate || !endDate) {
    return {
      days: [],
      totals: { nights: 0, pricedNights: 0, unpricedNights: 0, initialPrice: null, finalPrice: null, total: null },
    };
  }
  if (startDate > endDate) {
    return {
      days: [],
      totals: { nights: 0, pricedNights: 0, unpricedNights: 0, initialPrice: null, finalPrice: null, total: null },
    };
  }

  const rows = await prisma.$queryRaw<RawPricingRow[]>`
    SELECT
      priced_date,
      base_price::text     AS base_price,
      override_price::text AS override_price,
      effective_price::text AS effective_price,
      is_unpriced
    FROM get_period_pricing(
      ${buildingId}::text,
      ${unitType}::"UnitType",
      ${unitId}::text,
      ${startDate}::date,
      ${endDate}::date
    )
  `;

  const days: PeriodPricingDay[] = rows.map((r) => ({
    date: toIsoDate(r.priced_date),
    basePrice: decimalToNumber(r.base_price),
    overridePrice: decimalToNumber(r.override_price),
    effectivePrice: decimalToNumber(r.effective_price),
    isUnpriced: r.is_unpriced,
  }));

  const pricedNights = days.filter((d) => !d.isUnpriced).length;
  const unpricedNights = days.length - pricedNights;
  const total =
    unpricedNights > 0
      ? null
      : Math.round(
          days.reduce((s, d) => s + (d.effectivePrice ?? 0), 0) * 1000,
        ) / 1000;

  return {
    days,
    totals: {
      nights: days.length,
      pricedNights,
      unpricedNights,
      initialPrice: days[0]?.effectivePrice ?? null,
      finalPrice: days[days.length - 1]?.effectivePrice ?? null,
      total,
    },
  };
}

