/**
 * Manager-only: retry writing one submitted stay rating to the NetSuite
 * reservation (the "retry sync" button on /admin/stay-ratings).
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { hasManagerAccess } from "@/lib/tasks/constants";
import { syncStayRatingToNetsuite } from "@/lib/stayRating";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdminUser();
  if (!admin || !hasManagerAccess(admin.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ok = await syncStayRatingToNetsuite(id);
  const row = await prisma.stayRating.findUnique({
    where: { id },
    select: { nsSyncStatus: true, nsSyncError: true },
  });
  if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok, status: row.nsSyncStatus, error: row.nsSyncError });
}
