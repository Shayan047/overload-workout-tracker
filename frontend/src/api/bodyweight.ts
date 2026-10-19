import { useQuery, useQueryClient } from '@tanstack/react-query';

import { localDate } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { toKg, type Unit } from '@/lib/units';
import { isReviewMode, now } from '@/review/reviewMode';
import { sampleBodyweight } from '@/review/sampleData';

import { useAuth, useSync } from './AppProviders';
import { type BodyweightEntry, withPendingBodyweight } from './pendingWrites';

export type { BodyweightEntry } from './pendingWrites';

export const BODYWEIGHT_KEY = ['bodyweight-entries'] as const;

/** The bodyweight log (20), cached for offline use; entries logged on the phone and not
 * sent yet are kept. */
export function useBodyweightEntries() {
  const { request, outbox } = useSync();
  const { signedIn } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: BODYWEIGHT_KEY,
    queryFn: async () =>
      withPendingBodyweight(
        await request<BodyweightEntry[]>('GET', '/bodyweight-entries'),
        queryClient.getQueryData<BodyweightEntry[]>(BODYWEIGHT_KEY) ?? [],
        outbox.entries,
      ),
    meta: { persist: true },
    enabled: signedIn && !isReviewMode,
    initialData: isReviewMode ? sampleBodyweight : undefined,
  });
}

/** Logs today's bodyweight; logging again the same day corrects that day's entry. Workouts
 * copy the latest entry when they start (rule 3); past workouts keep their own copy, so
 * logging never changes them. */
export function useLogBodyweight() {
  const queryClient = useQueryClient();
  const { write } = useSync();
  return async (value: number, unit: Unit): Promise<BodyweightEntry> => {
    const today = localDate(now());
    const existing = queryClient.getQueryData<BodyweightEntry[]>(BODYWEIGHT_KEY)?.find((e) => e.measured_on === today);
    const entry: BodyweightEntry = { id: existing?.id ?? newId(), weight_kg: toKg(value, unit), measured_on: today };
    queryClient.setQueryData<BodyweightEntry[]>(BODYWEIGHT_KEY, (old = []) => [
      ...old.filter((e) => e.id !== entry.id),
      entry,
    ]);
    await write({
      method: 'PUT',
      path: `/bodyweight-entries/${entry.id}`,
      body: { weight_kg: entry.weight_kg, measured_on: entry.measured_on },
    });
    return entry;
  };
}
