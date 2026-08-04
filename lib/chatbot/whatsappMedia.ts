// ─────────────────────────────────────────────────────────────────────────────
// Inbound WhatsApp media mirroring. Meta's media URLs are short-lived and
// require the access token, so we download the binary once and store it so the
// admin transcript can show it and the vision model can read it.
//
// Customer-sent media can be sensitive (ID/passport), so it goes in a PRIVATE
// bucket — NOT the public site bucket — and the row keeps a `private:<path>`
// marker (see lib/chatbot/media.ts) instead of a public URL.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase";
import {
  PRIVATE_MEDIA_BUCKET,
  ensurePrivateBucket,
  toPrivateMediaRef,
} from "./media";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB safety cap

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
};

export async function downloadWhatsAppMediaToBuffer(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !mediaId) return null;

  try {
    // 1. Resolve the short-lived download URL
    const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error("[chatbot] media meta failed:", metaRes.status);
      return null;
    }
    const meta = (await metaRes.json()) as {
      url?: string;
      mime_type?: string;
      file_size?: number;
    };
    if (!meta.url) return null;
    if (meta.file_size && meta.file_size > MAX_MEDIA_BYTES) {
      console.warn("[chatbot] media too large, skipping mirror:", meta.file_size);
      return null;
    }

    // 2. Download the binary (also requires the token)
    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!binRes.ok) {
      console.error("[chatbot] media download failed:", binRes.status);
      return null;
    }
    const buffer = Buffer.from(await binRes.arrayBuffer());
    if (buffer.byteLength > MAX_MEDIA_BYTES) return null;

    const mimeType = meta.mime_type || "application/octet-stream";
    return { buffer, mimeType };
  } catch (err) {
    console.error("[chatbot] media fetch failed:", err);
    return null;
  }
}

export async function mirrorWhatsAppMedia(
  mediaId: string,
  folderKey: string, // customer phone — groups a customer's media in storage
): Promise<{ url: string; mimeType: string } | null> {
  const downloaded = await downloadWhatsAppMediaToBuffer(mediaId);
  if (!downloaded) return null;

  try {
    const { buffer, mimeType } = downloaded;
    
    // 3. Store in the PRIVATE bucket (customer media may be an ID/passport).
    const ext = EXT_BY_MIME[mimeType] || mimeType.split("/")[1] || "bin";
    const path = `${folderKey}/${Date.now()}-${mediaId.slice(-8)}.${ext}`;

    await ensurePrivateBucket();
    const { error } = await supabaseAdmin.storage
      .from(PRIVATE_MEDIA_BUCKET)
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (error) {
      console.error("[chatbot] media upload failed:", error.message);
      return null;
    }

    // No public URL — the row keeps a private marker; a signed URL is minted
    // on demand for the admin transcript.
    return { url: toPrivateMediaRef(path), mimeType };
  } catch (err) {
    console.error("[chatbot] media mirror failed:", err);
    return null;
  }
}
