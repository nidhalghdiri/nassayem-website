import { Stack } from 'expo-router';

import { PushHandler } from '@/components/push-handler';
import { SideMenuProvider } from '@/components/side-menu';
import { useLanguage } from '@/lib/i18n/use-language';
import { stackScreenOptions } from '@/lib/navigation';

/** Signed-in area: the tabs, plus full pages that open above them. */
export default function AppLayout() {
  const language = useLanguage();
  return (
    <SideMenuProvider>
      <PushHandler />
      <Stack screenOptions={stackScreenOptions(language)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="soon/[feature]" options={{ title: '' }} />
        <Stack.Screen name="notifications" />
      </Stack>
    </SideMenuProvider>
  );
}
