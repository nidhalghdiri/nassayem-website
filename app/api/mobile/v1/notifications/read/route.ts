import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { mobileError, requireMobileUser } from "@/lib/mobileApi";

const ReadBody = z.object({
  /** Notifications to mark as read; omit to mark all of them. */
  ids: z.array(z.string().max(64)).max(200).optional(),
});

// ── POST /api/mobile/v1/notifications/read ───────────────────────────────────
// Marks the user's notifications as read. Returns the new unread count.
export async function POST(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = ReadBody.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return mobileError("VALIDATION", 400);
  const { ids } = parsed.data;

  await prisma.appNotification.updateMany({
    where: { adminUserId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  const unread = await prisma.appNotification.count({ where: { adminUserId: user.id, readAt: null } });
  return NextResponse.json({ unread });
}
