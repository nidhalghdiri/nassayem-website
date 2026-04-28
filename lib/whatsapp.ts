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
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://graph.facebook.com/v19.0";

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
