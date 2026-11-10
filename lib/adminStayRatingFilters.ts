import type { Prisma } from "@prisma/client";

/** Raw query-string filters of the admin "Stay ratings" page. */
export type StayRatingFilterParams = {
  view?: string; // submitted (default) | all | waiting | attention | sync
  q?: string; // guest name, phone, reservation number, unit
  building?: string;
  from?: string; // YYYY-MM-DD, by submit date (by send date for "waiting"/"all")
  to?: string;
};

export const STAY_RATING_VIEWS = ["submitted", "attention", "sync", "waiting", "all"] as const;
export type StayRatingView = (typeof STAY_RATING_VIEWS)[number];

export function parseStayRatingView(raw?: string): StayRatingView {
  return (STAY_RATING_VIEWS as readonly string[]).includes(raw ?? "")
    ? (raw as StayRatingView)
    : "submitted";
}

/** Scores at or below this count as a low score. */
export const LOW_SCORE = 2;

/** Where clause that selects the status-tab's rows (without the other filters). */
function viewWhere(view: StayRatingView): Prisma.StayRatingWhereInput {
  switch (view) {
    case "submitted":
      return { status: "SUBMITTED" };
    case "waiting":
      return { status: "SENT" };
    case "attention":
      // Unhappy guests: any criterion at or below LOW_SCORE, or would not recommend.
      return {
        status: "SUBMITTED",
        OR: [
          { cleanliness: { lte: LOW_SCORE } },
          { reception: { lte: LOW_SCORE } },
          { facilities: { lte: LOW_SCORE } },
          { value: { lte: LOW_SCORE } },
          { wouldRecommend: false },
        ],
      };
    case "sync":
      // Submitted but not (yet) on the NetSuite reservation.
      return { status: "SUBMITTED", nsSyncStatus: { in: ["FAILED", "PENDING"] } };
    default:
      return {};
  }
}

function dayRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};
  if (from) {
    const d = new Date(`${from}T00:00:00+04:00`); // Oman time
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999+04:00`);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }
  return range.gte || range.lte ? range : undefined;
}

/**
 * Prisma `where` for the page. `view` picks the tab; the other filters apply
 * on top. `forView` lets the page count other tabs with the same search/date
 * filters.
 */
export function buildStayRatingWhere(
  params: StayRatingFilterParams,
  forView: StayRatingView = parseStayRatingView(params.view),
): Prisma.StayRatingWhereInput {
  const and: Prisma.StayRatingWhereInput[] = [viewWhere(forView)];

  const building = params.building?.trim();
  if (building) and.push({ building });

  const q = params.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { reservationNumber: { contains: q, mode: "insensitive" } },
        { unitNumbers: { contains: q, mode: "insensitive" } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }

  const range = dayRange(params.from, params.to);
  if (range) {
    // Rated lists filter by when the guest rated; the others by when we asked.
    const rated = forView === "submitted" || forView === "attention" || forView === "sync";
    and.push(rated ? { submittedAt: range } : { createdAt: range });
  }

  return { AND: and };
}
