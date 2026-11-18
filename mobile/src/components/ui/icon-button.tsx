import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { colors, shadow } from '@/lib/theme';

type Variant = 'plain' | 'light';

/** Round icon-only button: `plain` on light backgrounds, `light` on the brand colour. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = 'plain',
  dot = false,
}: {
  icon: LucideIcon;
  /** Read by screen readers. */
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** A small dot in the corner, e.g. unread notifications. */
  dot?: boolean;
}) {
  const light = variant === 'light';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      className={`h-11 w-11 items-center justify-center rounded-full ${light ? 'bg-white/15 active:bg-white/25' : 'bg-surface active:bg-brand-50'}`}
      style={light ? undefined : shadow.card}>
      <Icon size={21} color={light ? '#ffffff' : colors.ink} />
      {dot ? (
        <View
          className={`absolute end-2.5 top-2.5 h-2.5 w-2.5 rounded-full border-2 bg-orange-500 ${light ? 'border-brand' : 'border-surface'}`}
        />
      ) : null}
    </Pressable>
  );
}
