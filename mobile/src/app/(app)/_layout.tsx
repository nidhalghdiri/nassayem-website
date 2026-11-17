import { Tabs } from 'expo-router';
import { ClipboardList, House, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useCurrentUser } from '@/lib/auth/session';
import { fontFamily } from '@/lib/fonts';

export default function AppTabsLayout() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const hasTasks = user.modules.includes('tasks');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2a7475',
        tabBarInactiveTintColor: '#66797a',
        tabBarLabelStyle: { fontFamily: fontFamily(language, 'medium'), fontSize: 12 },
        headerTitleStyle: { fontFamily: fontFamily(language, 'bold'), fontSize: 18, color: '#1b2626' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f5f7f7' },
        sceneStyle: { backgroundColor: '#f5f7f7' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          // Roles without Tasks (laundry operator) do not get the tab.
          href: hasTasks ? undefined : null,
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
