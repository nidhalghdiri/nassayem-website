// ─────────────────────────────────────────────────────────────────────────────
// Thin abstraction over the Anthropic Messages API. All model access in the
// chatbot goes through runModelTurn() so the model id, thinking config and
// client wiring live in exactly one place. Swap models via the AI_MODEL env
// var — no redeploy of calling code needed.
// Server-only: uses ANTHROPIC_API_KEY.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_CHAT_MODEL = "claude-opus-4-8";

export function getChatModel(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

// Singleton across hot reloads, mirroring lib/prisma.ts
const globalForAI = globalThis as unknown as { anthropicClient?: Anthropic };

export function getAnthropicClient(): Anthropic {
  if (!globalForAI.anthropicClient) {
    globalForAI.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return globalForAI.anthropicClient;
}

export type ModelTurnParams = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
  /** When provided, the request streams and text deltas are forwarded live. */
  onTextDelta?: (text: string) => void;
};

export type ModelTurnResult = {
  content: Anthropic.ContentBlock[];
  stopReason: Anthropic.Message["stop_reason"];
  usage: { inputTokens: number; outputTokens: number };
};

function toResult(message: Anthropic.Message): ModelTurnResult {
  return {
    content: message.content,
    stopReason: message.stop_reason,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
}

/** Adaptive thinking is an Opus 4.7+/Fable capability; other models reject it. */
function supportsAdaptiveThinking(model: string): boolean {
  return /opus-4-[789]|opus-5|fable|mythos/.test(model);
}

export async function runModelTurn(
  params: ModelTurnParams,
): Promise<ModelTurnResult> {
  const client = getAnthropicClient();
  const model = getChatModel();

  // Prompt caching: the system prompt and tool definitions are identical for
  // every conversation and every tool-loop iteration — cached reads bill at
  // 10% of the input price. The last message is also marked so iterations
  // within one tool loop (seconds apart) reuse the whole request prefix.
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: params.system,
      cache_control: { type: "ephemeral" },
    },
  ];

  const tools =
    params.tools && params.tools.length > 0
      ? params.tools.map((tool, i) =>
          i === params.tools!.length - 1
            ? { ...tool, cache_control: { type: "ephemeral" as const } }
            : tool,
        )
      : undefined;

  const messages = params.messages.map((message, i) => {
    if (i !== params.messages.length - 1) return message;
    const blocks: Anthropic.ContentBlockParam[] =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : [...message.content];
    if (blocks.length > 0) {
      const last = blocks[blocks.length - 1];
      if (last.type === "text" || last.type === "tool_result") {
        blocks[blocks.length - 1] = {
          ...last,
          cache_control: { type: "ephemeral" },
        } as Anthropic.ContentBlockParam;
      }
    }
    return { ...message, content: blocks };
  });

  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: params.maxTokens ?? 2048,
    // Adaptive thinking on models that support it (Opus decides when
    // reasoning is worth the latency). Cheaper models run without thinking —
    // faster replies and no reasoning tokens billed as output.
    ...(supportsAdaptiveThinking(model) ? { thinking: { type: "adaptive" } } : {}),
    system,
    messages,
    ...(tools ? { tools } : {}),
  };

  if (params.onTextDelta) {
    const stream = client.messages.stream(request);
    stream.on("text", (delta) => params.onTextDelta!(delta));
    const message = await stream.finalMessage();
    return toResult(message);
  }

  const message = await client.messages.create(request);
  return toResult(message);
}
