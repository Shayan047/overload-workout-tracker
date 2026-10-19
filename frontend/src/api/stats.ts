import { useQuery } from '@tanstack/react-query';

import { isReviewMode } from '@/review/reviewMode';
import { sampleExerciseStats, sampleFrontier, sampleOneWeight, sampleProgress } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';

// The stats endpoints (docs/api-and-sync.md, "Stats"). Computed on the server; cached on the
// phone so Progress and Exercise detail open offline with the last answer.

export type EstMaxPoint = { at: string; est_max_kg: number };
export type Plateau = { weeks_flat: number; best_kg: number; best_at: string };
type StatSet = { weight_kg: number; reps: number };

/** GET /stats/progress: one row of 13. */
export type ProgressItem = {
  exercise_id: string;
  includes_bodyweight: boolean;
  sessions: number;
  latest_at: string;
  est_max_kg: number;
  /** Latest against the first session in the window (0.76 = +76%). */
  change: number | null;
  is_new_best: boolean;
  plateau: Plateau | null;
  sparkline: EstMaxPoint[];
};

/** A point of the rep-weight frontier: the most reps at that weight (added weight for
 * bodyweight exercises), first reached `at`. */
export type FrontierPoint = { weight_kg: number; reps: number; at: string };

/** GET /stats/exercises/{id}: 14. */
export type ExerciseStats = {
  exercise_id: string;
  includes_bodyweight: boolean;
  est_max_kg: number | null;
  latest_at: string | null;
  first: EstMaxPoint | null;
  is_new_best: boolean;
  series: (EstMaxPoint & { workout_id: string; best_set: StatSet; sets: StatSet[] })[];
  weights: { weight_kg: number; sessions: number; first_at: string }[];
  best_set: (StatSet & { at: string }) | null;
  most_reps: (StatSet & { at: string }) | null;
  heaviest: { weight_kg: number; first_at: string } | null;
  plateau: Plateau | null;
  projection: (EstMaxPoint & { weekly_gain_kg: number; capped: boolean }) | null;
  /** Today's frontier, lightest first. */
  frontier: FrontierPoint[];
};

/** One session's sets at one weight, in the order they were done (15, 16). */
export type WeightSession = {
  workout_id: string;
  at: string;
  reps: number[];
  total: number;
  average: number;
  /** Last set's reps ÷ first set's (0.79 = 79%). Null under two sets. */
  retention: number | null;
};

/** GET /stats/exercises/{id}/weights/{weight_kg}: 15 and 16. Sessions oldest first. */
export type OneWeightStats = {
  exercise_id: string;
  weight_kg: number;
  sessions: WeightSession[];
  total_change: number | null;
  first_retention: number | null;
  latest_retention: number | null;
  /** When a heavier weight was first used, after this one. */
  moved_up_on: string | null;
};

export const PROGRESS_WEEKS = 8;

export function useProgress() {
  const { request } = useSync();
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: ['stats', 'progress', PROGRESS_WEEKS],
    queryFn: () => request<ProgressItem[]>('GET', `/stats/progress?weeks=${PROGRESS_WEEKS}`),
    meta: { persist: true },
    enabled: signedIn && !isReviewMode,
    initialData: isReviewMode ? sampleProgress : undefined,
  });
}

export function useExerciseStats(exerciseId: string | undefined) {
  const { request } = useSync();
  const { signedIn } = useAuth();
  return useQuery({
    queryKey: ['stats', 'exercise', exerciseId],
    queryFn: () => request<ExerciseStats>('GET', `/stats/exercises/${exerciseId}`),
    meta: { persist: true },
    enabled: signedIn && !!exerciseId && !isReviewMode,
    initialData: isReviewMode && exerciseId === sampleExerciseStats.exercise_id ? sampleExerciseStats : undefined,
  });
}

export function useOneWeightStats(exerciseId: string | undefined, weightKg: number | undefined) {
  const { request } = useSync();
  const { signedIn } = useAuth();
  const ready = !!exerciseId && weightKg !== undefined && Number.isFinite(weightKg);
  return useQuery({
    queryKey: ['stats', 'exercise', exerciseId, 'weight', weightKg],
    queryFn: () => request<OneWeightStats>('GET', `/stats/exercises/${exerciseId}/weights/${weightKg}`),
    meta: { persist: true },
    enabled: signedIn && ready && !isReviewMode,
    initialData: isReviewMode && ready ? sampleOneWeight(exerciseId, weightKg) : undefined,
  });
}

/** GET /stats/exercises/{id}/frontier?as_of=…: the frontier as it stood at `asOf` (17's
 * "Compare with"). Today's frontier comes with the exercise's stats. */
export function useFrontierAsOf(exerciseId: string | undefined, asOf: string | undefined) {
  const { request } = useSync();
  const { signedIn } = useAuth();
  const ready = !!exerciseId && !!asOf;
  return useQuery({
    queryKey: ['stats', 'exercise', exerciseId, 'frontier', asOf],
    queryFn: () =>
      request<{ points: FrontierPoint[] }>('GET', `/stats/exercises/${exerciseId}/frontier?as_of=${encodeURIComponent(asOf!)}`),
    meta: { persist: true },
    enabled: signedIn && ready && !isReviewMode,
    initialData: isReviewMode && ready ? sampleFrontier(exerciseId, asOf) : undefined,
  });
}
