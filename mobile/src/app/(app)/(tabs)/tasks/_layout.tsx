import { Stack } from 'expo-router';

import { useLanguage } from '@/lib/i18n/use-language';
import { stackScreenOptions } from '@/lib/navigation';

// Opening a task from Home still puts the list underneath it, for Back.
export const unstable_settings = { initialRouteName: 'index' };

export default function TasksStackLayout() {
  const language = useLanguage();
  return (
    <Stack screenOptions={stackScreenOptions(language)}>
      {/* The list draws its own header (menu, title, notifications). */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
