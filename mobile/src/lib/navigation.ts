import type { NativeStackNavigationOptions } from 'expo-router/native-stack';

import type { Language } from '@/lib/api/schemas';
import { fontFamily } from '@/lib/fonts';
import { colors } from '@/lib/theme';

/** Shared look for stack headers (task details, coming-soon pages). */
export function stackScreenOptions(language: Language): NativeStackNavigationOptions {
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.brand,
    headerTitleStyle: { fontFamily: fontFamily(language, 'bold'), color: colors.ink },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.background },
  };
}
