import { z } from 'zod';

import { apiRequest } from './client';

const MovementCount = z.object({ total: z.number(), done: z.number() });

export const TodayMovementsSchema = z.object({
  date: z.string(),
  checkIns: MovementCount,
  checkOuts: MovementCount,
});
export type TodayMovements = z.infer<typeof TodayMovementsSchema>;

/** Today's check-ins and check-outs (from NetSuite) for the user's buildings. */
export function fetchTodayMovements() {
  return apiRequest('/reservations/today', { schema: TodayMovementsSchema });
}
