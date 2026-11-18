import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './card';
import { Text } from './text';

/** A titled card on a detail screen. */
export function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text weight="semibold" className="text-base">
          {title}
        </Text>
        {right}
      </View>
      {children}
    </Card>
  );
}
