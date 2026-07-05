// ─────────────────────────────────────────────────────────────────────────────
// Role-based permission logic for the Chatbot admin module.
// Safe to import in both Server and Client Components (no Prisma runtime).
// Mirrors lib/laundry/permissions.ts.
// ─────────────────────────────────────────────────────────────────────────────

import type { TStaffRole } from "@/lib/tasks/constants";

/** Can this role open /admin/chatbot (conversations, leads, analytics, playground)? */
export function canViewChatbot(role: TStaffRole): boolean {
  return role === "MANAGER" || role === "SUPERVISOR";
}

/** Can this role edit the bot's configuration (system prompt, rules, toggles)? Managers only. */
export function canManageChatbotConfig(role: TStaffRole): boolean {
  return role === "MANAGER";
}
