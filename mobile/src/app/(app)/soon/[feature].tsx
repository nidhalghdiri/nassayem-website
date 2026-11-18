import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ComingSoon } from '@/components/coming-soon';
import { isSoonFeature } from '@/lib/features';

export default function ComingSoonScreen() {
  const { t } = useTranslation();
  const { feature } = useLocalSearchParams<{ feature: string }>();
  if (!isSoonFeature(feature)) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ title: t(`features.${feature}.title`) }} />
      <ComingSoon feature={feature} />
    </>
  );
}
