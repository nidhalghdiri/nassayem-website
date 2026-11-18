import { Platform } from 'react-native';
import { z } from 'zod';

import { APP_VERSION } from '@/lib/config';

import { apiRequest } from './client';
import { OkResponseSchema } from './schemas';

export const AppNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  url: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AppNotification = z.infer<typeof AppNotificationSchema>;

const NotificationPageSchema = z.object({
  notifications: z.array(AppNotificationSchema),
  nextCursor: z.string().nullable(),
  unread: z.number(),
});
export type NotificationPage = z.infer<typeof NotificationPageSchema>;

export function fetchNotifications(cursor?: string | null) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest(`/notifications${query}`, { schema: NotificationPageSchema });
}

/** Marks the given notifications as read, or all of them without `ids`. */
export function markNotificationsRead(ids?: string[]) {
  return apiRequest('/notifications/read', {
    method: 'POST',
    body: ids ? { ids } : {},
    schema: z.object({ unread: z.number() }),
  });
}

/** Tells the server this phone can receive the signed-in user's pushes. */
export function registerDevice(expoPushToken: string) {
  return apiRequest('/devices', {
    method: 'POST',
    body: { expoPushToken, platform: Platform.OS === 'ios' ? 'ios' : 'android', appVersion: APP_VERSION },
    schema: OkResponseSchema,
  });
}

export function unregisterDevice(expoPushToken: string) {
  return apiRequest('/devices', { method: 'DELETE', body: { expoPushToken }, schema: OkResponseSchema });
}
