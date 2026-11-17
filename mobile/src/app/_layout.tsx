import '../global.css';

import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdateRequired } from '@/components/update-required';
import { fetchAppConfig } from '@/lib/api/endpoints';
import { SessionProvider, useSession } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/config';
import { appFonts } from '@/lib/fonts';
import { i18n, initI18n } from '@/lib/i18n';
import { queryClient } from '@/lib/query-client';
import { isVersionOlder } from '@/lib/version';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    // false = the app is reloading to switch layout direction; keep the splash up.
    initI18n().then((ready) => ready && setI18nReady(true));
  }, []);

  if ((!fontsLoaded && !fontError) || !i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

function RootNavigator() {
  const { session } = useSession();
  const config = useQuery({ queryKey: ['app-config'], queryFn: fetchAppConfig, staleTime: Infinity });

  const loading = session.status === 'loading';
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  // An unreachable server never blocks the app; only a confirmed old build does.
  if (config.data && isVersionOlder(APP_VERSION, config.data.minAppVersion)) {
    return <UpdateRequired />;
  }

  const signedIn = session.status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
