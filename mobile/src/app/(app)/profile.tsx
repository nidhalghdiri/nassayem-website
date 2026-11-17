import { Check, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { STAFF_ROLE_CONFIG } from '@shared/tasks/constants';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { updateMyLanguage } from '@/lib/api/endpoints';
import type { Language } from '@/lib/api/schemas';
import { useCurrentUser, useSession } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/config';
import { currentLanguage, setAppLanguage } from '@/lib/i18n';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { signOut, setUser } = useSession();
  const [changing, setChanging] = useState(false);
  const language = currentLanguage();
  const role = STAFF_ROLE_CONFIG[user.role];

  async function chooseLanguage(next: Language) {
    if (next === language || changing) return;
    setChanging(true);
    // Also the language of this person's WhatsApp notifications. Best effort:
    // the app language still changes if the server cannot be reached.
    try {
      setUser(await updateMyLanguage(next));
    } catch {}
    await setAppLanguage(next);
    setChanging(false);
  }

  function confirmSignOut() {
    Alert.alert(t('profile.signOutConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen>
      <Card className="gap-4">
        <View className="gap-1">
          <Text weight="bold" className="text-lg">
            {user.name || user.email}
          </Text>
          <Text className="text-sm text-muted">{user.email}</Text>
        </View>
        <Row label={t('profile.role')} value={language === 'ar' ? role.labelAr : role.labelEn} />
      </Card>

      <Card className="gap-1 p-2">
        <Text weight="semibold" className="px-2 pt-2 text-sm text-muted">
          {t('profile.language')}
        </Text>
        <LanguageOption label={t('profile.english')} selected={language === 'en'} onPress={() => chooseLanguage('en')} />
        <LanguageOption label={t('profile.arabic')} selected={language === 'ar'} onPress={() => chooseLanguage('ar')} />
      </Card>

      <Button label={t('profile.signOut')} icon={LogOut} variant="danger" onPress={confirmSignOut} />

      <Text className="text-center text-xs text-muted">{t('profile.version', { version: APP_VERSION })}</Text>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-muted">{label}</Text>
      <Text weight="medium">{value}</Text>
    </View>
  );
}

function LanguageOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-12 flex-row items-center justify-between rounded-xl px-3 active:bg-background">
      <Text weight={selected ? 'semibold' : 'regular'}>{label}</Text>
      {selected ? <Check size={20} color="#2a7475" /> : null}
    </Pressable>
  );
}
