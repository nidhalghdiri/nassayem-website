import type {
  BookingStatus,
  NetsuitePaymentStatus,
  Prisma,
} from "@prisma/client";

/** Raw query-string filters shared by the list pages and the Excel exports. */
export type ListFilterParams = {
  status?: string;
  q?: string;
  from?: string; // YYYY-MM-DD (inclusive, by payment date)
  to?: string; // YYYY-MM-DD (inclusive, by payment date)
  buildingId?: string; // NetSuite list only — resolved website Building id
  createdBy?: string; // NetSuite list only — receptionistEmail that triggered the link
};

/**
 * Build a paidAt range from the from/to query params. `to` is made inclusive
 * of the whole day. Returns undefined when neither bound is set.
 */
function paidAtRange(
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (from) {
    const d = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }
  return range.gte || range.lte ? range : undefined;
}

/** Prisma `where` for the admin Bookings list. */
export function buildBookingWhere(
  params: ListFilterParams,
): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  const status = params.status?.toUpperCase() ?? "ALL";
  if (status !== "ALL") where.status = status as BookingStatus;

  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { guestName: { contains: q, mode: "insensitive" } },
      { guestEmail: { contains: q, mode: "insensitive" } },
      { guestPhone: { contains: q } },
      { bookingCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const range = paidAtRange(params.from, params.to);
  if (range) where.paidAt = range;

  return where;
}

/** Prisma `where` for the admin NetSuite Payments list. */
export function buildNetsuiteWhere(
  params: ListFilterParams,
): Prisma.NetsuitePaymentWhereInput {
  const where: Prisma.NetsuitePaymentWhereInput = {};
  const status = params.status?.toUpperCase() ?? "ALL";

  // Default view hides soft-deleted records; the "Inactive" tab is the only
  // way to see them.
  if (status === "INACTIVE") {
    where.isActive = false;
  } else {
    where.isActive = true;
    if (status !== "ALL") where.status = status as NetsuitePaymentStatus;
  }

  const q = params.q?.trim();
  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { netsuiteReservationRef: { contains: q, mode: "insensitive" } },
      { netsuiteReservationId: { contains: q, mode: "insensitive" } },
      { unitCode: { contains: q, mode: "insensitive" } },
      { smartpayOrderId: { contains: q, mode: "insensitive" } },
      { smartpayBankRefNo: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.buildingId) where.buildingId = params.buildingId;

  const createdBy = params.createdBy?.trim();
  if (createdBy) where.receptionistEmail = { equals: createdBy, mode: "insensitive" };

  const range = paidAtRange(params.from, params.to);
  if (range) where.paidAt = range;

  return where;
}
