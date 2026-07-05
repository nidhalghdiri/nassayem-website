// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API — template messaging service
//
// Env vars required (add to .env):
//   WHATSAPP_ACCESS_TOKEN      — permanent or long-lived token from Meta Business
//   WHATSAPP_PHONE_NUMBER_ID   — the phone number ID from WhatsApp Cloud API
//   NEXT_PUBLIC_APP_URL        — e.g. https://admin.nassayem.com  (no trailing slash)
//
// ── Templates to register in Meta Business Manager ────────────────────────────
//
//   nassayem_task_assigned  (EN)
//   Body params: {{1}} name, {{2}} title, {{3}} building, {{4}} unit,
//                {{5}} dueDate, {{6}} priority
//   Button (URL, index 0):
//     Text: "View Task"
//     URL:  https://yoursite.com/en/admin/tasks?taskId={{1}}
//
//   nassayem_task_assigned_ar  (AR)
//   Body params: same order
//   Button (URL, index 0):
//     Text: "عرض المهمة"
//     URL:  https://yoursite.com/ar/admin/tasks?taskId={{1}}
//
//   nassayem_task_completed  (EN)
//   Body params: {{1}} name, {{2}} title, {{3}} building,
//                {{4}} completedBy, {{5}} date
//   Button (URL, index 0):
//     Text: "View Task"
//     URL:  https://yoursite.com/en/admin/tasks?taskId={{1}}
//
//   nassayem_task_completed_ar  (AR)
//   Body params: same order
//   Button (URL, index 0):
//     Text: "عرض المهمة"
//     URL:  https://yoursite.com/ar/admin/tasks?taskId={{1}}
//
// ── Example template bodies ───────────────────────────────────────────────────
//
//   nassayem_task_assigned (EN):
//     Hello {{1}} 👋
//     You have been assigned a new task:
//     📋 {{2}}
//     🏢 Building: {{3}}
//     🏠 Unit: {{4}}
//     📅 Due: {{5}}
//     ⚡ Priority: {{6}}
//     Tap the button below to open the task.
//
//   nassayem_task_assigned_ar (AR):
//     مرحباً {{1}} 👋
//     تم تعيين مهمة جديدة لك:
//     📋 {{2}}
//     🏢 المبنى: {{3}}
//     🏠 الوحدة: {{4}}
//     📅 الموعد: {{5}}
//     ⚡ الأولوية: {{6}}
//     اضغط على الزر أدناه لفتح المهمة.
//
//   nassayem_task_completed (EN):
//     Hello {{1}},
//     Great news! A task has been completed ✅
//     📋 {{2}}
//     🏢 Building: {{3}}
//     👤 Completed by: {{4}}
//     📅 Date: {{5}}
//     Tap the button below to view the details.
//
//   nassayem_task_completed_ar (AR):
//     مرحباً {{1}}،
//     تم إنجاز المهمة ✅
//     📋 {{2}}
//     🏢 المبنى: {{3}}
//     👤 أنجزها: {{4}}
//     📅 بتاريخ: {{5}}
//     اضغط على الزر أدناه لعرض التفاصيل.
//
// ── Laundry templates (one pair reused for every stage) ───────────────────────
//
//   nassayem_laundry_update  (EN)
//   nassayem_laundry_update_ar  (AR)
//   Body params: {{1}} name, {{2}} orderCode, {{3}} building,
//                {{4}} status, {{5}} neededDate
//   Button (URL, index 0):
//     Text (EN): "View Order"   URL: https://yoursite.com/en/admin/laundry/{{1}}
//     Text (AR): "عرض الطلب"     URL: https://yoursite.com/ar/admin/laundry/{{1}}
//   ({{1}} on the button = the orderId suffix passed by notifyLaundryUpdate.)
//
//   nassayem_laundry_update (EN) body:
//     Hello {{1}} 👋
//     Laundry order {{2}} update:
//     🏢 Building: {{3}}
//     🧺 Status: {{4}}
//     📅 Needed by: {{5}}
//     Tap the button below to open the order.
//
//   nassayem_laundry_update_ar (AR) body:
//     مرحباً {{1}} 👋
//     تحديث طلب الغسيل {{2}}:
//     🏢 المبنى: {{3}}
//     🧺 الحالة: {{4}}
//     📅 مطلوب بحلول: {{5}}
//     اضغط على الزر أدناه لفتح الطلب.
//
//   When the order reaches READY, the supervisors receive this message with
//   {{4}} = "Ready for collection" / "جاهز للاستلام".
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://graph.facebook.com/v19.0";

// ── Shared low-level POST (free-form chatbot messages) ───────────────────────
// Free-form (non-template) messages are allowed inside WhatsApp's 24-hour
// customer-service window, which every inbound customer message opens — so the
// AI chatbot can reply without registered templates.

export type WhatsAppSendResult = { ok: boolean; error?: unknown };

/**
 * senderPhoneNumberId: prefer the `metadata.phone_number_id` from the inbound
 * webhook — the 24-hour customer-service window belongs to the exact number
 * the customer wrote to; replying from a different number is rejected by Meta.
 * Falls back to the WHATSAPP_PHONE_NUMBER_ID env var.
 */
async function postWhatsAppPayload(
  payload: object,
  senderPhoneNumberId?: string,
): Promise<WhatsAppSendResult> {
  const phoneNumberId = senderPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.warn("[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN — skipping send.");
    return {
      ok: false,
      error: "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN env var is missing/empty on this server",
    };
  }
  try {
    const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[WhatsApp] Send failed:", JSON.stringify(err));
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    console.error("[WhatsApp] Network error:", e);
    return { ok: false, error: String(e) };
  }
}

/** Free-form text message (chatbot replies). WhatsApp caps body at 4096 chars. */
export async function sendWhatsAppText(
  to: string,
  body: string,
  senderPhoneNumberId?: string,
): Promise<WhatsAppSendResult> {
  const cleanTo = to.replace(/\D/g, "");
  if (!cleanTo || !body.trim()) return { ok: false, error: "empty recipient or body" };
  return postWhatsAppPayload(
    {
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "text",
      text: { body: body.slice(0, 4096), preview_url: true },
    },
    senderPhoneNumberId,
  );
}

/** Image by public URL with optional caption (unit gallery photos). */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string,
  senderPhoneNumberId?: string,
): Promise<WhatsAppSendResult> {
  const cleanTo = to.replace(/\D/g, "");
  if (!cleanTo) return { ok: false, error: "empty recipient" };
  return postWhatsAppPayload(
    {
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "image",
      image: { link: imageUrl, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
    },
    senderPhoneNumberId,
  );
}

/** Native location pin (building position). */
export async function sendWhatsAppLocation(
  to: string,
  latitude: number,
  longitude: number,
  name?: string,
  address?: string,
  senderPhoneNumberId?: string,
): Promise<WhatsAppSendResult> {
  const cleanTo = to.replace(/\D/g, "");
  if (!cleanTo) return { ok: false, error: "empty recipient" };
  return postWhatsAppPayload(
    {
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "location",
      location: { latitude, longitude, ...(name ? { name } : {}), ...(address ? { address } : {}) },
    },
    senderPhoneNumberId,
  );
}

/** Mark an inbound message as read (blue ticks) — polite chatbot UX. */
export async function markWhatsAppMessageRead(
  messageId: string,
  senderPhoneNumberId?: string,
): Promise<void> {
  await postWhatsAppPayload(
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
    senderPhoneNumberId,
  );
}

// ── Low-level sender ──────────────────────────────────────────────────────────

async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,       // "en_US" | "ar"
  bodyParams: string[],
  buttonUrlSuffix?: string,   // dynamic suffix for URL button (e.g. taskId)
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.warn("[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN — skipping notification.");
    return;
  }

  // Strip any non-digit characters just in case
  const cleanTo = to.replace(/\D/g, "");
  if (!cleanTo) return;

  const components: object[] = [
    {
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    },
  ];

  // Add URL button component when the template has one registered
  if (buttonUrlSuffix !== undefined) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: buttonUrlSuffix }],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  try {
    const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[WhatsApp] Send failed:", err);
    }
  } catch (e) {
    console.error("[WhatsApp] Network error:", e);
  }
}

// ── Notification helpers ──────────────────────────────────────────────────────

type AssignedUser = {
  name: string | null;
  whatsappNumber: string | null;
  preferredLanguage: string;
};

type NotifyUser = {
  name: string | null;
  whatsappNumber: string | null;
  preferredLanguage: string;
};

/**
 * Notify the assigned user when a new task is created for them.
 * Template: nassayem_task_assigned (EN) / nassayem_task_assigned_ar (AR)
 * Params: [1] name, [2] title, [3] building, [4] unit, [5] dueDate, [6] priority
 * Button URL suffix: taskId
 */
export async function notifyTaskAssigned({
  assignee,
  taskTitle,
  buildingName,
  unitName,
  dueDate,
  priority,
  taskId,
}: {
  assignee: AssignedUser;
  taskTitle: string;
  buildingName: string;
  unitName: string;   // pass "" or "Common Area" when there is no unit
  dueDate: Date;
  priority: string;
  taskId: string;
}): Promise<void> {
  if (!assignee.whatsappNumber) return;

  const isAr = assignee.preferredLanguage === "ar";
  const langCode = isAr ? "ar" : "en_US";
  const name = assignee.name ?? "Team Member";

  const dueDateStr = dueDate.toLocaleDateString(isAr ? "ar-OM" : "en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const priorityLabels: Record<string, { en: string; ar: string }> = {
    LOW: { en: "Low", ar: "منخفضة" },
    MEDIUM: { en: "Medium", ar: "متوسطة" },
    HIGH: { en: "High", ar: "عالية" },
    URGENT: { en: "Urgent", ar: "عاجلة" },
  };
  const priorityLabel = isAr
    ? (priorityLabels[priority]?.ar ?? priority)
    : (priorityLabels[priority]?.en ?? priority);

  const unitDisplay = unitName || (isAr ? "منطقة مشتركة" : "Common Area");
  const templateName = isAr ? "nassayem_task_assigned_ar" : "nassayem_task_assigned";

  // Fire-and-forget — don't block the task creation
  sendTemplate(assignee.whatsappNumber, templateName, langCode, [
    name,
    taskTitle,
    buildingName,
    unitDisplay,
    dueDateStr,
    priorityLabel,
  ], taskId).catch(console.error);
}

/**
 * Notify users (managers, supervisors, and the task creator) when a task is completed.
 * Template: nassayem_task_completed (EN) / nassayem_task_completed_ar (AR)
 * Params: [1] name, [2] title, [3] building, [4] completedBy, [5] date
 * Button URL suffix: taskId
 */
export async function notifyTaskCompleted({
  notifyUsers,
  taskTitle,
  completedByName,
  buildingName,
  completedAt,
  taskId,
}: {
  notifyUsers: NotifyUser[];
  taskTitle: string;
  completedByName: string;
  buildingName: string;
  completedAt: Date;
  taskId: string;
}): Promise<void> {
  const dateStr = (lang: string) =>
    completedAt.toLocaleDateString(lang === "ar" ? "ar-OM" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

  for (const user of notifyUsers) {
    if (!user.whatsappNumber) continue;
    const isAr = user.preferredLanguage === "ar";
    const langCode = isAr ? "ar" : "en_US";
    const name = user.name ?? "Team Member";
    const templateName = isAr ? "nassayem_task_completed_ar" : "nassayem_task_completed";

    sendTemplate(user.whatsappNumber, templateName, langCode, [
      name,
      taskTitle,
      buildingName,
      completedByName,
      dateStr(user.preferredLanguage),
    ], taskId).catch(console.error);
  }
}

/**
 * Notify one or more users about a laundry order status change. A single
 * template pair covers every stage — the localized status label carries the
 * meaning (e.g. "Ready for collection", "Out for delivery").
 *
 * Template: nassayem_laundry_update (EN) / nassayem_laundry_update_ar (AR)
 * Params: [1] name, [2] orderCode, [3] building, [4] status, [5] neededDate
 * Button URL suffix: orderId  →  /{locale}/admin/laundry?orderId={{1}}
 *
 * Fire-and-forget and self-disabling: if the WhatsApp credentials or template
 * are not configured, sendTemplate simply logs and returns.
 */
export async function notifyLaundryUpdate({
  recipients,
  orderCode,
  buildingName,
  orderId,
  statusLabelEn,
  statusLabelAr,
  neededDate,
}: {
  recipients: NotifyUser[];
  orderCode: string;
  buildingName: string;
  orderId: string;
  statusLabelEn: string;
  statusLabelAr: string;
  neededDate: Date;
}): Promise<void> {
  for (const user of recipients) {
    if (!user.whatsappNumber) continue;
    const isAr = user.preferredLanguage === "ar";
    const langCode = isAr ? "ar" : "en_US";
    const name = user.name ?? "Team Member";
    const templateName = isAr
      ? "nassayem_laundry_update_ar"
      : "nassayem_laundry_update";
    const neededStr = neededDate.toLocaleDateString(isAr ? "ar-OM" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

    sendTemplate(
      user.whatsappNumber,
      templateName,
      langCode,
      [name, orderCode, buildingName, isAr ? statusLabelAr : statusLabelEn, neededStr],
      orderId,
    ).catch(console.error);
  }
}
