import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { isReviewMode } from '@/review/reviewMode';
import { sampleHistory } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';
import { pendingWorkoutIds, withPendingHistory, type WorkoutHistoryItem, type WorkoutSummary } from './pendingWrites';

export type { WorkoutHistoryItem } from './pendingWrites';

export const HISTORY_KEY = ['workouts', 'history'] as const;

/** Finished workouts for History (18), newest first, cached for offline use. Workouts the
 * server hasn't received yet keep the recap the phone made when they finished. */
export function useWorkoutHistory() {
  const { request, outbox } = useSync();
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: HISTORY_KEY,
    queryFn: async () =>
      withPendingHistory(
        await request<WorkoutHistoryItem[]>('GET', '/workouts/history'),
        queryClient.getQueryData<WorkoutHistoryItem[]>(HISTORY_KEY) ?? [],
        outbox.entries,
      ),
    meta: { persist: true },
    enabled: signedIn && !isReviewMode,
    initialData: isReviewMode ? sampleHistory.workouts : undefined,
  });
}

/** Puts a workout finished on the phone into the cached history, with its summary's sets
 * and "ahead on N of M", so History shows it at once and offline. */
export function cacheHistoryRecap(
  queryClient: QueryClient,
  workout: WorkoutSummary,
  recap: { sets: number; ahead: number; compared: number },
) {
  queryClient.setQueryData<WorkoutHistoryItem[]>(HISTORY_KEY, (old = []) =>
    [{ ...workout, ...recap }, ...old.filter((w) => w.id !== workout.id)].sort((a, b) =>
      b.started_at.localeCompare(a.started_at),
    ),
  );
}

/** Workouts with writes still on the phone ("Waiting for Wi-Fi" on 18, "2 workouts waiting"
 * on 19). The sync context changes with every outbox change, so this stays current. */
export function usePendingWorkoutIds(): Set<string> {
  const { outbox } = useSync();
  return isReviewMode ? new Set(sampleHistory.pendingIds) : pendingWorkoutIds(outbox.entries);
}
