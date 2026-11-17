import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-brand active:bg-brand-dark',
  secondary: 'bg-surface border border-border active:bg-background',
  danger: 'bg-surface border border-danger/40 active:bg-danger/10',
  ghost: 'active:bg-brand-50',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  danger: 'text-danger',
  ghost: 'text-brand',
};

const ICON_COLOR: Record<Variant, string> = {
  primary: '#ffffff',
  secondary: '#1b2626',
  danger: '#c2410c',
  ghost: '#2a7475',
};

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: LucideIcon;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  icon: Icon,
  className,
  ...props
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 ${CONTAINER[variant]} ${inactive ? 'opacity-60' : ''} ${className ?? ''}`}
      {...props}>
      {loading ? (
        <ActivityIndicator color={ICON_COLOR[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {Icon ? <Icon size={18} color={ICON_COLOR[variant]} /> : null}
          <Text weight="semibold" className={LABEL[variant]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
