import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';

import { mergeLastSessions } from '@/features/workout/workout';

import { isReviewMode } from '@/review/reviewMode';
import { sampleLastSessions, sampleWorkoutDetail, sampleWorkouts } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';
import { HISTORY_KEY } from './history';
import type { OutboxEntry } from './outbox';
import {
  type LastSession,
  type WorkoutDetail,
  type WorkoutHistoryItem,
  withPendingDetail,
  withPendingWorkouts,
  type WorkoutSummary,
} from './pendingWrites';

export type { LastSession, WorkoutDetail, WorkoutSummary } from './pendingWrites';

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

export const workoutDetailKey = (id: string) => ['workouts', 'detail', id] as const;

/** A past workout with its exercises and sets (21), cached for offline use, with the writes
 * still on the phone applied. Offline, it's the cached copy; a workout the server hasn't
 * received yet is built from the outbox and its History entry. */
export function useWorkoutDetail(id: string) {
  const { request, outbox } = useSync();
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: workoutDetailKey(id),
    queryFn: async () => {
      const summary = queryClient.getQueryData<WorkoutHistoryItem[]>(HISTORY_KEY)?.find((w) => w.id === id) ?? null;
      let server: WorkoutDetail | null;
      try {
        server = await request<WorkoutDetail>('GET', `/workouts/${id}`);
      } catch (error) {
        // Not on the server yet (404), or no connection: start from what the phone knows.
        server = queryClient.getQueryData<WorkoutDetail | null>(workoutDetailKey(id)) ?? null;
        if (!server && !summary) throw error;
      }
      return withPendingDetail(server, summary, outbox.entries);
    },
    meta: { persist: true },
    enabled: signedIn && !isReviewMode,
    initialData: isReviewMode ? sampleWorkoutDetail(id) : undefined,
  });
}

type Write = Pick<OutboxEntry, 'method' | 'path' | 'body'>;

/** Saving an edit to a past workout (22) or deleting it: the writes go to the outbox, and the
 * phone's copies of the workout, History and last time change at once. Stats come from the
 * server, so they're marked stale. */
export function useWorkoutEdits() {
  const { write } = useSync();
  const queryClient = useQueryClient();

  // Stale, not refetched now: a refetch could beat the writes to the server. Screens that
  // show stats fetch them again when they next open.
  const refreshStats = () => void queryClient.invalidateQueries({ queryKey: ['stats'], refetchType: 'none' });
  const patchLastSessions = (workoutId: string, change: (s: LastSession) => LastSession | null) => {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['last-sessions'] })) {
      queryClient.setQueryData<LastSession[]>(query.queryKey, (old) =>
        old?.flatMap((s) => (s.workout_id === workoutId ? (change(s) ?? []) : [s])),
      );
    }
  };

  return {
    async save(detail: WorkoutDetail, writes: readonly Write[]) {
      if (!writes.length) return;
      if (!isReviewMode) for (const entry of writes) await write(entry);
      const entries = writes.map((w, i) => ({ ...w, id: `edit-${i}`, createdAt: '' }));
      const next = withPendingDetail(detail, null, entries);
      if (!next) return;
      queryClient.setQueryData(workoutDetailKey(detail.id), next);
      const sets = next.exercises.reduce((total, r) => total + r.sets.length, 0);
      queryClient.setQueryData<WorkoutHistoryItem[]>(HISTORY_KEY, (old) =>
        old?.map((w) => (w.id === detail.id ? { ...w, sets } : w)),
      );
      patchLastSessions(detail.id, (s) => {
        const row = next.exercises.find((r) => r.exercise_id === s.exercise_id && r.sets.length);
        return row ? { ...s, sets: row.sets.map(({ set_number, weight_kg, reps }) => ({ set_number, weight_kg, reps })) } : null;
      });
      refreshStats();
    },

    async remove(workoutId: string) {
      if (!isReviewMode) await write({ method: 'DELETE', path: `/workouts/${workoutId}` });
      queryClient.setQueryData<WorkoutHistoryItem[]>(HISTORY_KEY, (old) => old?.filter((w) => w.id !== workoutId));
      queryClient.setQueryData<WorkoutSummary[]>(WORKOUTS_KEY, (old) => old?.filter((w) => w.id !== workoutId));
      queryClient.removeQueries({ queryKey: workoutDetailKey(workoutId) });
      patchLastSessions(workoutId, () => null);
      refreshStats();
    },
  };
}
