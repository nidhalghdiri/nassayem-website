/**
 * Public submit endpoint for the stay-rating form (/rate/{token}).
 *
 * The token is the only credential. A rating can be submitted once: the
 * update is conditional on status = SENT, so a double tap or a replayed
 * request cannot overwrite the first answer. The rating is saved to our
 * database first; the NetSuite write follows and, if it fails, is retried by
 * /api/cron/stay-rating-sync — the guest always sees success once it is saved.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  isValidRatingToken,
  stayRatingSubmitSchema,
  syncStayRatingToNetsuite,
} from "@/lib/stayRating";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isValidRatingToken(token)) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = stayRatingSubmitSchema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.stayRating.findUnique({
    where: { token },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  if (existing.status === "SUBMITTED") {
    return NextResponse.json({ ok: false, error: "already-submitted" }, { status: 409 });
  }

  // Conditional update: only the first submission wins.
  const updated = await prisma.stayRating.updateMany({
    where: { id: existing.id, status: "SENT" },
    data: {
      status: "SUBMITTED",
      cleanliness: data.cleanliness,
      reception: data.reception,
      facilities: data.facilities,
      value: data.value,
      wouldRecommend: data.wouldRecommend,
      comment: data.comment || null,
      submittedAt: new Date(),
      nsSyncStatus: "PENDING",
    },
  });
  if (updated.count === 0) {
    return NextResponse.json({ ok: false, error: "already-submitted" }, { status: 409 });
  }

  // Best effort, awaited so serverless does not freeze it mid-request. A
  // failure is recorded on the row and retried by the cron.
  await syncStayRatingToNetsuite(existing.id).catch((e) =>
    console.error("[stay-rating] NetSuite sync threw:", e),
  );

  return NextResponse.json({ ok: true });
}
