import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { fetchNotifications, markNotificationsRead, type NotificationPage } from '@/lib/api/notifications';

export const notificationKeys = { all: ['notifications'] as const };

/** The inbox, newest first. The first page also carries the unread count. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.all,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Pushes refresh it straight away; this covers phones with pushes off.
    refetchInterval: 2 * 60_000,
  });
}

export function useUnreadCount(): number {
  return useNotifications().data?.pages[0]?.unread ?? 0;
}

/** Marks some (or, without ids, all) notifications read — instantly in the list. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previous = queryClient.getQueryData<InfiniteData<NotificationPage>>(notificationKeys.all);
      if (previous) {
        const now = new Date().toISOString();
        let marked = 0;
        const pages = previous.pages.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) => {
            if (n.readAt || (ids && !ids.includes(n.id))) return n;
            marked += 1;
            return { ...n, readAt: now };
          }),
        }));
        pages[0] = { ...pages[0], unread: ids ? Math.max(0, pages[0].unread - marked) : 0 };
        queryClient.setQueryData(notificationKeys.all, { ...previous, pages });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(notificationKeys.all, context.previous);
    },
    onSuccess: ({ unread }) => {
      void Notifications.setBadgeCountAsync(unread).catch(() => {});
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
