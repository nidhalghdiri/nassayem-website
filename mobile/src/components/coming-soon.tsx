import { Construction } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { FEATURES, type SoonFeature } from '@/lib/features';
import { tint } from '@/lib/theme';

/** Placeholder page for a feature that is planned but not built yet. */
export function ComingSoon({ feature }: { feature: SoonFeature }) {
  const { t } = useTranslation();
  const { icon: Icon, color } = FEATURES[feature];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 px-4 pb-10 pt-4">
      <Card className="items-center gap-4 px-6 py-10">
        <View className="h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: tint(color, 0.1) }}>
          <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: tint(color, 0.18) }}>
            <Icon size={32} color={color} />
          </View>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1">
          <Construction size={14} color="#b45309" />
          <Text weight="semibold" className="text-xs text-amber-700">
            {t('soon.badge')}
          </Text>
        </View>
        <Text weight="bold" className="text-center text-2xl">
          {t(`features.${feature}.title`)}
        </Text>
        <Text className="text-center leading-6 text-muted">{t(`features.${feature}.description`)}</Text>
        <Text className="text-center text-sm text-muted">{t('soon.body')}</Text>
      </Card>

      {/* A faded sketch of the future screen. */}
      <View className="gap-3 opacity-60" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0.9, 0.7, 0.8].map((w, index) => (
          <Card key={index} className="flex-row items-center gap-3">
            <View className="h-11 w-11 rounded-xl" style={{ backgroundColor: tint(color, 0.12) }} />
            <View className="flex-1 gap-2">
              <View className="h-3 rounded-full bg-border" style={{ width: `${w * 100}%` }} />
              <View className="h-2.5 rounded-full bg-border/70" style={{ width: `${w * 55}%` }} />
            </View>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
