/**
 * Stay rating helpers shared by the rating page, the submit API and the retry
 * cron.
 */

import crypto from "crypto";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { pushStayRatingToNetsuite } from "@/lib/netsuite";

export const RATING_CRITERIA = ["cleanliness", "reception", "facilities", "value"] as const;
export type RatingCriterion = (typeof RATING_CRITERIA)[number];

export const COMMENT_MAX = 1000;

/** 32 random bytes → 43 URL-safe chars. Unguessable; it is the guest's link. */
export function generateRatingToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * The token as it arrives in the URL. If the WhatsApp template's button URL was
 * registered with "{{1}}" as plain text instead of a variable, Meta sends the
 * link as /rate/{{1}}<token>; drop that prefix so those links still work.
 */
export function normalizeRatingToken(raw: string): string {
  return raw.replace(/^\{\{\s*1\s*\}\}/, "");
}

/** Tokens are exactly what generateRatingToken produces. */
export function isValidRatingToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

const star = z.number().int().min(1).max(5);

export const stayRatingSubmitSchema = z.object({
  cleanliness: star,
  reception: star,
  facilities: star,
  value: star,
  wouldRecommend: z.boolean(),
  comment: z.string().trim().max(COMMENT_MAX).optional(),
});
export type StayRatingSubmit = z.infer<typeof stayRatingSubmitSchema>;

/** After this many failed pushes the cron stops retrying (visible in admin). */
export const MAX_SYNC_ATTEMPTS = 10;

/**
 * Pushes one submitted rating to NetSuite and records the outcome. Never
 * throws: the guest's feedback is already safe in our database.
 */
export async function syncStayRatingToNetsuite(id: string): Promise<boolean> {
  const row = await prisma.stayRating.findUnique({ where: { id } });
  if (!row || row.status !== "SUBMITTED" || row.nsSyncStatus === "SYNCED") return false;
  if (
    row.cleanliness == null ||
    row.reception == null ||
    row.facilities == null ||
    row.value == null ||
    row.wouldRecommend == null ||
    !row.submittedAt
  ) {
    return false;
  }

  let result: { ok: true } | { ok: false; error: string };
  try {
    result = await pushStayRatingToNetsuite({
      netsuiteReservationId: row.netsuiteReservationId,
      cleanliness: row.cleanliness,
      reception: row.reception,
      facilities: row.facilities,
      value: row.value,
      wouldRecommend: row.wouldRecommend,
      comment: row.comment,
      submittedAt: row.submittedAt,
    });
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  await prisma.stayRating.update({
    where: { id },
    data: result.ok
      ? { nsSyncStatus: "SYNCED", nsSyncError: null, nsSyncedAt: new Date() }
      : {
          nsSyncStatus: "FAILED",
          nsSyncError: result.error.slice(0, 1000),
          nsSyncAttempts: { increment: 1 },
        },
  });
  return result.ok;
}
