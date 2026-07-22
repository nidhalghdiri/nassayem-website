// ─────────────────────────────────────────────────────────────────────────────
// Admin playground endpoint — same agent core and LIVE config as customers
// get, but gated behind admin auth. Each admin gets one persistent playground
// conversation (externalId "playground-<adminUserId>"), excluded from
// analytics and the conversations list.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { canViewChatbot } from "@/lib/chatbot/permissions";
import { runChatbotTurn } from "@/lib/chatbot/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BodySchema = z.object({ message: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  const adminUser = await getCurrentAdminUser();
  if (!adminUser || !canViewChatbot(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await runChatbotTurn({
          channel: "WEB",
          externalId: `playground-${adminUser.id}`,
          message: body.message,
          onTextDelta: (text) => send({ type: "delta", text }),
        });

        if (result.language === "ar") {
          const { generateAudioFromText } = await import("@/lib/elevenlabs");
          const audioBuffer = await generateAudioFromText(result.text);
          if (audioBuffer) {
            send({ type: "audio", base64: audioBuffer.toString("base64") });
          }
        }

        send({ type: "done", escalated: result.escalated });
      } catch (err) {
        console.error("[chatbot/playground] failed:", err);
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
