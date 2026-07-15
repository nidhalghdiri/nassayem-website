import type { Prisma } from "@prisma/client";

/** Raw query-string filters shared by the WhatsApp log page and its Excel export. */
export type WhatsAppLogFilterParams = {
  status?: string; // SENT | FAILED | SKIPPED | ALL
  kind?: string; // template | text | image | location | contact | ALL
  q?: string; // recipient number, template name, or message text
  from?: string; // YYYY-MM-DD (inclusive, by send date)
  to?: string; // YYYY-MM-DD (inclusive, by send date)
};

/**
 * Build a createdAt range from the from/to query params. `to` is made inclusive
 * of the whole day. Returns undefined when neither bound is set.
 */
function sentAtRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
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

/** Prisma `where` for the admin WhatsApp log list. */
export function buildWhatsAppLogWhere(
  params: WhatsAppLogFilterParams,
): Prisma.WhatsAppMessageLogWhereInput {
  const where: Prisma.WhatsAppMessageLogWhereInput = {};

  const status = params.status?.toUpperCase() ?? "ALL";
  if (status !== "ALL") where.status = status;

  const kind = params.kind?.trim();
  if (kind && kind !== "ALL") where.kind = kind;

  const q = params.q?.trim();
  if (q) {
    // Numbers are stored digits-only, so a search for "+968 9096 0071" or
    // "90960071" both have to reach the same row.
    const digits = q.replace(/\D/g, "");
    where.OR = [
      ...(digits ? [{ to: { contains: digits } }] : []),
      { templateName: { contains: q, mode: "insensitive" as const } },
      { body: { contains: q, mode: "insensitive" as const } },
      { waMessageId: { contains: q, mode: "insensitive" as const } },
    ];
  }

  const range = sentAtRange(params.from, params.to);
  if (range) where.createdAt = range;

  return where;
}
