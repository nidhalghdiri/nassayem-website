// ─────────────────────────────────────────────────────────────────────────────
// Per-customer rate limiting for the chatbot, keyed by (channel, externalId).
// DB-backed (counts recent ChatbotMessage rows) so it works across serverless
// instances without extra infrastructure. Costs one indexed count query per
// inbound message — negligible next to the model call.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import type { ChatChannel } from "@prisma/client";

const PER_MINUTE_LIMIT = 8;
const PER_DAY_LIMIT = 150;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; scope: "minute" | "day" };

export async function checkChatbotRateLimit(
  channel: ChatChannel,
  externalId: string,
): Promise<RateLimitResult> {
  const now = Date.now();

  const conversationFilter = { conversation: { channel, externalId } };

  const lastMinute = await prisma.chatbotMessage.count({
    where: {
      ...conversationFilter,
      role: "USER",
      createdAt: { gt: new Date(now - 60_000) },
    },
  });
  if (lastMinute >= PER_MINUTE_LIMIT) return { allowed: false, scope: "minute" };

  const lastDay = await prisma.chatbotMessage.count({
    where: {
      ...conversationFilter,
      role: "USER",
      createdAt: { gt: new Date(now - 24 * 60 * 60 * 1000) },
    },
  });
  if (lastDay >= PER_DAY_LIMIT) return { allowed: false, scope: "day" };

  return { allowed: true };
}
