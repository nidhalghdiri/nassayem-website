// ─────────────────────────────────────────────────────────────────────────────
// Web chat widget endpoint.
//   GET  → widget bootstrap: enabled flag + greeting (no auth, cached config)
//   POST → run one chatbot turn, streaming ND-JSON lines:
//            {"type":"delta","text":"..."} ... {"type":"done","escalated":bool}
// Public endpoint: no session auth (customers are anonymous); abuse is
// contained by per-session rate limiting inside runChatbotTurn.
// Note: middleware.ts skips /api/* entirely, so nothing else runs here.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runChatbotTurn } from "@/lib/chatbot/agent";
import { getChatbotSettings } from "@/lib/chatbot/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // tool loop + streaming can take a while

export async function GET() {
  const settings = await getChatbotSettings();
  return NextResponse.json({
    enabled: settings.enabled,
    greeting_en: settings.greeting_en,
    greeting_ar: settings.greeting_ar,
  });
}

const BodySchema = z.object({
  sessionId: z.string().min(8).max(64),
  message: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const settings = await getChatbotSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Chatbot is disabled" }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const result = await runChatbotTurn({
          channel: "WEB",
          externalId: body.sessionId,
          message: body.message,
          onTextDelta: (text) => send({ type: "delta", text }),
        });
        send({ type: "done", escalated: result.escalated });
      } catch (err) {
        // runChatbotTurn handles its own failures; this is a last resort.
        console.error("[chatbot/web] stream failed:", err);
        send({ type: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
