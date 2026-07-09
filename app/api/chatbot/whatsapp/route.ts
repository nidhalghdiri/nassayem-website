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

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { runChatbotTurn } from "@/lib/chatbot/agent";
import { getChatbotSettings } from "@/lib/chatbot/config";
import {
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppLocation,
  markWhatsAppMessageRead,
} from "@/lib/whatsapp";
import { mirrorWhatsAppMedia } from "@/lib/chatbot/whatsappMedia";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_GALLERY_IMAGES = 3;

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
    case "image":
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
  const text = extractText(msg);
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
    const mirrored = await mirrorWhatsAppMedia(mediaRef.ref.id!, msg.from);
    if (mirrored) media = { url: mirrored.url, type: mediaRef.type };
  }

  const result = await runChatbotTurn({
    channel: "WHATSAPP",
    externalId: msg.from,
    message: text,
    customerName: profileName,
    externalMessageId: msg.id,
    media,
  });

  // "Stop AI" is on for this conversation: message stored, nothing sent.
  // Deliberately no read-receipt either — a human is handling the chat.
  if (result.aiPaused) return;

  markWhatsAppMessageRead(msg.id, senderPhoneNumberId).catch(() => {});

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

  const settings = await getChatbotSettings();

  try {
    const body = JSON.parse(rawBody) as {
      entry?: { changes?: { field?: string; value?: WaValue }[] }[];
    };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};
        // Delivery/read receipts arrive on the same field — nothing to do.
        if (!value.messages?.length) continue;
        if (!settings.enabled) continue; // bot disabled from admin config

        for (const msg of value.messages) {
          try {
            await handleInboundMessage(msg, value);
          } catch (err) {
            // Per-message isolation: one bad message must not fail the batch
            // (a non-2xx would make Meta redeliver everything).
            console.error("[chatbot/whatsapp] message handling failed:", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("[chatbot/whatsapp] webhook parse failed:", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
