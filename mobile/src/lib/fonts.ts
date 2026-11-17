// Same typefaces as the website: Inter for English, Tajawal for Arabic.
// Imported per weight so only these files are bundled.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Tajawal_400Regular } from '@expo-google-fonts/tajawal/400Regular';
import { Tajawal_500Medium } from '@expo-google-fonts/tajawal/500Medium';
import { Tajawal_700Bold } from '@expo-google-fonts/tajawal/700Bold';

import type { Language } from '@/lib/api/schemas';

export const appFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
};

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

// Custom fonts on Android ignore fontWeight, so each weight is its own family.
const FAMILIES: Record<Language, Record<FontWeight, keyof typeof appFonts>> = {
  en: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
  },
  ar: {
    regular: 'Tajawal_400Regular',
    medium: 'Tajawal_500Medium',
    semibold: 'Tajawal_700Bold', // Tajawal has no 600
    bold: 'Tajawal_700Bold',
  },
};

export function fontFamily(language: Language, weight: FontWeight): string {
  return FAMILIES[language][weight];
}
