import { useQuery } from '@tanstack/react-query';

import { isReviewMode } from '@/review/reviewMode';
import { sampleLastSessions, sampleWorkouts } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';

/** GET /workouts. */
export type WorkoutSummary = {
  id: string;
  split_day_id: string | null;
  title: string;
  started_at: string;
  ended_at: string | null;
  bodyweight_kg: number;
};

/** GET /workouts/last-sessions: last time (ghost) for one exercise. */
export type LastSession = {
  exercise_id: string;
  workout_id: string;
  title: string;
  started_at: string;
  ended_at: string;
  bodyweight_kg: number;
  sets: { set_number: number; weight_kg: number; reps: number }[];
};

export const WORKOUTS_KEY = ['workouts'] as const;

/** The user's workouts, cached for offline use (Today needs the last one done per day). */
export function useWorkouts() {
  const { request } = useSync();
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: WORKOUTS_KEY,
    queryFn: () => request<WorkoutSummary[]>('GET', '/workouts'),
    meta: { persist: true },
    enabled: signedIn && !isReviewMode,
    initialData: isReviewMode ? sampleWorkouts : undefined,
  });
}

/** Last time for each exercise, cached for offline use. */
export function useLastSessions(exerciseIds: readonly string[]) {
  const { request } = useSync();
  const { signedIn } = useAuth();
  const ids = [...exerciseIds].sort();
  return useQuery({
    queryKey: ['last-sessions', ...ids],
    queryFn: () => {
      const query = ids.map((id) => `exercise_id=${encodeURIComponent(id)}`).join('&');
      return request<LastSession[]>('GET', `/workouts/last-sessions?${query}`);
    },
    meta: { persist: true },
    enabled: signedIn && ids.length > 0 && !isReviewMode,
    initialData: isReviewMode ? sampleLastSessions : undefined,
  });
}
