import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import type { Language } from '@/lib/api/schemas';

import { ar } from './ar';
import { en, type Translations } from './en';

const LANGUAGE_KEY = 'nassayem.language';
const RELOAD_ATTEMPT_KEY = 'nassayem.directionReloadAttempt';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
  }
}

function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

/**
 * Loads the saved language (or the phone's language the first time) before
 * the first screen renders. Returns false when the layout direction had to be
 * switched — the app is reloading and should keep the splash screen up.
 */
export async function initI18n(): Promise<boolean> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  const language: Language = saved === 'ar' || saved === 'en' ? saved : deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  // The native layout direction is fixed at launch. If it does not match the
  // language (e.g. English chosen on an Arabic phone), set it and restart —
  // once: where the direction cannot be forced (Expo Go, web) a second
  // mismatch would otherwise reload forever.
  if (I18nManager.isRTL !== (language === 'ar')) {
    const attempted = await AsyncStorage.getItem(RELOAD_ATTEMPT_KEY).catch(() => null);
    if (attempted !== language) {
      await AsyncStorage.setItem(RELOAD_ATTEMPT_KEY, language).catch(() => {});
      await applyDirectionAndReload(language);
      return false;
    }
  }
  await AsyncStorage.removeItem(RELOAD_ATTEMPT_KEY).catch(() => {});
  return true;
}


export function currentLanguage(): Language {
  return i18n.language === 'ar' ? 'ar' : 'en';
}

/** Switches the app language; restarts the app when the direction changes. */
export async function setAppLanguage(language: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  await i18n.changeLanguage(language);
  if (I18nManager.isRTL !== (language === 'ar')) {
    await applyDirectionAndReload(language);
  }
}

async function applyDirectionAndReload(language: Language) {
  const rtl = language === 'ar';
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  // Works in development and release builds (unlike Updates.reloadAsync).
  await reloadAppAsync('Switch layout direction');
}

export { i18n };
