-- Resolution rule (single source of truth for admin preview + public site):
--   for a given unit on a given date, effective_price =
--     unit override if one exists,
--     else the unit_type base for that building+unit_type,
--     else NULL → is_unpriced = true (caller must surface; never silently 0).
--
-- Parameters:
--   p_building_id : Building.id (Prisma `String @id` → TEXT in Postgres)
--   p_unit_type   : UnitType enum value
--   p_unit_id     : Unit.id (TEXT), or NULL to skip override lookup
--   p_start       : inclusive start date
--   p_end         : inclusive end date

CREATE OR REPLACE FUNCTION get_period_pricing(
  p_building_id text,
  p_unit_type   "UnitType",
  p_unit_id     text,
  p_start       date,
  p_end         date
)
RETURNS TABLE (
  priced_date     date,
  base_price      numeric(10, 3),
  override_price  numeric(10, 3),
  effective_price numeric(10, 3),
  is_unpriced     boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH days AS (
    SELECT d::date AS priced_date
    FROM generate_series(p_start, p_end, INTERVAL '1 day') AS d
  ),
  base AS (
    SELECT d.priced_date, b."dailyPrice" AS base_price
    FROM days d
    LEFT JOIN "UnitTypeDailyPrice" b
      ON b."buildingId" = p_building_id
     AND b."unitType"   = p_unit_type
     AND b."date"       = d.priced_date
  ),
  override AS (
    SELECT d.priced_date, o."dailyPrice" AS override_price
    FROM days d
    LEFT JOIN "UnitDailyPriceOverride" o
      ON o."unitId" = p_unit_id
     AND o."date"   = d.priced_date
  )
  SELECT
    b.priced_date,
    b.base_price,
    o.override_price,
    COALESCE(o.override_price, b.base_price)               AS effective_price,
    COALESCE(o.override_price, b.base_price) IS NULL       AS is_unpriced
  FROM base b
  LEFT JOIN override o ON o.priced_date = b.priced_date
  ORDER BY b.priced_date;
$$;
