"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import {
  canManageChatbotConfig,
  canViewChatbot,
} from "@/lib/chatbot/permissions";
import { saveChatbotConfigKey } from "@/lib/chatbot/config";
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
