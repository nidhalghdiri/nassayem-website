import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { registerForPush } from '@/lib/notifications/push';
import { notificationKeys, useMarkRead } from '@/lib/notifications/queries';

/**
 * Lives inside the signed-in area:
 *  - registers this phone for pushes once per sign-in;
 *  - refreshes the inbox (and task lists) when a push arrives;
 *  - opens the right screen when a notification is tapped, also when the tap
 *    launched the app.
 */
export function PushHandler() {
  const queryClient = useQueryClient();
  const markRead = useMarkRead();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    void registerForPush();
  }, []);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });
    return () => received.remove();
  }, [queryClient]);

  // Covers taps while the app runs and the tap that cold-started it.
  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { identifier, content } = lastResponse.notification.request;
    if (handled.current === identifier) return;
    handled.current = identifier;

    const data = (content.data ?? {}) as { notificationId?: unknown; url?: unknown };
    if (typeof data.notificationId === 'string') markRead.mutate([data.notificationId]);
    // Only in-app paths, never external links.
    if (typeof data.url === 'string' && data.url.startsWith('/')) router.push(data.url as Href);
    else router.push('/notifications');
  }, [lastResponse, markRead]);

  return null;
}
