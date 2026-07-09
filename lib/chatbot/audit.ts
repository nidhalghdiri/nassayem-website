// ─────────────────────────────────────────────────────────────────────────────
// LLM-graded conversation audit. One call = one conversation graded against a
// fixed rubric (outcome, funnel stage, issue taxonomy with quoted evidence,
// topics, sentiment) and stored in ChatbotConversationAudit. Deterministic
// facts (reservation created, payment status, lead status) are computed from
// the database and OVERRIDE the model where they conflict — the model grades
// quality, the database decides money facts.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { runModelTurn } from "@/lib/ai/provider";
import { getChatModel } from "@/lib/ai/provider";

export const ISSUE_TAGS = [
  "wrong_fact",
  "ignored_question",
  "repetition",
  "wrong_language",
  "robotic_tone",
  "tool_failure_visible",
  "wrong_refusal",
  "missed_escalation",
  "over_escalation",
  "invented_price_or_discount",
  "other",
] as const;

const OUTCOMES = [
  "paid",
  "reserved_unpaid",
  "lead_captured",
  "escalated",
  "info_only",
  "abandoned",
  "spam",
] as const;

type Verdict = {
  outcome: (typeof OUTCOMES)[number];
  funnel_stage: number;
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  missed_booking: boolean;
  missed_booking_reason?: string;
  issues: { tag: string; evidence: string; suggested_fix: string }[];
  topics: string[];
  abandonment_last_bot_message?: string;
  summary: string;
};

const RUBRIC = `You are a strict quality auditor for a property-rental WhatsApp/web chatbot (Nassayem Salalah, furnished apartments in Salalah, Oman). You receive one full conversation transcript (customer, bot, staff, and the bot's internal tool calls) plus verified database facts. Grade it and return ONLY a JSON object — no markdown, no commentary.

JSON shape:
{
  "outcome": "paid" | "reserved_unpaid" | "lead_captured" | "escalated" | "info_only" | "abandoned" | "spam",
  "funnel_stage": 1-8,   // 1 started, 2 qualified (dates+type known), 3 options shown, 4 booking intent, 5 details collected (name/phone/ID), 6 reservation created, 7 payment link sent, 8 paid
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",  // customer's state at the END
  "missed_booking": boolean,   // true if a genuinely interested customer did NOT end up booking and the bot could plausibly have done better
  "missed_booking_reason": "one short sentence, only when missed_booking is true",
  "issues": [ { "tag": "...", "evidence": "SHORT direct quote from the transcript (original language)", "suggested_fix": "one short actionable sentence" } ],
  "topics": [ "short_english_snake_case_topic", ... ],   // every distinct thing the customer asked about, e.g. "parking", "cancellation_policy", "khareef_weather", "price_negotiation", "airport_pickup", "kitchen", "location", "photos"
  "abandonment_last_bot_message": "the bot's final message before the customer went silent — ONLY when outcome is abandoned",
  "summary": "1-2 sentences in English: what happened and why it ended how it ended"
}

Issue tags (use ONLY these): ${ISSUE_TAGS.join(", ")}.
- wrong_fact: bot stated something false or unsupported by tool data (prices, policies, amenities).
- ignored_question: customer asked something; bot answered something else or skipped it.
- repetition: bot repeated essentially the same sentence/offer more than once.
- wrong_language: replied in the wrong language/script for the customer.
- robotic_tone: corporate/robotic phrasing, numbered menus, walls of text.
- tool_failure_visible: a technical failure leaked to the customer (error apologies, "unit not found", broken flow).
- wrong_refusal: refused/blocked something the business allows.
- missed_escalation: clear frustration or human-request without escalation.
- over_escalation: escalated when the bot could easily have handled it.
- invented_price_or_discount: quoted numbers or promised discounts not backed by tool results.

Be selective: only report issues with REAL evidence in the transcript. An empty issues array is a valid answer for a good conversation. Do not invent topics that were not discussed. Judge outcome/funnel_stage from BOTH the transcript and the verified facts block (the facts win on reservation/payment questions).`;

function renderTranscript(
  messages: {
    role: string;
    content: string;
    toolName: string | null;
    toolPayload: unknown;
    mediaType: string | null;
    createdAt: Date;
  }[],
): string {
  const lines: string[] = [];
  for (const m of messages) {
    const t = m.createdAt.toISOString().slice(5, 16).replace("T", " ");
    if (m.role === "TOOL") {
      const result = (m.toolPayload as { result?: unknown })?.result;
      const json = result !== undefined ? JSON.stringify(result) : "";
      lines.push(
        `[${t}] TOOL ${m.toolName}: ${json.length > 400 ? json.slice(0, 400) + "…" : json}`,
      );
    } else {
      const media = m.mediaType ? ` [${m.mediaType} attached]` : "";
      lines.push(`[${t}] ${m.role}:${media} ${m.content}`);
    }
  }
  // Bound the payload — very long chats keep the tail (the ending matters most).
  const text = lines.join("\n");
  return text.length > 60_000 ? "…(earlier messages truncated)\n" + text.slice(-60_000) : text;
}

function parseVerdict(raw: string): Verdict {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in verdict");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Verdict;
  if (!OUTCOMES.includes(parsed.outcome)) parsed.outcome = "info_only";
  parsed.funnel_stage = Math.min(8, Math.max(1, Math.round(parsed.funnel_stage || 1)));
  parsed.issues = Array.isArray(parsed.issues) ? parsed.issues.slice(0, 12) : [];
  parsed.topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 20) : [];
  return parsed;
}

/** Audit one conversation and upsert its ChatbotConversationAudit row. */
export async function auditConversation(conversationId: string): Promise<void> {
  const conversation = await prisma.chatbotConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      leads: { select: { status: true } },
    },
  });
  if (!conversation) throw new Error("conversation not found");

  // ── Deterministic facts ────────────────────────────────────────────────────
  let reservationRef: string | null = null;
  for (const m of conversation.messages) {
    if (m.role === "TOOL" && m.toolName === "create_reservation") {
      const result = (m.toolPayload as { result?: { reserved?: boolean; reservation_ref?: string } })
        ?.result;
      if (result?.reserved && result.reservation_ref) {
        reservationRef = String(result.reservation_ref);
      }
    }
  }
  let paymentStatus: string | null = null;
  if (reservationRef) {
    const payment = await prisma.netsuitePayment.findFirst({
      where: {
        OR: [
          { netsuiteReservationRef: reservationRef },
          { netsuiteReservationId: reservationRef },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    paymentStatus = payment?.status ?? null;
  }

  const facts = [
    `channel: ${conversation.channel}`,
    `conversation_status: ${conversation.status}`,
    `customer_messages: ${conversation.messages.filter((m) => m.role === "USER").length}`,
    `lead_statuses: ${conversation.leads.map((l) => l.status).join(", ") || "none"}`,
    `reservation_created: ${reservationRef ? `yes (${reservationRef})` : "no"}`,
    `payment_status: ${paymentStatus ?? "no payment link found"}`,
  ].join("\n");

  // ── Grade ──────────────────────────────────────────────────────────────────
  const turn = await runModelTurn({
    system: RUBRIC,
    messages: [
      {
        role: "user",
        content: `VERIFIED DATABASE FACTS:\n${facts}\n\nTRANSCRIPT:\n${renderTranscript(conversation.messages)}`,
      },
    ],
    maxTokens: 1500,
  });
  const text = turn.content
    .filter((b): b is Extract<(typeof turn.content)[number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  const verdict = parseVerdict(text);

  // Database facts override the model on money questions.
  if (paymentStatus === "PAID") {
    verdict.outcome = "paid";
    verdict.funnel_stage = 8;
  } else if (reservationRef) {
    if (verdict.outcome !== "paid") verdict.outcome = "reserved_unpaid";
    verdict.funnel_stage = Math.max(verdict.funnel_stage, 7);
  }

  await prisma.chatbotConversationAudit.upsert({
    where: { conversationId },
    update: {
      auditedAt: new Date(),
      model: getChatModel(),
      outcome: verdict.outcome,
      funnelStage: verdict.funnel_stage,
      sentiment: verdict.sentiment ?? "neutral",
      missedBooking: !!verdict.missed_booking,
      missedBookingReason: verdict.missed_booking_reason ?? null,
      reservationCreated: !!reservationRef,
      paymentStatus,
      issues: JSON.parse(JSON.stringify(verdict.issues)),
      topics: JSON.parse(JSON.stringify(verdict.topics)),
      abandonLastBotMessage: verdict.abandonment_last_bot_message ?? null,
      summary: verdict.summary ?? "",
    },
    create: {
      conversationId,
      model: getChatModel(),
      outcome: verdict.outcome,
      funnelStage: verdict.funnel_stage,
      sentiment: verdict.sentiment ?? "neutral",
      missedBooking: !!verdict.missed_booking,
      missedBookingReason: verdict.missed_booking_reason ?? null,
      reservationCreated: !!reservationRef,
      paymentStatus,
      issues: JSON.parse(JSON.stringify(verdict.issues)),
      topics: JSON.parse(JSON.stringify(verdict.topics)),
      abandonLastBotMessage: verdict.abandonment_last_bot_message ?? null,
      summary: verdict.summary ?? "",
    },
  });
}

/** Conversations needing an audit (new, or with messages since last audit). */
export async function findAuditCandidates(limit: number): Promise<{
  pending: string[];
  remaining: number;
}> {
  const rows = await prisma.chatbotConversation.findMany({
    where: {
      NOT: { externalId: { startsWith: "playground-" } },
      messages: { some: { role: "USER" } },
    },
    select: {
      id: true,
      lastMessageAt: true,
      audit: { select: { auditedAt: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  const stale = rows.filter(
    (r) => !r.audit || r.audit.auditedAt < r.lastMessageAt,
  );
  return { pending: stale.slice(0, limit).map((r) => r.id), remaining: stale.length };
}
