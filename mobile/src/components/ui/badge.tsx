import { View } from 'react-native';

import { Text } from './text';

/**
 * Small coloured label. `className` takes Tailwind background + text colour
 * classes — the same strings the website's shared configs use, e.g.
 * STAFF_ROLE_CONFIG[role].badge = "bg-purple-100 text-purple-700".
 */
export function Badge({ label, className }: { label: string; className?: string }) {
  const classes = className ?? 'bg-brand-50 text-brand';
  const background = classes.split(' ').filter((c) => c.startsWith('bg-')).join(' ');
  const text = classes.split(' ').filter((c) => c.startsWith('text-')).join(' ');
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${background}`}>
      <Text weight="medium" className={`text-xs ${text}`}>
        {label}
      </Text>
    </View>
  );
}
