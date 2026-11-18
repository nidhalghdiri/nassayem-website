import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Staff app notifications: one inbox row per person (shown in the app's
// Notifications screen) plus a push to every phone they are signed in on.
//
// Server-only. Never throws — a failed notification must not fail the action
// that caused it. Call it after the change is saved, wrapped in `after()` from
// next/server so it runs once the response has been sent:
//
//   after(() => notifyApp([userId], { type, title, body, url }));
// ─────────────────────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo's limit per request

export type Localized = { en: string; ar: string };

export type AppNotificationInput = {
  /** Machine-readable kind, e.g. "task_assigned". */
  type: string;
  title: Localized;
  body: Localized;
  /** In-app path opened when the notification is tapped, e.g. "/tasks/<id>". */
  url?: string;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  priority: "high";
  channelId: string;
  badge?: number;
};

type ExpoTicket = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

/** Saves the notification for each user and pushes it to their phones. */
export async function notifyApp(userIds: string[], input: AppNotificationInput): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;

  try {
    const users = await prisma.adminUser.findMany({
      where: { id: { in: ids } },
      select: { id: true, preferredLanguage: true, mobileDevices: { select: { expoPushToken: true } } },
    });

    const created = await prisma.$transaction(
      users.map((user) => {
        const lang = user.preferredLanguage === "ar" ? "ar" : "en";
        return prisma.appNotification.create({
          data: {
            adminUserId: user.id,
            type: input.type,
            title: input.title[lang],
            body: input.body[lang],
            url: input.url ?? null,
          },
          select: { id: true, adminUserId: true, title: true, body: true },
        });
      }),
    );

    // App icon badge = unread count, for phones that show one.
    const unread = await prisma.appNotification.groupBy({
      by: ["adminUserId"],
      where: { adminUserId: { in: users.map((u) => u.id) }, readAt: null },
      _count: { _all: true },
    });
    const unreadByUser = new Map(unread.map((row) => [row.adminUserId, row._count._all]));

    const messages: ExpoMessage[] = [];
    for (const notification of created) {
      const user = users.find((u) => u.id === notification.adminUserId);
      for (const device of user?.mobileDevices ?? []) {
        messages.push({
          to: device.expoPushToken,
          title: notification.title,
          body: notification.body,
          data: { notificationId: notification.id, url: input.url ?? null, type: input.type },
          sound: "default",
          priority: "high",
          channelId: "default",
          badge: unreadByUser.get(notification.adminUserId),
        });
      }
    }

    await sendExpoPush(messages);
  } catch (err) {
    console.error("[notifyApp] failed:", err);
  }
}

/** Sends push messages through Expo and forgets phones that uninstalled the app. */
async function sendExpoPush(messages: ExpoMessage[]): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Optional: required only if "enhanced push security" is on in Expo.
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(batch) });
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[]; errors?: unknown } | null;
      if (!res.ok || !json?.data) {
        console.error("[notifyApp] Expo push rejected:", res.status, json?.errors ?? json);
        continue;
      }

      const gone = json.data
        .map((ticket, index) =>
          ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? batch[index].to : null,
        )
        .filter((token): token is string => token !== null);
      if (gone.length > 0) {
        await prisma.mobileDevice.deleteMany({ where: { expoPushToken: { in: gone } } });
      }
      for (const ticket of json.data) {
        if (ticket.status === "error" && ticket.details?.error !== "DeviceNotRegistered") {
          console.error("[notifyApp] push error:", ticket.message);
        }
      }
    } catch (err) {
      console.error("[notifyApp] Expo push request failed:", err);
    }
  }
}

// ── Task events ──────────────────────────────────────────────────────────────

/** A task was created for (or assigned to) someone other than the person who did it. */
export function notifyAppTaskAssigned(params: {
  assigneeId: string;
  actorId: string;
  taskId: string;
  title: string;
  buildingName: string;
  unitName?: string | null;
}): Promise<void> {
  if (params.assigneeId === params.actorId) return Promise.resolve();
  const where = (lang: "en" | "ar") =>
    [params.buildingName, params.unitName ? `${lang === "ar" ? "وحدة" : "Unit"} ${params.unitName}` : null]
      .filter(Boolean)
      .join(" · ");
  return notifyApp([params.assigneeId], {
    type: "task_assigned",
    title: { en: "New task for you", ar: "مهمة جديدة لك" },
    body: {
      en: [params.title, where("en")].filter(Boolean).join(" — "),
      ar: [params.title, where("ar")].filter(Boolean).join(" — "),
    },
    url: `/tasks/${params.taskId}`,
  });
}

/** A task reached a completed status: tell whoever created it. */
export function notifyAppTaskCompleted(params: {
  creatorId: string;
  actorId: string;
  taskId: string;
  title: string;
  completedByName: string;
}): Promise<void> {
  if (params.creatorId === params.actorId) return Promise.resolve();
  return notifyApp([params.creatorId], {
    type: "task_completed",
    title: { en: "Task completed", ar: "تم إنجاز مهمة" },
    body: {
      en: `${params.title} — completed by ${params.completedByName}`,
      ar: `${params.title} — أنجزها ${params.completedByName}`,
    },
    url: `/tasks/${params.taskId}`,
  });
}
