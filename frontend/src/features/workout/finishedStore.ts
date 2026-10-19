// The workout just finished, for its summary (11). Kept in memory only: after a restart the
// app opens on Today, and the workout is in History.

import { useSyncExternalStore } from 'react';

import { isReviewMode } from '@/review/reviewMode';
import { sampleSummary } from '@/review/sampleData';

import type { Summary } from './summary';

let current: Summary | null = null;
const listeners = new Set<() => void>();

export const finishedWorkout = {
  get: (): Summary | null => current,
  set(summary: Summary | null) {
    current = summary;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** The summary to show; 11's sample in review mode. */
export function useFinishedWorkout(): Summary | null {
  const value = useSyncExternalStore(finishedWorkout.subscribe, finishedWorkout.get, finishedWorkout.get);
  return value ?? (isReviewMode ? sampleSummary() : null);
}
