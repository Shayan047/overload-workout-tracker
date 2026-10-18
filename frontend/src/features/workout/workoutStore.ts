// The workout in progress, kept on the phone so killing the app never loses it. Loaded
// before the first screen renders (AppProviders), saved on every change. The writes for
// each change go to the outbox separately (useWorkoutActions).

import { useSyncExternalStore } from 'react';

import type { KeyValueStorage } from '@/api/storage';
import { isReviewMode } from '@/review/reviewMode';
import { sampleActiveWorkout } from '@/review/sampleData';

import type { Rest } from './rest';
import type { ActiveWorkout } from './workout';

export const ACTIVE_WORKOUT_KEY = 'overload.workout.active.v1';

export type Saved = {
  state: ActiveWorkout;
  /** The exercise the user moved to, if not the first one still planned. */
  focusId: string | null;
  /** The rest timer running, if any (chunk 15). Missing in workouts saved before it. */
  rest?: Rest | null;
};

let current: Saved | null = null;
let storage: KeyValueStorage | null = null;
let saving: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function isSaved(value: unknown): value is Saved {
  const saved = value as Saved;
  return (
    typeof saved === 'object' &&
    saved !== null &&
    typeof saved.state?.workout?.id === 'string' &&
    Array.isArray(saved.state.exercises) &&
    Array.isArray(saved.state.sets)
  );
}

/** Saves in call order, so an older snapshot never overwrites a newer one. */
function persist(): Promise<void> {
  if (isReviewMode || !storage) return saving;
  const target = storage;
  const snapshot = current ? JSON.stringify(current) : null;
  saving = saving.then(() => (snapshot ? target.setItem(ACTIVE_WORKOUT_KEY, snapshot) : target.removeItem(ACTIVE_WORKOUT_KEY)));
  return saving;
}

export const activeWorkout = {
  /** Reads the saved workout, if any. An unreadable one is dropped. */
  async load(from: KeyValueStorage): Promise<void> {
    storage = from;
    if (isReviewMode) return;
    try {
      const saved: unknown = JSON.parse((await from.getItem(ACTIVE_WORKOUT_KEY)) ?? 'null');
      current = isSaved(saved) ? { ...saved, state: { ...saved.state, extraRows: saved.state.extraRows ?? {} } } : null;
    } catch {
      current = null;
    }
  },
  get: (): Saved | null => current,
  set(next: Saved | null): Promise<void> {
    current = next;
    for (const listener of listeners) listener();
    return persist();
  },
  clear(): Promise<void> {
    return activeWorkout.set(null);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useActiveWorkout(): Saved | null {
  return useSyncExternalStore(activeWorkout.subscribe, activeWorkout.get, activeWorkout.get);
}

/** The workout the workout screen shows: in review mode, 08's sample until it's changed
 * (Today in review mode still has none, as 07 is drawn). */
export const inProgress = (saved: Saved | null): Saved | null => saved ?? (isReviewMode ? sampleActiveWorkout : null);
