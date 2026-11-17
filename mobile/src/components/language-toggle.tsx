import { Languages } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { currentLanguage, setAppLanguage } from '@/lib/i18n';

/** Compact EN ⇄ عربي switch for screens without a profile (login). */
export function LanguageToggle() {
  const next = currentLanguage() === 'ar' ? 'en' : 'ar';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => setAppLanguage(next)}
      className="flex-row items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 active:bg-background">
      <Languages size={16} color="#2a7475" />
      <Text weight="medium" className="text-sm text-brand">
        {next === 'ar' ? 'العربية' : 'English'}
      </Text>
    </Pressable>
  );
}
