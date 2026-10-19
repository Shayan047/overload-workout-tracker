// Every change to the workout in progress: the new state is saved on the phone first, then
// its writes go to the outbox, so logging works the same with or without a connection.

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSync } from '@/api/AppProviders';
import { BODYWEIGHT_KEY, type BodyweightEntry } from '@/api/bodyweight';
import { cacheHistoryRecap } from '@/api/history';
import { cachedLastSessions, type LastSession, WORKOUTS_KEY, type WorkoutSummary } from '@/api/workouts';
import { useExercises } from '@/api/splits';
import { todayOverride } from '@/features/today/overrideStore';
import { newId } from '@/lib/ids';
import { isReviewMode, now } from '@/review/reviewMode';

import {
  addExercisesToWorkout,
  addRow,
  currentExercise,
  deleteSet,
  finishWorkout,
  logSet,
  markDone,
  mergeLastSessions,
  moveToEnd,
  restoreExercise,
  sessionsFrom,
  skipExercise,
  startWorkout,
  swapExercise,
  updateRow,
  type Write,
} from './workout';
import { finishedWorkout } from './finishedStore';
import { adjustRest, startRest } from './rest';
import { bestsAfter, type Summary, summarize } from './summary';
import { activeWorkout, inProgress, type Saved } from './workoutStore';

type Day = { id: string; name: string; exercises: { exercise_id: string; rest_seconds: number }[] };

/** The bodyweight to copy into a new workout (rule 3): the latest entry on the phone, else
 * the last workout's copy, else none (the server then uses its latest entry). */
function latestBodyweightKg(queryClient: QueryClient): number | null {
  const entries = queryClient.getQueryData<BodyweightEntry[]>(BODYWEIGHT_KEY) ?? [];
  const entry = [...entries].sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0];
  if (entry) return entry.weight_kg;
  const workouts = queryClient.getQueryData<WorkoutSummary[]>(WORKOUTS_KEY) ?? [];
  const last = [...workouts].sort((a, b) => b.started_at.localeCompare(a.started_at)).find((w) => w.bodyweight_kg > 0);
  return last?.bodyweight_kg ?? null;
}

/** A finished workout, put into the cached history and last-time data, so Today moves on to
 * the next day and the next ghost is right, even before the server has it. */
function cacheFinished(queryClient: QueryClient, workout: WorkoutSummary, sessions: LastSession[], summary: Summary) {
  queryClient.setQueryData<WorkoutSummary[]>(WORKOUTS_KEY, (old = []) => [
    ...old.filter((w) => w.id !== workout.id),
    workout,
  ]);
  cacheHistoryRecap(queryClient, workout, { sets: summary.sets, ahead: summary.ahead, compared: summary.compared });
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['last-sessions'] })) {
    const ids = new Set(query.queryKey.slice(1));
    const done = sessions.filter((s) => ids.has(s.exercise_id));
    if (done.length) {
      queryClient.setQueryData<LastSession[]>(query.queryKey, (old = []) => mergeLastSessions(old, done));
    }
  }
}

export function useWorkoutActions() {
  const { write } = useSync();
  const queryClient = useQueryClient();
  const exercises = useExercises();
  // A string, so the actions only change when the list does.
  const bodyweightKey = (exercises.data ?? []).filter((e) => e.kind === 'bodyweight').map((e) => e.id).join(',');

  return useMemo(() => {
    const commit = async (next: Saved | null, writes: Write[]) => {
      const saved = activeWorkout.set(next);
      if (!isReviewMode) for (const entry of writes) await write(entry);
      await saved;
    };
    const require = (): Saved => {
      const saved = inProgress(activeWorkout.get());
      if (!saved) throw new Error('No workout in progress');
      return saved;
    };

    return {
      /** Starts `day` as today's workout. */
      start(day: Day) {
        const { state, writes } = startWorkout(day, {
          bodyweightKg: latestBodyweightKg(queryClient),
          now: now(),
          makeId: newId,
        });
        return commit({ state, focusId: null }, writes);
      },

      /** Logs a new set, or edits one with `setId`. Completing the planned sets marks the
       * exercise done, and the next one comes up. A new set starts the rest timer with the
       * exercise's rest length. */
      logSet(input: { rowId: string; setId?: string; weightKg: number; reps: number; plannedSets?: number }) {
        const saved = require();
        const { state, writes } = logSet(saved.state, { ...input, now: now(), makeId: newId });
        const row = state.exercises.find((e) => e.id === input.rowId);
        const focusId = row?.status === 'done' && saved.focusId === input.rowId ? null : saved.focusId;
        const rest = !input.setId && row && row.rest_seconds > 0 ? startRest(row.id, row.rest_seconds, now()) : saved.rest;
        return commit({ state, focusId, rest }, writes);
      },

      /** −15 / +15 on the rest timer. */
      adjustRest(deltaSeconds: number) {
        const saved = require();
        if (!saved.rest) return Promise.resolve();
        return commit({ ...saved, rest: adjustRest(saved.rest, deltaSeconds, now()) }, []);
      },

      skipRest() {
        const saved = require();
        return commit({ ...saved, rest: null }, []);
      },

      deleteSet(setId: string) {
        const saved = require();
        const { state, writes } = deleteSet(saved.state, setId);
        return commit({ ...saved, state }, writes);
      },

      /** "Add set": one more empty row for the exercise. */
      addRow(rowId: string) {
        const saved = require();
        return commit({ ...saved, state: addRow(saved.state, rowId) }, []);
      },

      /** Moves to another exercise. The one being left counts as done if it has sets. */
      focus(rowId: string) {
        const saved = require();
        const leaving = currentExercise(saved.state, { focusId: saved.focusId });
        let state = saved.state;
        const writes: Write[] = [];
        if (leaving && leaving.id !== rowId && leaving.status === 'planned' && state.sets.some((s) => s.workout_exercise_id === leaving.id)) {
          const result = updateRow(state, { ...leaving, status: 'done' });
          state = result.state;
          writes.push(...result.writes);
        }
        const target = state.exercises.find((e) => e.id === rowId);
        if (target?.status === 'done') {
          // Going back to a finished exercise to add or fix a set.
          const result = updateRow(state, { ...target, status: 'planned' });
          state = result.state;
          writes.push(...result.writes);
        }
        return commit({ ...saved, state, focusId: rowId }, writes);
      },

      // Today-only changes (10). The exercise in focus loses focus when it's changed, so the
      // next planned one comes up.
      swap(rowId: string, exerciseId: string) {
        const saved = require();
        const { state, writes } = swapExercise(saved.state, rowId, exerciseId);
        return commit({ ...saved, state }, writes);
      },
      skip(rowId: string) {
        const saved = require();
        const { state, writes } = skipExercise(saved.state, rowId);
        return commit({ ...saved, state, focusId: saved.focusId === rowId ? null : saved.focusId }, writes);
      },
      restore(rowId: string) {
        const saved = require();
        const { state, writes } = restoreExercise(saved.state, rowId);
        return commit({ ...saved, state }, writes);
      },
      moveToEnd(rowId: string) {
        const saved = require();
        const { state, writes } = moveToEnd(saved.state, rowId);
        return commit({ ...saved, state, focusId: saved.focusId === rowId ? null : saved.focusId }, writes);
      },
      /** "Done for today": stops an exercise with the sets logged so far. */
      markDone(rowId: string) {
        const saved = require();
        const { state, writes } = markDone(saved.state, rowId);
        return commit({ ...saved, state, focusId: saved.focusId === rowId ? null : saved.focusId }, writes);
      },
      add(exerciseIds: readonly string[]) {
        const saved = require();
        const { state, writes } = addExercisesToWorkout(saved.state, exerciseIds, newId);
        return commit({ ...saved, state }, writes);
      },

      /** Finishes the workout: saved as done on the phone and in the outbox, its summary
       * worked out against last time as it stood before, the cached history and last-time
       * data updated, and "Do a different day" cleared. */
      async finish(): Promise<Summary> {
        const saved = require();
        const { workout, writes } = finishWorkout(saved.state, now());
        const bodyweightKg = workout.bodyweight_kg ?? latestBodyweightKg(queryClient) ?? 0;
        const state = { ...saved.state, workout: { ...saved.state.workout, bodyweight_kg: bodyweightKg } };
        const ids = state.exercises.map((e) => e.exercise_id);
        const before = isReviewMode ? [] : (cachedLastSessions(queryClient, ids) ?? []);
        const bodyweightIds = new Set(bodyweightKey.split(',').filter((id) => ids.includes(id)));
        const summary = summarize(state, workout.ended_at, before, bodyweightIds);
        if (!isReviewMode) {
          const best = bestsAfter(summary);
          const sessions = sessionsFrom(state, workout.ended_at, bodyweightKg).map((s) => ({
            ...s,
            best_est_max_kg: best.get(s.exercise_id) ?? null,
          }));
          cacheFinished(queryClient, { ...workout, bodyweight_kg: bodyweightKg }, sessions, summary);
        }
        todayOverride.set('', null);
        finishedWorkout.set(summary);
        await commit(null, writes);
        return summary;
      },

      /** Throws the workout away (finishing with no sets logged). */
      discard() {
        const saved = require();
        return commit(null, [{ method: 'DELETE', path: `/workouts/${saved.state.workout.id}` }]);
      },
    };
  }, [queryClient, write, bodyweightKey]);
}
