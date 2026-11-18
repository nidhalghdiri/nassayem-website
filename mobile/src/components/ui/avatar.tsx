import { View } from 'react-native';

import { Text } from './text';

/** "Nidhal Ghdiri" → "NG"; falls back to the email's first letter. */
export function initials(name: string | null | undefined, fallback = '?'): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback.charAt(0).toUpperCase();
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/** Initials in a circle. `onBrand` for use on the teal background. */
export function Avatar({
  name,
  fallback,
  size = 44,
  onBrand = false,
}: {
  name: string | null | undefined;
  fallback?: string;
  size?: number;
  onBrand?: boolean;
}) {
  return (
    <View
      className={`items-center justify-center rounded-full ${onBrand ? 'bg-white/20' : 'bg-brand-100'}`}
      style={{ width: size, height: size }}>
      <Text weight="bold" className={onBrand ? 'text-white' : 'text-brand-dark'} style={{ fontSize: size * 0.38 }}>
        {initials(name, fallback)}
      </Text>
    </View>
  );
}
