import { Bell, Info, Languages, LifeBuoy, LogOut, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, ScrollView, View } from 'react-native';

import { buildingLabel } from '@shared/buildingLabel';
import { STAFF_ROLE_CONFIG } from '@shared/tasks/constants';

import { AppHeader } from '@/components/app-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { updateMyLanguage } from '@/lib/api/endpoints';
import type { Language } from '@/lib/api/schemas';
import { useCurrentUser, useSession } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/config';
import { setAppLanguage } from '@/lib/i18n';
import { useLanguage } from '@/lib/i18n/use-language';
import { roleLabel } from '@/lib/tasks/labels';
import { colors } from '@/lib/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const user = useCurrentUser();
  const { signOut, setUser } = useSession();
  const [changing, setChanging] = useState(false);

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
    <View className="flex-1 bg-background">
      <AppHeader title={t('tabs.profile')} />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-10 pt-1">
        <Card className="items-center gap-3 py-7">
          <Avatar name={user.name} fallback={user.email} size={76} />
          <View className="items-center gap-1">
            <Text weight="bold" className="text-center text-xl">
              {user.name || user.email}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Mail size={14} color={colors.muted} />
              <Text className="text-sm text-muted">{user.email}</Text>
            </View>
          </View>
          <Badge label={roleLabel(user.role, language)} className={STAFF_ROLE_CONFIG[user.role].badge} />
          {user.role === 'RECEPTIONIST' && user.buildings.length > 0 ? (
            <View className="flex-row flex-wrap justify-center gap-2 pt-1">
              {user.buildings.map((b) => (
                <Badge key={b.id} label={buildingLabel(b, language === 'en')} className="bg-background text-ink" />
              ))}
            </View>
          ) : null}
        </Card>

        <ListGroup title={t('profile.preferences')}>
          <View className="gap-3 px-4 py-3.5">
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                <Languages size={18} color={colors.brand} />
              </View>
              <Text weight="medium" className="flex-1">
                {t('profile.language')}
              </Text>
              {changing ? <ActivityIndicator size="small" color={colors.brand} /> : null}
            </View>
            <Segmented
              value={language}
              onChange={chooseLanguage}
              options={[
                { value: 'en', label: t('profile.english') },
                { value: 'ar', label: t('profile.arabic') },
              ]}
            />
          </View>
          <ListRow
            icon={Bell}
            color="#ea580c"
            label={t('profile.notifications')}
            value={t('profile.notificationsSettings')}
            onPress={() => Linking.openSettings()}
          />
        </ListGroup>

        <ListGroup title={t('profile.support')}>
          <ListRow icon={LifeBuoy} color="#0891b2" label={t('profile.help')} soon={t('common.soon')} />
          <ListRow icon={Info} color="#475569" label={t('profile.about')} value={APP_VERSION} />
        </ListGroup>

        <Button label={t('profile.signOut')} icon={LogOut} variant="danger" onPress={confirmSignOut} />
      </ScrollView>
    </View>
  );
}
