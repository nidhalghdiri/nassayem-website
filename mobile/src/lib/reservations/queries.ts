import { useQuery } from '@tanstack/react-query';

import { fetchTodayMovements } from '@/lib/api/reservations';

export function useTodayMovements(enabled = true) {
  return useQuery({
    queryKey: ['reservations', 'today'],
    queryFn: fetchTodayMovements,
    enabled,
    // NetSuite is slow and the server caches for a minute anyway.
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
