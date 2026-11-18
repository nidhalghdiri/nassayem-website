import { Bell, Menu } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSideMenu } from '@/components/side-menu';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { openFeature } from '@/lib/features';
import { useUnreadCount } from '@/lib/notifications/queries';

/** Header for the main tab screens: menu, large title, notifications. */
export function AppHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const menu = useSideMenu();
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  return (
    <View className="gap-3 bg-background px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center gap-3">
        <IconButton icon={Menu} label={t('menu.open')} onPress={menu.open} />
        <View className="flex-1">
          <Text weight="bold" className="text-2xl" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm text-muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <IconButton icon={Bell} label={t('menu.notifications')} dot={unread > 0} onPress={() => openFeature('notifications')} />
      </View>
      {children}
    </View>
  );
}
