// ─────────────────────────────────────────────────────────────────────────────
// Admin transcript polling endpoint — powers the live (no-reload) conversation
// view. Returns messages created after the given cursor plus the conversation
// header state (status / aiPaused) so the toolbar stays in sync too.
// Self-authenticated: middleware skips /api/*.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import { resolveMediaUrlForDisplay } from "@/lib/chatbot/media";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || !canViewChatbot(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  const after = req.nextUrl.searchParams.get("after");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  const [conversation, messages] = await Promise.all([
    prisma.chatbotConversation.findUnique({
      where: { id: conversationId },
      select: { status: true, aiPaused: true, customerName: true },
    }),
    prisma.chatbotMessage.findMany({
      where: {
        conversationId,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    messages: await Promise.all(
      messages.map(async (m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        // Private customer media (ID/passport) is stored as a `private:` marker;
        // resolve it to a short-lived signed URL for display. Public URLs pass through.
        mediaUrl: await resolveMediaUrlForDisplay(m.mediaUrl),
        mediaType: m.mediaType,
        toolName: m.toolName,
        toolPayload: m.toolPayload,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        createdAt: m.createdAt.toISOString(),
      })),
    ),
  });
}
