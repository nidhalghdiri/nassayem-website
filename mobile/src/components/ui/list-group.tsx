import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, type ReactNode } from 'react';
import { I18nManager, Pressable, View } from 'react-native';

import { colors, tint } from '@/lib/theme';

import { Card } from './card';
import { Text } from './text';

/** A titled group of rows, settings-style. */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View className="gap-2">
      {title ? (
        <Text weight="semibold" className="px-1 text-xs uppercase tracking-wide text-muted">
          {title}
        </Text>
      ) : null}
      <Card className="p-0">
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View className="ms-16 h-px bg-border" /> : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

/** One row: tinted icon, label, then a value, a "Soon" pill or a chevron. */
export function ListRow({
  icon: Icon,
  color = colors.brand,
  label,
  value,
  soon,
  right,
  danger,
  onPress,
}: {
  icon: LucideIcon;
  color?: string;
  label: string;
  value?: string;
  soon?: string;
  right?: ReactNode;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 px-4 py-2.5 active:bg-background">
      <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: tint(color) }}>
        <Icon size={18} color={color} />
      </View>
      <Text weight="medium" className={`flex-1 ${danger ? 'text-danger' : ''}`}>
        {label}
      </Text>
      {right}
      {value ? <Text className="text-sm text-muted">{value}</Text> : null}
      {soon ? <SoonPill label={soon} /> : null}
      {onPress && !soon && !right ? (
        <ChevronRight size={18} color={colors.faint} style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
      ) : null}
    </Pressable>
  );
}

export function SoonPill({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <View className={`rounded-full bg-amber-100 ${small ? 'px-1.5 py-px' : 'px-2 py-0.5'}`}>
      <Text weight="semibold" className="text-amber-700" style={{ fontSize: small ? 9 : 11 }}>
        {label}
      </Text>
    </View>
  );
}
