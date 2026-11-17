import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/lib/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network blips, but not answers that will not change (401, 403, 404…).
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof ApiError) || ['NETWORK', 'SERVER'].includes(error.code)),
    },
    mutations: { retry: false },
  },
});

// Refetch stale data when the app comes back to the foreground.
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

// TanStack assumes "online" on React Native; queries still fail fast with NETWORK.
onlineManager.setOnline(true);
