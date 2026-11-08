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

/** GET /workouts/{id}: a workout with its exercises in order, each with its sets in order. */
export type WorkoutSet = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  logged_at: string;
};
export type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  status: string;
  source: string;
  rest_seconds: number;
  sets: WorkoutSet[];
};
export type WorkoutDetail = WorkoutSummary & { exercises: WorkoutExerciseRow[] };

const ROW_PATH = /^\/workout-exercises\/([^/?]+)$/;
const SET_PATH = /^\/sets\/([^/?]+)$/;

/** A past workout (21) as the server has it, with the writes still in the outbox applied in
 * order: edits made on the phone show at once, and a workout the server hasn't received yet
 * is built from the outbox alone (`summary` fills in what its writes leave out). Null when
 * there's nothing to show, or the workout was deleted on the phone. */
export function withPendingDetail(
  server: WorkoutDetail | null,
  summary: WorkoutSummary | null,
  pending: readonly OutboxEntry[],
): WorkoutDetail | null {
  const id = server?.id ?? summary?.id;
  if (!id) return null;
  let workout: WorkoutSummary | null = server ?? summary;
  const rows = new Map((server?.exercises ?? []).map((r) => [r.id, { ...r, sets: [...r.sets] }]));
  for (const entry of pending) {
    const workoutId = WORKOUT_PATH.exec(entry.path)?.[1];
    if (workoutId === id) {
      if (entry.method === 'DELETE') return null;
      if (entry.method === 'PUT') {
        workout = withPendingWorkouts(workout ? [workout] : [], [entry])[0];
      }
      continue;
    }
    const rowId = ROW_PATH.exec(entry.path)?.[1];
    if (rowId) {
      if (entry.method === 'DELETE') rows.delete(rowId);
      const body = entry.body as Omit<WorkoutExerciseRow, 'id' | 'sets'> | undefined;
      if (entry.method === 'PUT' && body?.workout_id === id) {
        rows.set(rowId, { ...body, id: rowId, sets: rows.get(rowId)?.sets ?? [] });
      }
      continue;
    }
    const setId = SET_PATH.exec(entry.path)?.[1];
    if (setId) {
      for (const row of rows.values()) row.sets = row.sets.filter((s) => s.id !== setId);
      const body = entry.body as Omit<WorkoutSet, 'id'> | undefined;
      const row = entry.method === 'PUT' && body ? rows.get(body.workout_exercise_id) : undefined;
      if (row) row.sets.push({ ...body!, id: setId });
    }
  }
  if (!workout) return null;
  const exercises = [...rows.values()]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ ...r, sets: [...r.sets].sort((a, b) => a.set_number - b.set_number) }));
  return { ...workout, exercises };
}
