import { useTranslation } from 'react-i18next';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fontFamily, type FontWeight } from '@/lib/fonts';

export type TextProps = RNTextProps & {
  className?: string;
  weight?: FontWeight;
};

/**
 * App text: picks Inter or Tajawal for the current language and weight.
 * Use Tailwind classes for size and colour (`text-sm text-muted`), and the
 * `weight` prop instead of `font-bold`.
 */
export function Text({ weight = 'regular', className, style, ...props }: TextProps) {
  const { i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  return (
    <RNText
      className={`text-base text-ink text-start ${className ?? ''}`}
      style={[{ fontFamily: fontFamily(language, weight) }, style]}
      {...props}
    />
  );
}
