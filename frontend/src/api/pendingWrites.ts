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
  /** The best session est. max so far (chunk 16); missing in data cached before it. */
  best_est_max_kg?: number | null;
};

/** GET /workouts/history: a finished workout on History (18). */
export type WorkoutHistoryItem = WorkoutSummary & {
  sets: number;
  /** Exercises with more total reps than last time, out of those with a last time. */
  ahead: number;
  compared: number;
};

/** GET /bodyweight-entries. */
export type BodyweightEntry = { id: string; weight_kg: number; measured_on: string };

const WORKOUT_PATH = /^\/workouts\/([^/?]+)$/;
const BODYWEIGHT_PATH = /^\/bodyweight-entries\/([^/?]+)$/;

const idsUnder = (pattern: RegExp, pending: readonly OutboxEntry[], method?: OutboxEntry['method']) =>
  new Set(
    pending
      .filter((e) => !method || e.method === method)
      .map((e) => pattern.exec(e.path)?.[1])
      .filter((id): id is string => !!id),
  );

/** Workouts with a write still in the outbox. The finish is a workout's last write and the
 * outbox goes in order, so once it's sent, the whole workout is. */
export function pendingWorkoutIds(pending: readonly OutboxEntry[]): Set<string> {
  return idsUnder(WORKOUT_PATH, pending);
}

/** History from the server, plus the recaps made on the phone (at finish) for workouts it
 * hasn't received yet, minus workouts deleted on the phone. Newest first. */
export function withPendingHistory(
  server: readonly WorkoutHistoryItem[],
  cached: readonly WorkoutHistoryItem[],
  pending: readonly OutboxEntry[],
): WorkoutHistoryItem[] {
  const unsent = idsUnder(WORKOUT_PATH, pending, 'PUT');
  const deleted = idsUnder(WORKOUT_PATH, pending, 'DELETE');
  const known = new Set(server.map((w) => w.id));
  const local = cached.filter((w) => unsent.has(w.id) && !known.has(w.id));
  return [...server, ...local]
    .filter((w) => !deleted.has(w.id))
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/** Bodyweight entries from the server, with entries logged on the phone and not sent yet
 * (the local value wins until it's sent). */
export function withPendingBodyweight(
  server: readonly BodyweightEntry[],
  cached: readonly BodyweightEntry[],
  pending: readonly OutboxEntry[],
): BodyweightEntry[] {
  const unsent = idsUnder(BODYWEIGHT_PATH, pending, 'PUT');
  const deleted = idsUnder(BODYWEIGHT_PATH, pending, 'DELETE');
  const byId = new Map(server.map((e) => [e.id, e]));
  for (const entry of cached) if (unsent.has(entry.id)) byId.set(entry.id, entry);
  return [...byId.values()].filter((e) => !deleted.has(e.id));
}

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
