import type { ViewStyle } from 'react-native';

/**
 * Hex values of the theme in global.css, for places that need a colour value
 * rather than a class (icons, navigation options, RefreshControl).
 */
export const colors = {
  brand: '#2a7475',
  brandLight: '#3b9293',
  brandDark: '#1d5455',
  brand50: '#eef7f7',
  surface: '#ffffff',
  background: '#f5f7f7',
  border: '#e3e8e8',
  ink: '#1b2626',
  muted: '#66797a',
  faint: '#9aa8a9',
  danger: '#c2410c',
  success: '#15803d',
  warning: '#b45309',
} as const;

/** Soft elevation for cards and floating elements. */
export const shadow = {
  card: { boxShadow: '0px 1px 2px rgba(20, 50, 50, 0.05), 0px 6px 16px rgba(20, 50, 50, 0.06)' } satisfies ViewStyle,
  raised: { boxShadow: '0px 8px 24px rgba(20, 50, 50, 0.12)' } satisfies ViewStyle,
};

/** `#rrggbb` + alpha, for tinted icon backgrounds. */
export function tint(hex: string, alpha = 0.12): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}
