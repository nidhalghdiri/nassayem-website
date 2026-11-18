import { Image } from 'expo-image';
import { LogIn } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useSession } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/config';
import { shadow } from '@/lib/theme';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const errorMessage = useErrorMessage();
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError(t('login.required'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // On success the session changes and the router guard opens the app.
      await signIn(email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="overflow-hidden rounded-b-[40px] bg-brand px-5 pb-28" style={{ paddingTop: insets.top + 12 }}>
          <View className="absolute -end-24 -top-20 h-72 w-72 rounded-full bg-white/10" />
          <View className="absolute -start-16 bottom-4 h-40 w-40 rounded-full bg-white/5" />

          <View className="items-end">
            <LanguageToggle />
          </View>

          <View className="mt-4 items-center gap-3">
            <View className="rounded-3xl bg-white p-2" style={shadow.raised}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={{ width: 92, height: 92, borderRadius: 18 }}
                contentFit="contain"
                accessibilityLabel={t('common.appName')}
              />
            </View>
            <Text weight="bold" className="text-3xl text-white">
              {t('common.appName')}
            </Text>
            <Text className="text-sm text-white/80">{t('login.tagline')}</Text>
          </View>
        </View>

        <View className="-mt-20 px-4">
          <Card className="gap-5 p-5" style={shadow.raised}>
            <View className="gap-1">
              <Text weight="bold" className="text-xl">
                {t('login.title')}
              </Text>
              <Text className="text-sm leading-5 text-muted">{t('login.subtitle')}</Text>
            </View>

            <View className="gap-4">
              <TextField
                label={t('login.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!submitting}
              />
              <TextField
                ref={passwordRef}
                label={t('login.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                editable={!submitting}
              />
              {error ? (
                <View className="rounded-xl bg-red-50 px-3 py-2.5">
                  <Text accessibilityLiveRegion="polite" className="text-sm text-danger">
                    {error}
                  </Text>
                </View>
              ) : null}
              <Button label={t('login.submit')} icon={LogIn} loading={submitting} onPress={submit} />
            </View>
          </Card>
        </View>

        <Text className="mt-auto pt-8 text-center text-xs text-muted" style={{ paddingBottom: insets.bottom + 16 }}>
          {t('profile.version', { version: APP_VERSION })}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
