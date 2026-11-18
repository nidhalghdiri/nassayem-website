import { View, type ViewProps } from 'react-native';

import { shadow } from '@/lib/theme';

export function Card({ className, style, ...props }: ViewProps & { className?: string }) {
  return <View className={`rounded-2xl bg-surface p-4 ${className ?? ''}`} style={[shadow.card, style]} {...props} />;
}
