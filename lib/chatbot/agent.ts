// ─────────────────────────────────────────────────────────────────────────────
// Core chatbot orchestration — shared by the web widget, the admin playground
// and (later) the WhatsApp webhook; only the transport differs per channel.
//
// One call = one customer turn:
//   rate-limit → load conversation + history + live config → tool loop
//   (model → execute tools → feed results back, capped) → persist everything.
//
// Failure policy: the customer ALWAYS gets a polite reply with the call-center
// number — errors are logged, never thrown to the transport.
// ─────────────────────────────────────────────────────────────────────────────

import type Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import type { ChatChannel } from "@prisma/client";
import { runModelTurn } from "@/lib/ai/provider";
import { getChatbotSettings, type ChatbotSettings } from "./config";
import { buildSystemPrompt, salalahTodayISO } from "./prompt";
import { getAnthropicTools, executeChatbotTool } from "./tools";
import { checkChatbotRateLimit } from "./rateLimit";

const MAX_TOOL_ITERATIONS = 5;
const HISTORY_MESSAGES = 30; // includes replayed tool results
const MAX_INBOUND_CHARS = 2000;
const TOOL_REPLAY_CHARS = 700; // per tool result, when replayed into history

export type ChatbotTurnResult = {
  conversationId: string;
  /** Final assistant text (already streamed via onTextDelta when provided). */
  text: string;
  escalated: boolean;
  /**
   * True when the admin pressed "Stop AI" on this conversation: the customer
   * message was stored but no model call was made and no reply should be
   * sent. Transports must send nothing when this is set.
   */
  aiPaused?: boolean;
  /** Detected customer language for this turn ("ar" | "en"). */
  language: string;
  /**
   * Tools executed during this turn (name + result). Lets channel transports
   * add native follow-ups — e.g. WhatsApp sends gallery images after
   * get_unit_details and a location pin after get_building_info.
   */
  toolCalls: { name: string; result: unknown }[];
};

export type ChatbotTurnOptions = {
  channel: ChatChannel;
  /** WhatsApp phone (digits) or web-session UUID. */
  externalId: string;
  message: string;
  customerName?: string;
  /** Inbound provider message id (WhatsApp wamid) — stored for webhook-retry dedupe. */
  externalMessageId?: string;
  /** Inbound media already mirrored to storage — stored on the USER row so the admin transcript can render it. */
  media?: { url: string; type: string };
  /** Stream text to the transport as the model produces it (web widget). */
  onTextDelta?: (text: string) => void;
};

const ARABIC_RE = /[؀-ۿ]/;

function fallbackText(language: string, settings: ChatbotSettings): string {
  return language === "ar"
    ? `عذراً، صار عندنا خلل تقني بسيط. تقدر تتواصل مع فريقنا مباشرة على ${settings.contact_numbers.call_center} وبيخدموك فوراً 🙏`
    : `Sorry, we hit a small technical issue. You can reach our team directly at ${settings.contact_numbers.call_center} and they'll help you right away 🙏`;
}

function rateLimitText(language: string, settings: ChatbotSettings): string {
  return language === "ar"
    ? `استلمنا رسائل كثيرة منك خلال وقت قصير. انتظر شوي وحاول مرة ثانية، أو اتصل بنا على ${settings.contact_numbers.call_center}.`
    : `You've sent quite a few messages in a short time. Please wait a moment and try again, or call us at ${settings.contact_numbers.call_center}.`;
}

export async function runChatbotTurn(
  opts: ChatbotTurnOptions,
): Promise<ChatbotTurnResult> {
  const settings = await getChatbotSettings();
  const message = opts.message.trim().slice(0, MAX_INBOUND_CHARS);
  const language = ARABIC_RE.test(message) ? "ar" : "en";

  // ── Rate limit (before persisting, so the message doesn't count itself) ────
  const rate = await checkChatbotRateLimit(opts.channel, opts.externalId);

  // ── Find or create the conversation ───────────────────────────────────────
  const conversation = await prisma.chatbotConversation.upsert({
    where: {
      channel_externalId: { channel: opts.channel, externalId: opts.externalId },
    },
    update: {
      lastMessageAt: new Date(),
      language,
      ...(opts.customerName ? { customerName: opts.customerName } : {}),
    },
    create: {
      channel: opts.channel,
      externalId: opts.externalId,
      customerName: opts.customerName ?? null,
      language,
    },
  });

  if (conversation.status === "CLOSED") {
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { status: "ACTIVE" },
    });
  }

  // "Stop AI": store the customer's message for the team to read, but never
  // call the model and never reply — zero token spend during human handling.
  if (conversation.aiPaused) {
    await prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message,
        waMessageId: opts.externalMessageId ?? null,
        mediaUrl: opts.media?.url ?? null,
        mediaType: opts.media?.type ?? null,
      },
    });
    return {
      conversationId: conversation.id,
      text: "",
      escalated: conversation.status === "ESCALATED",
      aiPaused: true,
      language,
      toolCalls: [],
    };
  }

  if (!rate.allowed) {
    const text = rateLimitText(language, settings);
    opts.onTextDelta?.(text);
    return {
      conversationId: conversation.id,
      text,
      escalated: false,
      language,
      toolCalls: [],
    };
  }

  // ── History — loaded BEFORE persisting this message ───────────────────────
  // STAFF rows (human handoff) are included as assistant turns so a resumed
  // bot knows what the team already said. TOOL rows are replayed as compact
  // "[tool_result …]" assistant lines: without them the model loses the unit
  // ids returned by earlier searches and starts inventing placeholder UUIDs
  // when the customer books a unit discussed a few turns ago.
  const historyRows = await prisma.chatbotMessage.findMany({
    where: {
      conversationId: conversation.id,
      content: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_MESSAGES,
  });
  historyRows.reverse();
  // The API requires the first message to be from the user.
  while (historyRows.length > 0 && historyRows[0].role !== "USER") {
    historyRows.shift();
  }

  await prisma.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message,
      waMessageId: opts.externalMessageId ?? null,
      mediaUrl: opts.media?.url ?? null,
      mediaType: opts.media?.type ?? null,
    },
  });

  type Turn = { role: "user" | "assistant"; text: string };
  const turns: Turn[] = [];
  for (const row of historyRows) {
    let turn: Turn | null = null;
    if (row.role === "USER") {
      turn = { role: "user", text: row.content };
    } else if (row.role === "ASSISTANT") {
      turn = { role: "assistant", text: row.content };
    } else if (row.role === "STAFF") {
      turn = { role: "assistant", text: `[Staff member]: ${row.content}` };
    } else if (row.role === "TOOL" && row.toolName && row.toolPayload) {
      const result = (row.toolPayload as { result?: unknown }).result;
      if (result !== undefined) {
        const json = JSON.stringify(result);
        turn = {
          role: "assistant",
          text: `[tool_result ${row.toolName}]: ${json.length > TOOL_REPLAY_CHARS ? json.slice(0, TOOL_REPLAY_CHARS) + "…(truncated)" : json}`,
        };
      }
    }
    if (!turn) continue;
    // Merge consecutive same-role turns — keeps user/assistant alternation.
    const last = turns[turns.length - 1];
    if (last && last.role === turn.role) {
      last.text += `\n\n${turn.text}`;
    } else {
      turns.push(turn);
    }
  }

  // Append the current message through the same merge rule (history can end
  // with user turns, e.g. messages that arrived while the AI was paused).
  const lastTurn = turns[turns.length - 1];
  if (lastTurn && lastTurn.role === "user") {
    lastTurn.text += `\n\n${message}`;
  } else {
    turns.push({ role: "user", text: message });
  }

  const messages: Anthropic.MessageParam[] = turns.map(
    (t): Anthropic.MessageParam => ({ role: t.role, content: t.text }),
  );

  const system = buildSystemPrompt(settings, {
    channel: opts.channel,
    todayISO: salalahTodayISO(),
  });
  const tools = getAnthropicTools();

  // ── Tool loop ──────────────────────────────────────────────────────────────
  let streamedText = "";
  const onTextDelta = opts.onTextDelta
    ? (delta: string) => {
        streamedText += delta;
        opts.onTextDelta!(delta);
      }
    : undefined;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";
  const executedToolCalls: { name: string; result: unknown }[] = [];

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const turn = await runModelTurn({ system, messages, tools, onTextDelta });
      totalInputTokens += turn.usage.inputTokens;
      totalOutputTokens += turn.usage.outputTokens;

      const textBlocks = turn.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );
      const turnText = textBlocks.map((b) => b.text).join("");
      if (turnText) finalText += (finalText ? "\n\n" : "") + turnText;

      const toolUses = turn.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      if (turn.stopReason !== "tool_use" || toolUses.length === 0) break;

      // Execute all requested tools, persist a TOOL row per call.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolUses) {
        const execution = await executeChatbotTool(call.name, call.input, {
          conversationId: conversation.id,
        });
        if (!execution.isError) {
          executedToolCalls.push({ name: call.name, result: execution.result });
        }
        await prisma.chatbotMessage.create({
          data: {
            conversationId: conversation.id,
            role: "TOOL",
            content: execution.isError
              ? `${call.name} → error`
              : `${call.name}`,
            toolName: call.name,
            toolPayload: JSON.parse(
              JSON.stringify({ input: call.input, result: execution.result }),
            ),
          },
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(execution.result),
          is_error: execution.isError,
        });
      }

      messages.push({ role: "assistant", content: turn.content });
      messages.push({ role: "user", content: toolResults });

      // Safety valve: if we're about to exceed the cap, force a final answer
      // by continuing the loop one more time without tools being required —
      // the cap itself breaks us out below.
      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        console.warn("[chatbot] tool loop hit iteration cap");
      }
    }

    if (!finalText.trim()) {
      // Model produced no text (refusal / max-iteration edge) — safe fallback.
      finalText = fallbackText(language, settings);
      opts.onTextDelta?.(finalText);
    }
  } catch (err) {
    console.error("[chatbot] turn failed:", err);
    finalText = fallbackText(language, settings);
    // Stream the fallback only if nothing was streamed yet (avoid garbled UX).
    if (!streamedText) opts.onTextDelta?.(finalText);
  }

  // ── Persist the assistant turn ─────────────────────────────────────────────
  await prisma.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: finalText,
      inputTokens: totalInputTokens || null,
      outputTokens: totalOutputTokens || null,
    },
  });
  await prisma.chatbotConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  const after = await prisma.chatbotConversation.findUnique({
    where: { id: conversation.id },
    select: { status: true },
  });

  return {
    conversationId: conversation.id,
    text: finalText,
    escalated: after?.status === "ESCALATED",
    language,
    toolCalls: executedToolCalls,
  };
}
