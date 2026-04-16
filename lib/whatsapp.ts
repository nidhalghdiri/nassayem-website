// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Cloud API — template messaging service
//
// Env vars required (add to .env):
//   WHATSAPP_ACCESS_TOKEN      — permanent or long-lived token from Meta Business
//   WHATSAPP_PHONE_NUMBER_ID   — the phone number ID from WhatsApp Cloud API
//
// Templates to register in Meta Business Manager:
//   nassayem_task_assigned    (EN + AR) — sent to the assigned user
//   nassayem_task_completed   (EN + AR) — sent to supervisors / managers
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://graph.facebook.com/v19.0";

// ── Low-level sender ──────────────────────────────────────────────────────────

async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string,       // "en_US" | "ar"
  bodyParams: string[],
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

  const payload = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: "body",
          parameters: bodyParams.map((text) => ({ type: "text", text })),
        },
      ],
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
 * Template: nassayem_task_assigned
 * Params: [1] name, [2] title, [3] building, [4] dueDate, [5] priority
 */
export async function notifyTaskAssigned({
  assignee,
  taskTitle,
  buildingName,
  dueDate,
  priority,
}: {
  assignee: AssignedUser;
  taskTitle: string;
  buildingName: string;
  dueDate: Date;
  priority: string;
}): Promise<void> {
  if (!assignee.whatsappNumber) return;

  const isAr = assignee.preferredLanguage === "ar";
  const langCode = isAr ? "ar" : "en_US";
  const name = assignee.name ?? "Team Member";

  const dueDateStr = dueDate.toLocaleDateString(isAr ? "ar-OM" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  const priorityLabels: Record<string, { en: string; ar: string }> = {
    LOW:    { en: "Low",    ar: "منخفضة" },
    MEDIUM: { en: "Medium", ar: "متوسطة" },
    HIGH:   { en: "High",   ar: "عالية" },
    URGENT: { en: "Urgent", ar: "عاجلة" },
  };
  const priorityLabel = isAr
    ? (priorityLabels[priority]?.ar ?? priority)
    : (priorityLabels[priority]?.en ?? priority);

  // Fire-and-forget — don't block the task creation
  sendTemplate(assignee.whatsappNumber, "nassayem_task_assigned", langCode, [
    name,
    taskTitle,
    buildingName,
    dueDateStr,
    priorityLabel,
  ]).catch(console.error);
}

/**
 * Notify supervisors / managers when a task reaches a terminal (completed) status.
 * Template: nassayem_task_completed
 * Params: [1] supervisor name, [2] task title, [3] completed-by name, [4] building, [5] completedAt date
 */
export async function notifyTaskCompleted({
  notifyUsers,
  taskTitle,
  completedByName,
  buildingName,
  completedAt,
}: {
  notifyUsers: NotifyUser[];
  taskTitle: string;
  completedByName: string;
  buildingName: string;
  completedAt: Date;
}): Promise<void> {
  const dateStr = (lang: string) =>
    completedAt.toLocaleDateString(lang === "ar" ? "ar-OM" : "en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });

  for (const user of notifyUsers) {
    if (!user.whatsappNumber) continue;
    const isAr = user.preferredLanguage === "ar";
    const langCode = isAr ? "ar" : "en_US";
    const name = user.name ?? "Supervisor";

    sendTemplate(user.whatsappNumber, "nassayem_task_completed", langCode, [
      name,
      taskTitle,
      completedByName,
      buildingName,
      dateStr(user.preferredLanguage),
    ]).catch(console.error);
  }
}
