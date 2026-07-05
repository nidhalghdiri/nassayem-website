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

export async function runModelTurn(
  params: ModelTurnParams,
): Promise<ModelTurnResult> {
  const client = getAnthropicClient();

  const request: Anthropic.MessageCreateParamsNonStreaming = {
    model: getChatModel(),
    max_tokens: params.maxTokens ?? 2048,
    // Adaptive thinking: the model decides when reasoning is worth the
    // latency — simple greetings stay fast, multi-tool queries get depth.
    thinking: { type: "adaptive" },
    system: params.system,
    messages: params.messages,
    ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
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
