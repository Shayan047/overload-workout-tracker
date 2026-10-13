// "Do a different day": the day picked for today only, in memory. It lapses at midnight
// (the date is part of it) and when a workout is finished (chunk 13).

import { useSyncExternalStore } from 'react';

type Override = { date: string; dayId: string } | null;

let override: Override = null;
const listeners = new Set<() => void>();

export const todayOverride = {
  get: (): Override => override,
  set(date: string, dayId: string | null) {
    override = dayId ? { date, dayId } : null;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** The day picked for `date`, or null. */
export function useTodayOverride(date: string): string | null {
  const value = useSyncExternalStore(todayOverride.subscribe, todayOverride.get, todayOverride.get);
  return value?.date === date ? value.dayId : null;
}
