import type { LucideIcon } from 'lucide-react-native';
import { AlertCircle, Inbox } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { ApiError } from '@/lib/api/client';

import { Button } from './button';
import { Text } from './text';

export function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator size="large" color="#2a7475" />
    </View>
  );
}

export function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: LucideIcon }) {
  return (
    <View className="items-center justify-center gap-3 px-6 py-16">
      <Icon size={40} color="#9aa8a9" />
      <Text className="text-center text-muted">{message}</Text>
    </View>
  );
}

/** Translated message for any error thrown by the API client. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown) => {
    if (!(error instanceof ApiError)) return t('errors.BAD_RESPONSE');
    // A business rule refused the action: the server's sentence says which one.
    if (error.code === 'REJECTED' && error.message !== 'REJECTED') return error.message;
    return t(`errors.${error.code}`);
  };
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  return (
    <View className="items-center justify-center gap-4 px-6 py-16">
      <AlertCircle size={40} color="#c2410c" />
      <Text className="text-center text-muted">{errorMessage(error)}</Text>
      {onRetry ? <Button label={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}
