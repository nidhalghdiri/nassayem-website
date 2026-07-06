"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import {
  canManageChatbotConfig,
  canViewChatbot,
} from "@/lib/chatbot/permissions";
import { saveChatbotConfigKey } from "@/lib/chatbot/config";
import { supabaseAdmin } from "@/lib/supabase";
import {
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppLocation,
  sendWhatsAppContact,
} from "@/lib/whatsapp";
import type { ChatConversationStatus, ChatLeadStatus } from "@prisma/client";

// ── Config ────────────────────────────────────────────────────────────────────

export async function saveChatbotSettings(formData: FormData) {
  const user = await getCurrentAdminUser();
  if (!user || !canManageChatbotConfig(user.role)) {
    throw new Error("Forbidden: manager role required");
  }

  const text = (name: string) => String(formData.get(name) ?? "").trim();

  await saveChatbotConfigKey("enabled", formData.get("enabled") === "on");
  await saveChatbotConfigKey("show_prices", formData.get("show_prices") === "on");
  await saveChatbotConfigKey("system_prompt", text("system_prompt"));
  await saveChatbotConfigKey("tone", text("tone"));
  await saveChatbotConfigKey("business_rules", text("business_rules"));
  await saveChatbotConfigKey("escalation_triggers", text("escalation_triggers"));
  await saveChatbotConfigKey("canned_replies", text("canned_replies"));
  await saveChatbotConfigKey("contact_numbers", {
    call_center: text("call_center"),
    whatsapp: text("whatsapp").replace(/[^\d]/g, ""),
  });
  await saveChatbotConfigKey("escalation_email", text("escalation_email"));
  await saveChatbotConfigKey("greeting_en", text("greeting_en"));
  await saveChatbotConfigKey("greeting_ar", text("greeting_ar"));

  revalidatePath("/", "layout");
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function setConversationStatus(
  conversationId: string,
  status: ChatConversationStatus,
) {
  const user = await getCurrentAdminUser();
  if (!user || !canViewChatbot(user.role)) throw new Error("Forbidden");

  await prisma.chatbotConversation.update({
    where: { id: conversationId },
    data: {
      status,
      ...(status !== "ESCALATED" ? { escalationReason: null } : {}),
    },
  });
  revalidatePath("/", "layout");
}

/**
 * "Stop AI" switch. While paused, customer messages are still stored (the
 * team reads them in the transcript) but the model is never called and no
 * reply is sent — zero token spend during a human takeover.
 */
export async function setConversationAiPaused(
  conversationId: string,
  aiPaused: boolean,
) {
  const user = await getCurrentAdminUser();
  if (!user || !canViewChatbot(user.role)) throw new Error("Forbidden");

  await prisma.chatbotConversation.update({
    where: { id: conversationId },
    data: { aiPaused },
  });
  revalidatePath("/", "layout");
}

/** Permanently delete a conversation (transcript, tool traces, leads, holds). */
export async function deleteChatbotConversation(conversationId: string) {
  const user = await getCurrentAdminUser();
  if (!user || user.role !== "MANAGER") {
    throw new Error("Forbidden: manager role required");
  }
  await prisma.chatbotConversation.delete({ where: { id: conversationId } });
  revalidatePath("/", "layout");
}

// ── Human handoff: staff messages from the admin panel ───────────────────────

export type StaffMessageResult =
  | {
      ok: true;
      message: {
        id: string;
        role: "STAFF";
        content: string;
        mediaUrl: string | null;
        mediaType: string | null;
        createdAt: string;
      };
    }
  | { ok: false; error: string };

/**
 * Send a message to the customer as a human agent. Kinds (FormData "kind"):
 *   text     → "text"
 *   photo    → "photo" file (uploaded to storage, sent as WhatsApp image)
 *   location → "latitude"/"longitude" (+ optional "label")
 *   contact  → "contactName"/"contactPhone"
 * Sending automatically switches the conversation to Stop AI so the bot and
 * the human never talk over each other. WhatsApp conversations deliver via
 * the Cloud API (24h window — open as long as the customer wrote recently);
 * web conversations are picked up by the widget's polling.
 */
export async function sendStaffMessage(
  conversationId: string,
  formData: FormData,
): Promise<StaffMessageResult> {
  const user = await getCurrentAdminUser();
  if (!user || !canViewChatbot(user.role)) throw new Error("Forbidden");

  const conversation = await prisma.chatbotConversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) return { ok: false, error: "Conversation not found" };

  const kind = String(formData.get("kind") ?? "text");
  const isWhatsApp = conversation.channel === "WHATSAPP";
  const to = conversation.externalId;

  let content = "";
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  let delivery: { ok: boolean; error?: unknown } = { ok: true };

  if (kind === "text") {
    content = String(formData.get("text") ?? "").trim();
    if (!content) return { ok: false, error: "Empty message" };
    if (isWhatsApp) delivery = await sendWhatsAppText(to, content);
  } else if (kind === "photo") {
    const file = formData.get("photo") as File | null;
    if (!file || file.size === 0) return { ok: false, error: "No photo selected" };
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Photo too large (max 10 MB)" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "jpg";
    const path = `chatbot/${conversation.externalId}/staff-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("properties")
      .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: false });
    if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` };
    mediaUrl = supabaseAdmin.storage.from("properties").getPublicUrl(path).data.publicUrl;
    mediaType = "image";
    content = String(formData.get("text") ?? "").trim() || "📷 Photo";
    if (isWhatsApp) {
      delivery = await sendWhatsAppImage(
        to,
        mediaUrl,
        content !== "📷 Photo" ? content : undefined,
      );
    }
  } else if (kind === "location") {
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));
    if (!isFinite(latitude) || !isFinite(longitude)) {
      return { ok: false, error: "Invalid coordinates" };
    }
    const label = String(formData.get("label") ?? "").trim() || "Nassayem Salalah";
    content = `📍 ${label}`;
    mediaUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    mediaType = "location";
    if (isWhatsApp) {
      delivery = await sendWhatsAppLocation(to, latitude, longitude, label);
    }
  } else if (kind === "contact") {
    const contactName = String(formData.get("contactName") ?? "").trim();
    const contactPhone = String(formData.get("contactPhone") ?? "").trim();
    if (!contactName || !contactPhone) {
      return { ok: false, error: "Contact name and phone are required" };
    }
    content = `👤 ${contactName} · ${contactPhone}`;
    mediaType = "contact";
    if (isWhatsApp) {
      delivery = await sendWhatsAppContact(to, contactName, contactPhone);
    }
  } else {
    return { ok: false, error: `Unknown kind: ${kind}` };
  }

  if (!delivery.ok) {
    return {
      ok: false,
      error: `WhatsApp delivery failed: ${JSON.stringify(delivery.error).slice(0, 300)}`,
    };
  }

  // Auto-pause the AI: a human has taken over this conversation.
  const [message] = await prisma.$transaction([
    prisma.chatbotMessage.create({
      data: {
        conversationId,
        role: "STAFF",
        content,
        mediaUrl,
        mediaType,
        toolPayload: { sentBy: user.email },
      },
    }),
    prisma.chatbotConversation.update({
      where: { id: conversationId },
      data: { aiPaused: true, lastMessageAt: new Date() },
    }),
  ]);

  return {
    ok: true,
    message: {
      id: message.id,
      role: "STAFF",
      content: message.content,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      createdAt: message.createdAt.toISOString(),
    },
  };
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function updateLeadStatus(leadId: string, status: ChatLeadStatus) {
  const user = await getCurrentAdminUser();
  if (!user || !canViewChatbot(user.role)) throw new Error("Forbidden");

  await prisma.chatbotLead.update({ where: { id: leadId }, data: { status } });
  revalidatePath("/", "layout");
}

// ── Playground ────────────────────────────────────────────────────────────────

/** Wipe the calling admin's playground conversation so tests start fresh. */
export async function resetPlaygroundConversation() {
  const user = await getCurrentAdminUser();
  if (!user || !canViewChatbot(user.role)) throw new Error("Forbidden");

  await prisma.chatbotConversation.deleteMany({
    where: { channel: "WEB", externalId: `playground-${user.id}` },
  });
}
