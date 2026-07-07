// ─────────────────────────────────────────────────────────────────────────────
// Conversation list for the WhatsApp-style admin inbox sidebar. Polled by the
// client so new customer messages float conversations up without a reload.
// Self-authenticated: middleware skips /api/*.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma, ChatConversationStatus } from "@prisma/client";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";

export const dynamic = "force-dynamic";

const REAL_CUSTOMERS = { NOT: { externalId: { startsWith: "playground-" } } };
const STATUSES = ["ACTIVE", "ESCALATED", "CLOSED"] as const;

export async function GET(req: NextRequest) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || !canViewChatbot(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const status = params.get("status") ?? "ALL";
  const q = params.get("q")?.trim() ?? "";

  const where: Prisma.ChatbotConversationWhereInput = {
    ...REAL_CUSTOMERS,
    ...(STATUSES.includes(status as (typeof STATUSES)[number])
      ? { status: status as ChatConversationStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { externalId: { contains: q, mode: "insensitive" } },
            { customerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [conversations, counts] = await Promise.all([
    prisma.chatbotConversation.findMany({
      where,
      include: {
        // Last customer-visible message as the preview line.
        messages: {
          where: { role: { in: ["USER", "ASSISTANT", "STAFF"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { role: true, content: true, mediaType: true },
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    prisma.chatbotConversation.groupBy({
      by: ["status"],
      where: REAL_CUSTOMERS,
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    counts: {
      ALL: counts.reduce((s, c) => s + c._count._all, 0),
      ACTIVE: counts.find((c) => c.status === "ACTIVE")?._count._all ?? 0,
      ESCALATED: counts.find((c) => c.status === "ESCALATED")?._count._all ?? 0,
      CLOSED: counts.find((c) => c.status === "CLOSED")?._count._all ?? 0,
    },
    conversations: conversations.map((c) => {
      const last = c.messages[0];
      const prefix =
        last?.role === "ASSISTANT" ? "🤖 " : last?.role === "STAFF" ? "👤 " : "";
      const body = last?.mediaType
        ? `${prefix}📎 ${last.mediaType}`
        : `${prefix}${last?.content ?? ""}`;
      return {
        id: c.id,
        channel: c.channel,
        customerName: c.customerName,
        externalId: c.externalId,
        status: c.status,
        aiPaused: c.aiPaused,
        language: c.language,
        lastMessageAt: c.lastMessageAt.toISOString(),
        preview: body.slice(0, 70),
      };
    }),
  });
}
