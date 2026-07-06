// ─────────────────────────────────────────────────────────────────────────────
// Inbound WhatsApp media mirroring. Meta's media URLs are short-lived and
// require the access token, so to SHOW customer photos/voice notes in the
// admin transcript we download the binary once and store it in the public
// Supabase bucket (same bucket the site already serves images from), then
// keep that permanent URL on the ChatbotMessage row.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase";

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

export async function mirrorWhatsAppMedia(
  mediaId: string,
  folderKey: string, // customer phone — groups a customer's media in storage
): Promise<{ url: string; mimeType: string } | null> {
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

    // 3. Store in the public bucket
    const mimeType = meta.mime_type || "application/octet-stream";
    const ext = EXT_BY_MIME[mimeType] || mimeType.split("/")[1] || "bin";
    const path = `chatbot/${folderKey}/${Date.now()}-${mediaId.slice(-8)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from("properties")
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (error) {
      console.error("[chatbot] media upload failed:", error.message);
      return null;
    }
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from("properties").getPublicUrl(path);

    return { url: publicUrl, mimeType };
  } catch (err) {
    console.error("[chatbot] media mirror failed:", err);
    return null;
  }
}
