// ─────────────────────────────────────────────────────────────────────────────
// Private storage for INBOUND customer media (WhatsApp).
//
// Unlike the bot's own outbound photos (public property images), a photo the
// CUSTOMER sends can be sensitive — an ID card or passport. Those never go in a
// public bucket. Instead they live in a PRIVATE Supabase bucket and are:
//   • sent to the vision model as base64 bytes (never a URL), and
//   • shown in the admin transcript via a short-lived signed URL.
//
// A ChatbotMessage.mediaUrl of the form `private:<objectPath>` marks such an
// object. Public URLs (outbound bot / staff media) pass through untouched, so
// the same helpers are safe to call on any mediaUrl.
//
// Setup: create a PRIVATE Supabase Storage bucket named by CHATBOT_PRIVATE_BUCKET
// (default "chatbot-private"). ensurePrivateBucket() also creates it on first use.
// Server-only: uses the Supabase service-role client.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase";

export const PRIVATE_MEDIA_BUCKET =
  process.env.CHATBOT_PRIVATE_BUCKET?.trim() || "chatbot-private";

const PRIVATE_PREFIX = "private:";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — enough to view in the admin UI
const MAX_VISION_BYTES = 5 * 1024 * 1024; // don't base64 a huge file into a request

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED_IMAGE_TYPES: ReadonlySet<string> = new Set<ImageMediaType>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** Wrap a storage object path as the `private:<path>` marker stored on the row. */
export function toPrivateMediaRef(objectPath: string): string {
  return `${PRIVATE_PREFIX}${objectPath}`;
}

export function isPrivateMedia(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith(PRIVATE_PREFIX);
}

function privateMediaPath(url: string): string {
  return url.slice(PRIVATE_PREFIX.length);
}

let ensured: Promise<void> | null = null;
/** Create the private bucket if it doesn't exist yet (idempotent, best-effort). */
export function ensurePrivateBucket(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const { error } = await supabaseAdmin.storage.createBucket(
        PRIVATE_MEDIA_BUCKET,
        { public: false },
      );
      // "already exists" is the normal case; log anything else but never throw —
      // a bucket problem must not break message handling.
      if (error && !/exist/i.test(error.message)) {
        console.error("[chatbot] ensure private bucket failed:", error.message);
      }
    })();
  }
  return ensured;
}

/**
 * Resolve a stored mediaUrl for display to a client. Private objects become a
 * short-lived signed URL; public URLs (and null) pass through unchanged. Use in
 * every server path that sends mediaUrl to the admin transcript.
 */
export async function resolveMediaUrlForDisplay(
  url: string | null | undefined,
): Promise<string | null> {
  if (!isPrivateMedia(url)) return url ?? null;
  const { data, error } = await supabaseAdmin.storage
    .from(PRIVATE_MEDIA_BUCKET)
    .createSignedUrl(privateMediaPath(url), SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("[chatbot] sign media failed:", error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * Download a private IMAGE as base64 for the vision model. Returns null for
 * non-private refs, non-image content, oversized files, or download failures —
 * the caller simply skips attaching it.
 */
export async function downloadPrivateImageBase64(
  url: string,
): Promise<{ base64: string; mediaType: ImageMediaType } | null> {
  if (!isPrivateMedia(url)) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(PRIVATE_MEDIA_BUCKET)
    .download(privateMediaPath(url));
  if (error || !data) {
    console.error("[chatbot] download media failed:", error?.message);
    return null;
  }
  const type = (data.type || "").toLowerCase();
  const mediaType: ImageMediaType = SUPPORTED_IMAGE_TYPES.has(type)
    ? (type as ImageMediaType)
    : "image/jpeg"; // WhatsApp photos are JPEG; default when the blob type is blank
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.byteLength > MAX_VISION_BYTES) {
    console.warn("[chatbot] image too large for vision, skipping:", buffer.byteLength);
    return null;
  }
  return { base64: buffer.toString("base64"), mediaType };
}
