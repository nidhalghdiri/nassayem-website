import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { mobileError, requireMobileUser } from "@/lib/mobileApi";

const PAGE_SIZE = 30;

const ListQuery = z.object({ cursor: z.string().optional() });

// ── GET /api/mobile/v1/notifications ─────────────────────────────────────────
// The signed-in user's notifications, newest first, plus their unread count.
// ?cursor=<nextCursor from the last page>
export async function GET(request: Request) {
  const user = await requireMobileUser();
  if (user instanceof NextResponse) return user;

  const parsed = ListQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return mobileError("VALIDATION", 400);
  const { cursor } = parsed.data;

  const [rows, unread] = await Promise.all([
    prisma.appNotification.findMany({
      where: { adminUserId: user.id },
      select: { id: true, type: true, title: true, body: true, url: true, readAt: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.appNotification.count({ where: { adminUserId: user.id, readAt: null } }),
  ]);

  const hasMore = rows.length > PAGE_SIZE;
  const notifications = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return NextResponse.json({
    notifications,
    nextCursor: hasMore ? notifications[notifications.length - 1].id : null,
    unread,
  });
}
