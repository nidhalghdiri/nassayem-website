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
import { isPrivateMedia, downloadPrivateImageBase64 } from "./media";

const MAX_TOOL_ITERATIONS = 5;
const HISTORY_MESSAGES = 30; // includes replayed tool results
const MAX_INBOUND_CHARS = 2000;
const TOOL_REPLAY_CHARS = 700; // per tool result, when replayed into history
const MAX_VISION_IMAGES = 4; // images attached from the customer's latest turn

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
  /**
   * True when this message was coalesced into a later message in the same burst
   * (debounce): the customer sent several messages quickly, so a later
   * invocation generates ONE reply covering all of them and this one bows out.
   * Transports must send nothing when this is set.
   */
  superseded?: boolean;
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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type IngestOutcome =
  | { kind: "terminal"; result: ChatbotTurnResult }
  | {
      kind: "generate";
      conversationId: string;
      /** id of the USER row just stored — used by the debounce latest-wins check. */
      storedMessageId: string;
      language: string;
      settings: ChatbotSettings;
    };

/**
 * Rate-limit, find/create the conversation and PERSIST the customer's message —
 * everything that must happen for every inbound message, whether or not this
 * particular invocation ends up generating the reply. Splitting this out from
 * reply generation is what lets us debounce bursts of quick messages: each
 * message is stored here, but only the last one in a burst generates.
 */
async function ingestUserMessage(opts: ChatbotTurnOptions): Promise<IngestOutcome> {
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
      kind: "terminal",
      result: {
        conversationId: conversation.id,
        text: "",
        escalated: conversation.status === "ESCALATED",
        aiPaused: true,
        language,
        toolCalls: [],
      },
    };
  }

  if (!rate.allowed) {
    const text = rateLimitText(language, settings);
    opts.onTextDelta?.(text);
    return {
      kind: "terminal",
      result: {
        conversationId: conversation.id,
        text,
        escalated: false,
        language,
        toolCalls: [],
      },
    };
  }

  const stored = await prisma.chatbotMessage.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: message,
      waMessageId: opts.externalMessageId ?? null,
      mediaUrl: opts.media?.url ?? null,
      mediaType: opts.media?.type ?? null,
    },
    select: { id: true },
  });

  return {
    kind: "generate",
    conversationId: conversation.id,
    storedMessageId: stored.id,
    language,
    settings,
  };
}

/**
 * Generate and persist the assistant reply from the conversation's stored
 * history. The customer's message(s) are ALREADY stored (by ingestUserMessage),
 * so consecutive user messages from a burst are naturally merged into one user
 * turn here — the model sees the customer's full intent, not one fragment.
 */
async function generateReply(params: {
  conversationId: string;
  language: string;
  settings: ChatbotSettings;
  channel: ChatChannel;
  onTextDelta?: (text: string) => void;
}): Promise<ChatbotTurnResult> {
  const { conversationId, language, settings, channel } = params;

  // ── History (includes the message(s) just stored) ─────────────────────────
  // STAFF rows (human handoff) are included as assistant turns so a resumed
  // bot knows what the team already said. TOOL rows are replayed as compact
  // "[tool_result …]" assistant lines: without them the model loses the unit
  // ids returned by earlier searches and starts inventing placeholder UUIDs
  // when the customer books a unit discussed a few turns ago.
  const historyRows = await prisma.chatbotMessage.findMany({
    where: {
      conversationId,
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
    // Merge consecutive same-role turns — keeps user/assistant alternation AND
    // fuses the burst's fragmented user messages into a single user turn.
    const last = turns[turns.length - 1];
    if (last && last.role === turn.role) {
      last.text += `\n\n${turn.text}`;
    } else {
      turns.push(turn);
    }
  }

  // Nothing to answer (shouldn't happen — a USER row was just stored).
  if (turns.length === 0 || turns[0].role !== "user") {
    return { conversationId, text: "", escalated: false, language, toolCalls: [] };
  }

  const messages: Anthropic.MessageParam[] = turns.map(
    (t): Anthropic.MessageParam => ({ role: t.role, content: t.text }),
  );

  // ── Vision: attach the images the customer sent in their LATEST turn ───────
  // So the model can actually SEE them (e.g. read an ID/passport). Only the
  // trailing user turn's private images, capped, to keep vision tokens bounded —
  // older images stay as their text placeholder in history.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user" && typeof lastMessage.content === "string") {
    const trailingImageUrls: string[] = [];
    for (let i = historyRows.length - 1; i >= 0; i--) {
      const row = historyRows[i];
      if (row.role !== "USER") break; // only the final consecutive user turn
      if (row.mediaType?.startsWith("image") && isPrivateMedia(row.mediaUrl)) {
        trailingImageUrls.unshift(row.mediaUrl);
      }
    }
    if (trailingImageUrls.length > 0) {
      const imageBlocks: Anthropic.ImageBlockParam[] = [];
      for (const url of trailingImageUrls.slice(0, MAX_VISION_IMAGES)) {
        const img = await downloadPrivateImageBase64(url);
        if (img) {
          imageBlocks.push({
            type: "image",
            source: { type: "base64", media_type: img.mediaType, data: img.base64 },
          });
        }
      }
      if (imageBlocks.length > 0) {
        lastMessage.content = [
          { type: "text", text: lastMessage.content },
          ...imageBlocks,
        ];
      }
    }
  }

  const system = buildSystemPrompt(settings, {
    channel,
    todayISO: salalahTodayISO(),
  });
  const tools = getAnthropicTools();

  // ── Tool loop ──────────────────────────────────────────────────────────────
  let streamedText = "";
  const onTextDelta = params.onTextDelta
    ? (delta: string) => {
        streamedText += delta;
        params.onTextDelta!(delta);
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
          conversationId,
        });
        if (!execution.isError) {
          executedToolCalls.push({ name: call.name, result: execution.result });
        }
        await prisma.chatbotMessage.create({
          data: {
            conversationId,
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
      params.onTextDelta?.(finalText);
    }
  } catch (err) {
    console.error("[chatbot] turn failed:", err);
    finalText = fallbackText(language, settings);
    // Stream the fallback only if nothing was streamed yet (avoid garbled UX).
    if (!streamedText) params.onTextDelta?.(finalText);
  }

  // ── Persist the assistant turn ─────────────────────────────────────────────
  await prisma.chatbotMessage.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content: finalText,
      inputTokens: totalInputTokens || null,
      outputTokens: totalOutputTokens || null,
    },
  });
  await prisma.chatbotConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  const fresh = await prisma.chatbotConversation.findUnique({
    where: { id: conversationId },
    select: { status: true },
  });

  return {
    conversationId,
    text: finalText,
    escalated: fresh?.status === "ESCALATED",
    language,
    toolCalls: executedToolCalls,
  };
}

/**
 * One customer turn: store the message, then generate the reply. Used by the
 * web widget and admin playground (no debounce — those channels send one
 * message at a time).
 */
export async function runChatbotTurn(
  opts: ChatbotTurnOptions,
): Promise<ChatbotTurnResult> {
  const ingest = await ingestUserMessage(opts);
  if (ingest.kind === "terminal") return ingest.result;
  return generateReply({
    conversationId: ingest.conversationId,
    language: ingest.language,
    settings: ingest.settings,
    channel: opts.channel,
    onTextDelta: opts.onTextDelta,
  });
}

/**
 * Debounced turn for chat transports where a customer often splits one thought
 * across several quick messages (WhatsApp). Every message is stored immediately,
 * then we wait `debounceMs`; only the invocation whose message is still the most
 * recent one generates a reply (which, thanks to history merging, covers the
 * whole burst). Earlier invocations return `superseded` so the transport sends
 * nothing for them. Net effect: one coherent reply per burst, sent `debounceMs`
 * after the customer's last message.
 */
export async function runChatbotTurnDebounced(
  opts: ChatbotTurnOptions,
  debounceMs: number,
): Promise<ChatbotTurnResult> {
  const ingest = await ingestUserMessage(opts);
  if (ingest.kind === "terminal") return ingest.result;

  if (debounceMs > 0) {
    await sleep(debounceMs);
    // Latest-message-wins: if a newer USER message landed during the wait,
    // its own invocation will produce the coalesced reply — bow out here.
    const latest = await prisma.chatbotMessage.findFirst({
      where: { conversationId: ingest.conversationId, role: "USER" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (latest && latest.id !== ingest.storedMessageId) {
      return {
        conversationId: ingest.conversationId,
        text: "",
        escalated: false,
        superseded: true,
        language: ingest.language,
        toolCalls: [],
      };
    }
  }

  return generateReply({
    conversationId: ingest.conversationId,
    language: ingest.language,
    settings: ingest.settings,
    channel: opts.channel,
    onTextDelta: opts.onTextDelta,
  });
}
