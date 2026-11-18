import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { ComingSoon } from '@/components/coming-soon';

export default function MessagesScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-background">
      <AppHeader title={t('features.messages.title')} />
      <ComingSoon feature="messages" />
    </View>
  );
}
