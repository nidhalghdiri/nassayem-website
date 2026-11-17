import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenProps = {
  children: ReactNode;
  /** Wrap the content in a ScrollView (default true). */
  scroll?: boolean;
  /** Pad the top for the status bar — for screens without a header. */
  safeTop?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
};

/** Page container: background, padding, safe areas and pull-to-refresh. */
export function Screen({ children, scroll = true, safeTop = false, refreshing, onRefresh, className }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: safeTop ? insets.top + 16 : 16, paddingBottom: insets.bottom + 24 };

  if (!scroll) {
    return (
      <View className={`flex-1 bg-background px-4 ${className ?? ''}`} style={padding}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName={`gap-4 px-4 ${className ?? ''}`}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#2a7475" colors={['#2a7475']} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  );
}
