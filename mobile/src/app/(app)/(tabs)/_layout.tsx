import { Tabs } from 'expo-router';
import { ClipboardList, House, MessageCircle, UserRound, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentUser } from '@/lib/auth/session';
import { fontFamily } from '@/lib/fonts';
import { useLanguage } from '@/lib/i18n/use-language';
import { colors } from '@/lib/theme';

export default function AppTabsLayout() {
  const { t } = useTranslation();
  const language = useLanguage();
  const user = useCurrentUser();
  const insets = useSafeAreaInsets();
  const hasTasks = user.modules.includes('tasks');

  const icon = (Icon: LucideIcon) =>
    function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
      return (
        <View className={`h-8 w-14 items-center justify-center rounded-full ${focused ? 'bg-brand-50' : ''}`}>
          <Icon color={color} size={22} strokeWidth={focused ? 2.4 : 2} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        // Every tab screen draws its own header (menu, title, notifications).
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fontFamily(language, 'medium'), fontSize: 11, marginTop: 2 },
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 8,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon(House) }} />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          // Roles without Tasks (laundry operator) do not get the tab.
          href: hasTasks ? undefined : null,
          tabBarIcon: icon(ClipboardList),
        }}
      />
      <Tabs.Screen name="messages" options={{ title: t('tabs.messages'), tabBarIcon: icon(MessageCircle) }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon(UserRound) }} />
    </Tabs>
  );
}
