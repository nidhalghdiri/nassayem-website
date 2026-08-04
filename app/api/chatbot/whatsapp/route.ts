// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API webhook — the WhatsApp transport for the shared chatbot
// agent core (same brain as the web widget; only the transport differs).
//
//   GET  → Meta webhook verification handshake (hub.challenge echo).
//   POST → inbound messages: signature check → dedupe (wamid) → runChatbotTurn
//          → free-form text reply + native media follow-ups (unit gallery
//          images after get_unit_details, a location pin after a single-
//          building get_building_info).
//
// Env: WHATSAPP_VERIFY_TOKEN (handshake), WHATSAPP_APP_SECRET (signatures),
//      plus the existing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID.
// Meta retries deliveries that don't get a fast 2xx — we therefore ALWAYS
// return 200 after basic validation and rely on wamid dedupe for replays.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse, after } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { runChatbotTurnDebounced } from "@/lib/chatbot/agent";
import { getChatbotSettings } from "@/lib/chatbot/config";
import {
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppLocation,
  markWhatsAppMessageRead,
} from "@/lib/whatsapp";
import { mirrorWhatsAppMedia, downloadWhatsAppMediaToBuffer } from "@/lib/chatbot/whatsappMedia";
import { transcribeAudio } from "@/lib/chatbot/transcribe";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_GALLERY_IMAGES = 3;

// Debounce window: customers often split one thought across several quick
// messages. We wait this long after each message and only reply to the LAST one
// in a burst, so the bot answers the whole intent once instead of per fragment.
// Tunable via env (ms). Runs in an after() background task, acked to Meta first.
const DEBOUNCE_MS = Number(process.env.CHATBOT_WHATSAPP_DEBOUNCE_MS) || 8000;

// ── GET: verification handshake ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// ── POST: inbound messages ────────────────────────────────────────────────────

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // Not configured yet — allow (useful during first setup) but warn loudly.
    console.warn("[chatbot/whatsapp] WHATSAPP_APP_SECRET not set — skipping signature verification.");
    return true;
  }
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.slice("sha256=".length);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

// Minimal shapes for the webhook payload pieces we consume.
type WaMediaRef = { id?: string; caption?: string; mime_type?: string };
type WaMessage = {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
  location?: { latitude?: number; longitude?: number };
  image?: WaMediaRef;
  video?: WaMediaRef;
  audio?: WaMediaRef;
  document?: WaMediaRef & { filename?: string };
  sticker?: WaMediaRef;
};

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"] as const;
type WaMediaType = (typeof MEDIA_TYPES)[number];

function mediaRefOf(msg: WaMessage): { type: WaMediaType; ref: WaMediaRef } | null {
  for (const type of MEDIA_TYPES) {
    const ref = msg[type];
    if (msg.type === type && ref?.id) return { type, ref };
  }
  return null;
}
type WaValue = {
  metadata?: { phone_number_id?: string };
  messages?: WaMessage[];
  contacts?: { wa_id?: string; profile?: { name?: string } }[];
  statuses?: unknown[];
};

/** Turn any supported inbound message type into text for the agent. */
function extractText(msg: WaMessage): string | null {
  switch (msg.type) {
    case "text":
      return msg.text?.body?.trim() || null;
    case "button":
      return msg.button?.text?.trim() || null;
    case "interactive":
      return (
        msg.interactive?.button_reply?.title?.trim() ||
        msg.interactive?.list_reply?.title?.trim() ||
        null
      );
    case "location":
      return msg.location
        ? `[The customer shared their location pin: ${msg.location.latitude}, ${msg.location.longitude}]`
        : null;
    case "image": {
      // The model CAN see images — they're attached to the turn as vision input.
      const caption = mediaRefOf(msg)?.ref.caption;
      return caption
        ? `[The customer sent an image with this caption]: ${caption}`
        : `[The customer sent an image.]`;
    }
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const caption = mediaRefOf(msg)?.ref.caption;
      return caption
        ? `[The customer sent a ${msg.type} with this caption]: ${caption}`
        : `[The customer sent a ${msg.type}. You cannot view it, but it is saved for the team. If it seems to need a human's eyes (document, payment proof…), offer to have a colleague look at it.]`;
    }
    default:
      return null; // reactions, system events, etc. — ignore
  }
}

// Narrow views over tool results for media follow-ups.
type UnitDetailsResult = {
  title_en?: string;
  title_ar?: string;
  gallery_urls?: string[];
};
type BuildingInfoResult = {
  buildings?: {
    name_en?: string;
    name_ar?: string;
    location_en?: string;
    location_ar?: string;
    latitude?: number | null;
    longitude?: number | null;
  }[];
};

/**
 * Native follow-ups after the text reply: gallery photos + location pin.
 * Every successfully sent item is ALSO persisted as an ASSISTANT message so
 * the admin transcript shows exactly what the customer received.
 */
async function sendMediaFollowUps(
  to: string,
  language: string,
  toolCalls: { name: string; result: unknown }[],
  conversationId: string,
  senderPhoneNumberId?: string,
): Promise<void> {
  const isAr = language === "ar";
  let imagesSent = 0;
  let locationSent = false;

  const persistSent = async (
    content: string,
    mediaUrl: string,
    mediaType: string,
  ) => {
    await prisma.chatbotMessage
      .create({
        data: { conversationId, role: "ASSISTANT", content, mediaUrl, mediaType },
      })
      .catch((err) => console.error("[chatbot] persist sent media failed:", err));
  };

  for (const call of toolCalls) {
    if (call.name === "get_unit_details" && imagesSent < MAX_GALLERY_IMAGES) {
      const r = call.result as UnitDetailsResult;
      const urls = (r.gallery_urls ?? []).slice(0, MAX_GALLERY_IMAGES - imagesSent);
      for (let i = 0; i < urls.length; i++) {
        const caption =
          i === 0 ? (isAr ? r.title_ar : r.title_en) ?? undefined : undefined;
        const sent = await sendWhatsAppImage(to, urls[i], caption, senderPhoneNumberId);
        imagesSent++;
        if (sent.ok) await persistSent(caption ?? "📷", urls[i], "image");
      }
    }

    if (call.name === "get_building_info" && !locationSent) {
      const r = call.result as BuildingInfoResult;
      // Only when the customer asked about ONE specific building — sending
      // pins for a full building list would be spam.
      if (r.buildings?.length === 1) {
        const b = r.buildings[0];
        if (b.latitude != null && b.longitude != null) {
          const name = (isAr ? b.name_ar : b.name_en) ?? "";
          const sent = await sendWhatsAppLocation(
            to,
            b.latitude,
            b.longitude,
            name,
            isAr ? b.location_ar : b.location_en,
            senderPhoneNumberId,
          );
          locationSent = true;
          if (sent.ok) {
            await persistSent(
              `📍 ${name}`,
              `https://maps.google.com/?q=${b.latitude},${b.longitude}`,
              "location",
            );
          }
        }
      }
    }
  }
}

async function handleInboundMessage(msg: WaMessage, value: WaValue): Promise<void> {
  let text = extractText(msg);
  if (!text || !msg.from) return;

  // Reply from the exact number the customer wrote to — the 24h service
  // window is per receiving number. Falls back to the env var inside senders.
  const senderPhoneNumberId = value.metadata?.phone_number_id;

  // Dedupe Meta webhook retries by wamid.
  const seen = await prisma.chatbotMessage.findUnique({
    where: { waMessageId: msg.id },
    select: { id: true },
  });
  if (seen) return;

  const profileName = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name;

  // Mirror inbound media into our storage so the admin transcript can show it.
  let media: { url: string; type: string } | undefined;
  const mediaRef = mediaRefOf(msg);
  if (mediaRef) {
    if (mediaRef.type === "audio") {
      const downloaded = await downloadWhatsAppMediaToBuffer(mediaRef.ref.id!);
      if (downloaded) {
        const transcript = await transcribeAudio(downloaded.buffer, downloaded.mimeType);
        if (transcript) {
          text = `[Voice Note]: ${transcript}`;
        }
      }
    }
    const mirrored = await mirrorWhatsAppMedia(mediaRef.ref.id!, msg.from);
    if (mirrored) media = { url: mirrored.url, type: mediaRef.type };
  }

  // --- ESCALATION FOLLOW-UP INTERCEPTION ---
  const existingConv = await prisma.chatbotConversation.findUnique({
    where: { channel_externalId: { channel: "WHATSAPP", externalId: msg.from } },
    select: { id: true, followUpStatus: true, language: true },
  });

  if (existingConv && existingConv.followUpStatus === "ASKED") {
    const isAr = existingConv.language === "ar";
    const lowerText = text.toLowerCase();
    
    // Naive matching for yes/no
    const isYes = /(yes|نعم|contacted|did|ok|تم|اتصل|ايوا|yep|yeah)/i.test(lowerText);
    const isNo = /(no|not|لا|لم|ما|wait|haven't|nope|didn't)/i.test(lowerText);

    let newStatus = "ASKED";
    let replyMessage = "";

    if (isYes && !isNo) {
      newStatus = "CONTACTED";
      replyMessage = isAr ? "شكراً لإعلامنا! نتمنى لك يوماً سعيداً." : "Thank you for letting us know! Have a great day.";
    } else if (isNo && !isYes) {
      newStatus = "NOT_CONTACTED";
      replyMessage = isAr ? "نعتذر عن التأخير. سنقوم بتذكير الفريق فوراً ليتواصلوا معك." : "We apologize for the delay. We will remind the team immediately to contact you.";
    }

    if (newStatus !== "ASKED") {
      // 1. Store the user's message
      await prisma.chatbotMessage.create({
        data: {
          conversationId: existingConv.id,
          role: "USER",
          content: text,
          waMessageId: msg.id,
          mediaUrl: media?.url,
          mediaType: media?.type,
        },
      });

      // 2. Update status
      await prisma.chatbotConversation.update({
        where: { id: existingConv.id },
        data: { followUpStatus: newStatus },
      });

      // 3. Send reply and store it
      const delivery = await sendWhatsAppText(msg.from, replyMessage, senderPhoneNumberId);
      if (delivery.ok) {
        await prisma.chatbotMessage.create({
          data: { conversationId: existingConv.id, role: "ASSISTANT", content: replyMessage },
        });
      }

      markWhatsAppMessageRead(msg.id, senderPhoneNumberId).catch(() => {});
      return; // Stop processing, bypass AI
    }
  }
  // --- END ESCALATION FOLLOW-UP INTERCEPTION ---

  const result = await runChatbotTurnDebounced(
    {
      channel: "WHATSAPP",
      externalId: msg.from,
      message: text,
      customerName: profileName,
      externalMessageId: msg.id,
      media,
    },
    DEBOUNCE_MS,
  );

  // "Stop AI" is on for this conversation: message stored, nothing sent.
  // Deliberately no read-receipt either — a human is handling the chat.
  if (result.aiPaused) return;

  markWhatsAppMessageRead(msg.id, senderPhoneNumberId).catch(() => {});

  // This message was coalesced into a later one in the same burst — a sibling
  // invocation sends the single combined reply. Mark read (above) but send nothing.
  if (result.superseded) return;

  const delivery = await sendWhatsAppText(msg.from, result.text, senderPhoneNumberId);
  if (!delivery.ok) {
    // Surface the exact Meta error in the admin transcript (violet tool chip)
    // so delivery problems are diagnosable without server-log access.
    await prisma.chatbotMessage
      .create({
        data: {
          conversationId: result.conversationId,
          role: "TOOL",
          content: "whatsapp_delivery → error",
          toolName: "whatsapp_delivery",
          toolPayload: JSON.parse(
            JSON.stringify({
              input: { to: msg.from, sender_phone_number_id: senderPhoneNumberId ?? null },
              result: { error: delivery.error },
            }),
          ),
        },
      })
      .catch(() => {});
    return; // reply never reached the customer — skip media follow-ups
  }

  await sendMediaFollowUps(
    msg.from,
    result.language,
    result.toolCalls,
    result.conversationId,
    senderPhoneNumberId,
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Acknowledge Meta immediately, then do the work (including the debounce wait)
  // in a background task — a slow 2xx makes Meta redeliver the whole batch, and
  // the per-message wamid dedupe keeps any redelivery harmless.
  after(async () => {
    try {
      const settings = await getChatbotSettings();
      if (!settings.enabled) return; // bot disabled from admin config

      const body = JSON.parse(rawBody) as {
        entry?: { changes?: { field?: string; value?: WaValue }[] }[];
      };

      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== "messages") continue;
          const value = change.value ?? {};
          // Delivery/read receipts arrive on the same field — nothing to do.
          if (!value.messages?.length) continue;

          // Process a payload's messages CONCURRENTLY so their debounce windows
          // overlap and the latest-message-wins check can coalesce them into a
          // single reply (sequential awaits would each think they were the last).
          // Per-message isolation: one bad message must not fail the batch.
          await Promise.all(
            value.messages.map((msg) =>
              handleInboundMessage(msg, value).catch((err) =>
                console.error("[chatbot/whatsapp] message handling failed:", err),
              ),
            ),
          );
        }
      }
    } catch (err) {
      console.error("[chatbot/whatsapp] webhook processing failed:", err);
    }
  });

  return NextResponse.json({ received: true }, { status: 200 });
}
