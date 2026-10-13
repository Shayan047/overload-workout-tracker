import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { mergeLastSessions } from '@/features/workout/workout';

import { isReviewMode } from '@/review/reviewMode';
import { sampleLastSessions, sampleWorkouts } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';
import { type LastSession, withPendingWorkouts, type WorkoutSummary } from './pendingWrites';

export type { LastSession, WorkoutSummary } from './pendingWrites';

export const WORKOUTS_KEY = ['workouts'] as const;

/** The user's workouts, cached for offline use (Today needs the last one done per day). */
export function useWorkouts() {
  const { request, outbox } = useSync();
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: WORKOUTS_KEY,
    queryFn: async () => withPendingWorkouts(await request<WorkoutSummary[]>('GET', '/workouts'), outbox.entries),
    meta: { persist: true },
    enabled: signedIn && !isReviewMode,
    initialData: isReviewMode ? sampleWorkouts : undefined,
  });
}

/** Last time for `ids`, from every cached last-time query (offline-safe). */
export function cachedLastSessions(queryClient: QueryClient, ids: readonly string[]): LastSession[] | undefined {
  const wanted = new Set(ids);
  const known = queryClient
    .getQueriesData<LastSession[]>({ queryKey: ['last-sessions'] })
    .flatMap(([, data]) => data ?? [])
    .filter((s) => wanted.has(s.exercise_id));
  return known.length ? mergeLastSessions([], known) : undefined;
}

/** Last time for each exercise, cached for offline use. */
export function useLastSessions(exerciseIds: readonly string[]) {
  const { request, outbox } = useSync();
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  const ids = [...exerciseIds].sort();
  const queryKey = ['last-sessions', ...ids];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const query = ids.map((id) => `exercise_id=${encodeURIComponent(id)}`).join('&');
      const server = await request<LastSession[]>('GET', `/workouts/last-sessions?${query}`);
      // A workout finished on the phone but not sent yet is newer than what the server knows.
      if (!outbox.hasPendingUnder('/workouts/') && !outbox.hasPendingUnder('/sets/')) return server;
      return mergeLastSessions(server, queryClient.getQueryData<LastSession[]>(queryKey) ?? []);
    },
    meta: { persist: true },
    enabled: signedIn && ids.length > 0 && !isReviewMode,
    // A new set of exercises (a swap, an added exercise, another day) starts from what other
    // cached queries know, so last time shows offline; it's refreshed right away when online.
    initialData: isReviewMode ? sampleLastSessions : () => cachedLastSessions(queryClient, ids),
    initialDataUpdatedAt: 0,
  });
}
