import { useQueryClient } from '@tanstack/react-query';

import { localDate } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { toKg, type Unit } from '@/lib/units';
import { now } from '@/review/reviewMode';

import { useSync } from './AppProviders';

export type BodyweightEntry = { id: string; weight_kg: number; measured_on: string };

export const BODYWEIGHT_KEY = ['bodyweight-entries'] as const;

/** Logs today's bodyweight. Workouts copy the latest entry when they start (rule 3); past
 * workouts keep their own copy, so logging a new one never changes them. */
export function useLogBodyweight() {
  const queryClient = useQueryClient();
  const { write } = useSync();
  return async (value: number, unit: Unit): Promise<BodyweightEntry> => {
    const entry: BodyweightEntry = {
      id: newId(),
      weight_kg: toKg(value, unit),
      measured_on: localDate(now()),
    };
    queryClient.setQueryData<BodyweightEntry[]>(BODYWEIGHT_KEY, (old = []) => [...old, entry]);
    await write({
      method: 'PUT',
      path: `/bodyweight-entries/${entry.id}`,
      body: { weight_kg: entry.weight_kg, measured_on: entry.measured_on },
    });
    return entry;
  };
}
