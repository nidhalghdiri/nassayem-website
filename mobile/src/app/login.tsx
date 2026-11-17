import { Image } from 'expo-image';
import { LogIn } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { LanguageToggle } from '@/components/language-toggle';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useSession } from '@/lib/auth/session';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const errorMessage = useErrorMessage();
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
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen safeTop className="flex-grow justify-center">
        <View className="items-end">
          <LanguageToggle />
        </View>

        <View className="items-center">
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: 170, height: 170 }}
            contentFit="contain"
            accessibilityLabel={t('common.appName')}
          />
        </View>

        <View className="gap-1">
          <Text weight="bold" className="text-2xl">
            {t('login.title')}
          </Text>
          <Text className="text-muted">{t('login.subtitle')}</Text>
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
            <Text accessibilityLiveRegion="polite" className="text-danger">
              {error}
            </Text>
          ) : null}
          <Button label={t('login.submit')} icon={LogIn} loading={submitting} onPress={submit} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
