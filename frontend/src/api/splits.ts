import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Preset, SplitDraft, SplitTree } from '@/features/splits/draft';
import { planSplitWrites } from '@/features/splits/plan';
import type { Exercise } from '@/lib/exercises';
import { newId } from '@/lib/ids';
import { isReviewMode } from '@/review/reviewMode';
import { samplePresets, sampleExercises } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';
import { applySettings, settingsBody } from './settings';

export const PRESETS_KEY = ['presets'] as const;
export const EXERCISES_KEY = ['exercises'] as const;
export const splitKey = (id: string) => ['splits', id] as const;

/** Split presets (03). Public, so onboarding can show them before the account exists. */
export function usePresets() {
  const { request } = useSync();
  return useQuery({
    queryKey: PRESETS_KEY,
    queryFn: () => request<Preset[]>('GET', '/presets'),
    meta: { persist: true },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: !isReviewMode,
    initialData: isReviewMode ? samplePresets : undefined,
  });
}

/** The exercise library, plus the user's custom exercises once signed in. Custom exercises
 * created on the phone stay in the list until the server has them. */
export function useExercises() {
  const { request, outbox } = useSync();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: EXERCISES_KEY,
    queryFn: async () => {
      const server = await request<Exercise[]>('GET', '/exercises');
      const pending = new Set(
        outbox.pendingPaths().filter((p) => p.startsWith('/exercises/')).map((p) => p.slice('/exercises/'.length)),
      );
      const local = queryClient.getQueryData<Exercise[]>(EXERCISES_KEY) ?? [];
      const unsent = local.filter((e) => pending.has(e.id) && !server.some((s) => s.id === e.id));
      return [...server, ...unsent];
    },
    meta: { persist: true },
    enabled: !isReviewMode,
    initialData: isReviewMode ? sampleExercises : undefined,
  });
}

export type NewExercise = Pick<Exercise, 'name' | 'primary_muscle' | 'kind'>;

/** Creates a custom exercise: in the list at once, sent through the outbox. */
export function useCreateExercise() {
  const queryClient = useQueryClient();
  const { write } = useSync();
  return async (fields: NewExercise): Promise<Exercise> => {
    const exercise: Exercise = {
      id: newId(),
      name: fields.name.trim(),
      primary_muscle: fields.primary_muscle,
      muscle_group: fields.primary_muscle,
      secondary_muscles: [],
      equipment: fields.kind === 'bodyweight' ? 'body only' : null,
      kind: fields.kind,
      is_custom: true,
    };
    queryClient.setQueryData<Exercise[]>(EXERCISES_KEY, (old = []) => [...old, exercise]);
    await write({
      method: 'PUT',
      path: `/exercises/${exercise.id}`,
      body: {
        name: exercise.name,
        primary_muscle: exercise.primary_muscle,
        secondary_muscles: [],
        equipment: exercise.equipment,
        kind: exercise.kind,
      },
    });
    return exercise;
  };
}

/** A saved split with its days and exercises. While edits to splits are still waiting in the
 * outbox, the copy on the phone wins over the server's. */
export function useSplitTree(splitId: string | null | undefined) {
  const { request, outbox } = useSync();
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: splitKey(splitId ?? 'none'),
    queryFn: async () => {
      const local = queryClient.getQueryData<SplitTree>(splitKey(splitId!));
      if (local && outbox.hasPendingUnder('/split')) return local;
      return request<SplitTree>('GET', `/splits/${splitId}`);
    },
    meta: { persist: true },
    enabled: !!splitId && signedIn && !isReviewMode,
  });
}

export function treeFromDraft(draft: SplitDraft): SplitTree {
  return {
    id: draft.id,
    name: draft.name.trim(),
    repeat_mode: draft.repeatMode,
    days: draft.days.map((day) => ({
      id: day.id,
      name: day.name.trim(),
      weekday: day.weekday,
      exercises: day.exercises.map((e) => ({ id: e.id, exercise_id: e.exerciseId, rest_seconds: e.restSeconds })),
    })),
  };
}

/** "Save split": writes what changed, makes it the active split, and updates the phone's
 * copy at once. Works offline and before the account exists, like every write. */
export function useSaveSplit() {
  const queryClient = useQueryClient();
  const { write } = useSync();
  return async (original: SplitDraft | null, draft: SplitDraft) => {
    for (const entry of planSplitWrites(original, draft)) await write(entry);
    queryClient.setQueryData(splitKey(draft.id), treeFromDraft(draft));
    const settings = applySettings(queryClient, {});
    if (settings.active_split_id !== draft.id) {
      const next = applySettings(queryClient, { active_split_id: draft.id });
      await write({ method: 'PUT', path: '/settings', body: settingsBody(next) });
    }
  };
}
