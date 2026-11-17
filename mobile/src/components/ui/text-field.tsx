import { forwardRef, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, TextInput, View, type TextInputProps } from 'react-native';

import { fontFamily } from '@/lib/fonts';

import { Text } from './text';

type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
};

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, style, ...props },
  ref,
) {
  const { i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  return (
    <View className="gap-1.5">
      <Text weight="medium" className="text-sm text-muted">
        {label}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor="#9aa8a9"
        className={`min-h-12 rounded-xl border bg-surface px-4 text-base text-ink ${error ? 'border-danger' : 'border-border focus:border-brand'}`}
        style={[
          {
            fontFamily: fontFamily(language, 'regular'),
            // iOS does not flip input alignment by itself in RTL.
            textAlign: I18nManager.isRTL ? 'right' : 'left',
          },
          style,
        ]}
        {...props}
      />
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
});
