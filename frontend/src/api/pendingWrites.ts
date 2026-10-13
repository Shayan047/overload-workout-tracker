// Reads keep unsent local changes: the server's answer with the writes still in the outbox
// applied on top. Pure, so it's tested without the app around it.

import type { OutboxEntry } from './outbox';

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

const WORKOUT_PATH = /^\/workouts\/([^/?]+)$/;

/** The server's list with the workout writes still in the outbox applied on top, so a
 * refresh never undoes a workout started, finished or deleted on the phone. */
export function withPendingWorkouts(server: readonly WorkoutSummary[], pending: readonly OutboxEntry[]): WorkoutSummary[] {
  const byId = new Map(server.map((w) => [w.id, w]));
  for (const entry of pending) {
    const id = WORKOUT_PATH.exec(entry.path)?.[1];
    if (!id) continue;
    if (entry.method === 'DELETE') {
      byId.delete(id);
    } else if (entry.method === 'PUT') {
      const body = entry.body as Partial<WorkoutSummary>;
      const known = byId.get(id);
      byId.set(id, {
        id,
        split_day_id: body.split_day_id ?? null,
        title: body.title ?? known?.title ?? '',
        started_at: body.started_at ?? known?.started_at ?? '',
        // Once finished, a workout stays finished (the API never clears ended_at).
        ended_at: body.ended_at ?? known?.ended_at ?? null,
        bodyweight_kg: body.bodyweight_kg ?? known?.bodyweight_kg ?? 0,
      });
    }
  }
  return [...byId.values()];
}
