import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { buildingLabel } from '@shared/buildingLabel';
import { STAFF_ROLE_CONFIG } from '@shared/tasks/constants';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/states';
import { Text } from '@/components/ui/text';
import { useCurrentUser, useSession } from '@/lib/auth/session';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const user = useCurrentUser();
  const { refreshUser } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const isEn = i18n.language !== 'ar';
  const role = STAFF_ROLE_CONFIG[user.role];

  async function onRefresh() {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  }

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={onRefresh}>
      <View className="gap-2">
        <Text weight="bold" className="text-2xl">
          {t('home.greeting', { name: user.name || user.email })}
        </Text>
        <Badge label={isEn ? role.labelEn : role.labelAr} className={role.badge} />
      </View>

      {user.role === 'RECEPTIONIST' ? (
        <Card className="gap-3">
          <Text weight="semibold">{t('home.buildings')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {user.buildings.map((b) => (
              <Badge key={b.id} label={buildingLabel(b, isEn)} />
            ))}
          </View>
        </Card>
      ) : null}

      {user.modules.length === 0 ? <EmptyState message={t('home.noModules')} /> : null}
    </Screen>
  );
}
