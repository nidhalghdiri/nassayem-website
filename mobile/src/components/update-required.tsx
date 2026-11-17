import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';

export function UpdateRequired() {
  const { t } = useTranslation();
  return (
    <Screen scroll={false} safeTop className="items-center justify-center gap-4">
      <Image source={require('@/assets/images/logo.png')} style={{ width: 140, height: 140 }} contentFit="contain" />
      <View className="items-center gap-2">
        <Text weight="bold" className="text-center text-xl">
          {t('update.title')}
        </Text>
        <Text className="text-center text-muted">{t('update.body')}</Text>
      </View>
    </Screen>
  );
}
