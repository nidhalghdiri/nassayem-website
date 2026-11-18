import { router, Stack, useFocusEffect, type Href } from 'expo-router';
import { Bell, BellOff, CheckCheck, CircleCheck, ClipboardList, type LucideIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import type { AppNotification } from '@/lib/api/notifications';
import { formatDateTime } from '@/lib/format';
import { useLanguage } from '@/lib/i18n/use-language';
import { notificationsAllowed, registerForPush } from '@/lib/notifications/push';
import { useMarkRead, useNotifications } from '@/lib/notifications/queries';
import { colors, shadow, tint } from '@/lib/theme';

const TYPE_STYLE: Record<string, { icon: LucideIcon; color: string }> = {
  task_assigned: { icon: ClipboardList, color: colors.brand },
  task_completed: { icon: CircleCheck, color: '#15803d' },
};
const DEFAULT_STYLE = { icon: Bell, color: '#ea580c' };

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const query = useNotifications();
  const markRead = useMarkRead();
  const [refreshing, setRefreshing] = useState(false);
  const [allowed, setAllowed] = useState(true);

  const notifications = query.data?.pages.flatMap((page) => page.notifications) ?? [];
  const unread = query.data?.pages[0]?.unread ?? 0;

  // Re-check when coming back from the phone's settings.
  useFocusEffect(
    useCallback(() => {
      void notificationsAllowed().then((ok) => {
        setAllowed(ok);
        if (ok) void registerForPush();
      });
    }, []),
  );

  async function refresh() {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }

  function open(notification: AppNotification) {
    if (!notification.readAt) markRead.mutate([notification.id]);
    if (notification.url?.startsWith('/')) router.push(notification.url as Href);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('notifications.title'),
          headerRight: () =>
            unread > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notifications.markAllRead')}
                hitSlop={8}
                onPress={() => markRead.mutate(undefined)}
                className="flex-row items-center gap-1 px-1">
                <CheckCheck size={18} color={colors.brand} />
                <Text weight="semibold" className="text-sm text-brand">
                  {t('notifications.markAllRead')}
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        className="flex-1 bg-background"
        contentContainerClassName="gap-2.5 px-4 pb-10 pt-2"
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow notification={item} onPress={() => open(item)} />}
        ListHeaderComponent={allowed ? undefined : <PermissionCard />}
        ListEmptyComponent={
          query.isPending ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <EmptyState icon={Bell} message={t('notifications.empty')} />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? <ActivityIndicator color={colors.brand} style={{ paddingVertical: 16 }} /> : undefined
        }
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} />
        }
      />
    </>
  );
}

function NotificationRow({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const language = useLanguage();
  const { icon: Icon, color } = TYPE_STYLE[notification.type] ?? DEFAULT_STYLE;
  const unread = !notification.readAt;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row gap-3 rounded-2xl p-4 active:opacity-80 ${unread ? 'bg-surface' : 'bg-surface/60'}`}
      style={unread ? shadow.card : undefined}>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint(color) }}>
        <Icon size={19} color={color} />
      </View>
      <View className="flex-1 gap-1">
        <View className="flex-row items-start gap-2">
          <Text weight={unread ? 'bold' : 'medium'} className="flex-1" numberOfLines={2}>
            {notification.title}
          </Text>
          {unread ? <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand" /> : null}
        </View>
        <Text className={`text-sm ${unread ? 'text-ink' : 'text-muted'}`} numberOfLines={3}>
          {notification.body}
        </Text>
        <Text className="text-xs text-muted">{formatDateTime(notification.createdAt, language)}</Text>
      </View>
    </Pressable>
  );
}

/** Shown when the phone blocks notifications for the app. */
function PermissionCard() {
  const { t } = useTranslation();
  return (
    <Card className="mb-2 gap-3 border border-amber-200 bg-amber-50">
      <View className="flex-row items-center gap-3">
        <BellOff size={22} color="#b45309" />
        <Text weight="semibold" className="flex-1">
          {t('notifications.offTitle')}
        </Text>
      </View>
      <Text className="text-sm text-muted">{t('notifications.offBody')}</Text>
      <Button label={t('notifications.openSettings')} variant="secondary" onPress={() => Linking.openSettings()} />
    </Card>
  );
}
