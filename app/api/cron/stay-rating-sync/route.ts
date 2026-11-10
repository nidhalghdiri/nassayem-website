/**
 * Retries writing submitted stay ratings to the NetSuite reservation.
 * Picks up rows that are still PENDING (the inline push never ran) or FAILED,
 * up to MAX_SYNC_ATTEMPTS. Scheduled in vercel.json.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { MAX_SYNC_ATTEMPTS, syncStayRatingToNetsuite } from "@/lib/stayRating";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // PENDING rows younger than 5 minutes are still being pushed inline.
  const stalePending = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await prisma.stayRating.findMany({
    where: {
      status: "SUBMITTED",
      nsSyncAttempts: { lt: MAX_SYNC_ATTEMPTS },
      OR: [
        { nsSyncStatus: "FAILED" },
        { nsSyncStatus: "PENDING", submittedAt: { lt: stalePending } },
      ],
    },
    select: { id: true },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });

  let synced = 0;
  for (const { id } of rows) {
    if (await syncStayRatingToNetsuite(id)) synced++;
  }
  return NextResponse.json({ checked: rows.length, synced, failed: rows.length - synced });
}
