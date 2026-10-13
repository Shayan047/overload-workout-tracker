// The workout in progress, as pure functions: each change returns the new state and the
// outbox writes it needs. The store (workoutStore.ts) saves the state on the phone and
// queues the writes, so a whole workout can be logged offline and survives the app being
// killed.

import type { OutboxEntry } from '@/api/outbox';

export type Write = Pick<OutboxEntry, 'method' | 'path' | 'body'>;

export type WorkoutRow = {
  id: string;
  exercise_id: string;
  position: number;
  status: 'planned' | 'done' | 'skipped';
  source: 'split' | 'added' | 'swapped';
  rest_seconds: number;
};

export type LoggedSet = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  logged_at: string;
};

export type ActiveWorkout = {
  workout: {
    id: string;
    split_day_id: string | null;
    title: string;
    started_at: string;
    /** The bodyweight snapshot (rule 3); null when the phone had none and the server fills it. */
    bodyweight_kg: number | null;
  };
  exercises: WorkoutRow[];
  sets: LoggedSet[];
  /** Empty rows added with "Add set", per exercise row. */
  extraRows: Record<string, number>;
};

type Result = { state: ActiveWorkout; writes: Write[] };

/** Rows shown when there's no last time to copy the set count from. */
export const DEFAULT_SET_ROWS = 3;

const rowBody = (workoutId: string, row: WorkoutRow) => ({
  workout_id: workoutId,
  exercise_id: row.exercise_id,
  position: row.position,
  status: row.status,
  source: row.source,
  rest_seconds: row.rest_seconds,
});

const setBody = (set: LoggedSet) => ({
  workout_exercise_id: set.workout_exercise_id,
  set_number: set.set_number,
  weight_kg: set.weight_kg,
  reps: set.reps,
  logged_at: set.logged_at,
});

function workoutBody(workout: ActiveWorkout['workout'], endedAt?: string) {
  return {
    split_day_id: workout.split_day_id,
    title: workout.title,
    started_at: workout.started_at,
    ...(endedAt && { ended_at: endedAt }),
    ...(workout.bodyweight_kg !== null && { bodyweight_kg: workout.bodyweight_kg }),
  };
}

/** Starts today's day: the workout, then one row per split exercise with its rest length
 * copied, so later edits to the split never change this workout (rule 6). */
export function startWorkout(
  day: { id: string; name: string; exercises: { exercise_id: string; rest_seconds: number }[] },
  options: { bodyweightKg: number | null; now: Date; makeId: () => string },
): Result {
  const workout = {
    id: options.makeId(),
    split_day_id: day.id,
    title: day.name,
    started_at: options.now.toISOString(),
    bodyweight_kg: options.bodyweightKg,
  };
  const exercises: WorkoutRow[] = day.exercises.map((e, position) => ({
    id: options.makeId(),
    exercise_id: e.exercise_id,
    position,
    status: 'planned',
    source: 'split',
    rest_seconds: e.rest_seconds,
  }));
  return {
    state: { workout, exercises, sets: [], extraRows: {} },
    writes: [
      { method: 'PUT', path: `/workouts/${workout.id}`, body: workoutBody(workout) },
      ...exercises.map((row) => ({
        method: 'PUT' as const,
        path: `/workout-exercises/${row.id}`,
        body: rowBody(workout.id, row),
      })),
    ],
  };
}

/** The sets logged for an exercise row, in order. */
export function setsFor(state: ActiveWorkout, rowId: string): LoggedSet[] {
  return state.sets.filter((s) => s.workout_exercise_id === rowId).sort((a, b) => a.set_number - b.set_number);
}

/** How many set rows to show: last time's count (or 3), plus added ones, never fewer than
 * the sets logged. */
export function plannedRows(state: ActiveWorkout, rowId: string, lastTimeSets: number): number {
  const base = (lastTimeSets || DEFAULT_SET_ROWS) + (state.extraRows[rowId] ?? 0);
  return Math.max(base, setsFor(state, rowId).length);
}

export function addRow(state: ActiveWorkout, rowId: string): ActiveWorkout {
  return { ...state, extraRows: { ...state.extraRows, [rowId]: (state.extraRows[rowId] ?? 0) + 1 } };
}

/** The exercise being done: the one the user picked, else the first one still planned. */
export function currentExercise(state: ActiveWorkout, ui: { focusId?: string | null }): WorkoutRow | null {
  const ordered = [...state.exercises].sort((a, b) => a.position - b.position);
  const focused = ordered.find((e) => e.id === ui.focusId && e.status !== 'skipped');
  return focused ?? ordered.find((e) => e.status === 'planned') ?? null;
}

/** The weight to start the next set at: the last set today, else last time's set with the
 * same number (or its last set), else nothing. */
export function defaultWeightKg(
  state: ActiveWorkout,
  rowId: string,
  lastTime: readonly { set_number: number; weight_kg: number }[],
): number | null {
  const today = setsFor(state, rowId);
  if (today.length) return today[today.length - 1].weight_kg;
  if (!lastTime.length) return null;
  return (lastTime.find((s) => s.set_number === today.length + 1) ?? lastTime[lastTime.length - 1]).weight_kg;
}

/** Logs a set (or edits one, with `setId`). When `plannedSets` is given and this set
 * completes them, the exercise is marked done. */
export function logSet(
  state: ActiveWorkout,
  input: {
    rowId: string;
    setId?: string;
    weightKg: number;
    reps: number;
    now: Date;
    makeId: () => string;
    plannedSets?: number;
  },
): Result {
  const existing = input.setId ? state.sets.find((s) => s.id === input.setId) : undefined;
  const set: LoggedSet = existing
    ? { ...existing, weight_kg: input.weightKg, reps: input.reps }
    : {
        id: input.makeId(),
        workout_exercise_id: input.rowId,
        set_number: setsFor(state, input.rowId).length + 1,
        weight_kg: input.weightKg,
        reps: input.reps,
        logged_at: input.now.toISOString(),
      };
  const sets = existing ? state.sets.map((s) => (s.id === set.id ? set : s)) : [...state.sets, set];
  let next: ActiveWorkout = { ...state, sets };
  const writes: Write[] = [{ method: 'PUT', path: `/sets/${set.id}`, body: setBody(set) }];

  const row = state.exercises.find((e) => e.id === input.rowId);
  if (row && row.status === 'planned' && input.plannedSets && setsFor(next, row.id).length >= input.plannedSets) {
    const done: WorkoutRow = { ...row, status: 'done' };
    next = { ...next, exercises: next.exercises.map((e) => (e.id === row.id ? done : e)) };
    writes.push({ method: 'PUT', path: `/workout-exercises/${row.id}`, body: rowBody(state.workout.id, done) });
  }
  return { state: next, writes };
}

/** Deletes a set; the sets after it move up a number. */
export function deleteSet(state: ActiveWorkout, setId: string): Result {
  const target = state.sets.find((s) => s.id === setId);
  if (!target) return { state, writes: [] };
  const writes: Write[] = [{ method: 'DELETE', path: `/sets/${setId}` }];
  const sets = state.sets
    .filter((s) => s.id !== setId)
    .map((s) => {
      if (s.workout_exercise_id !== target.workout_exercise_id || s.set_number < target.set_number) return s;
      const moved = { ...s, set_number: s.set_number - 1 };
      writes.push({ method: 'PUT', path: `/sets/${s.id}`, body: setBody(moved) });
      return moved;
    });
  return { state: { ...state, sets }, writes };
}

/** Changes one exercise row (today-only changes, marking done): the row and its write. */
export function updateRow(state: ActiveWorkout, row: WorkoutRow): Result {
  return {
    state: { ...state, exercises: state.exercises.some((e) => e.id === row.id) ? state.exercises.map((e) => (e.id === row.id ? row : e)) : [...state.exercises, row] },
    writes: [{ method: 'PUT', path: `/workout-exercises/${row.id}`, body: rowBody(state.workout.id, row) }],
  };
}

/** Finishes: the workout with `ended_at`. */
export function finishWorkout(
  state: ActiveWorkout,
  now: Date,
): { workout: ActiveWorkout['workout'] & { ended_at: string }; writes: Write[] } {
  const endedAt = now.toISOString();
  return {
    workout: { ...state.workout, ended_at: endedAt },
    writes: [{ method: 'PUT', path: `/workouts/${state.workout.id}`, body: workoutBody(state.workout, endedAt) }],
  };
}

type Session = {
  exercise_id: string;
  workout_id: string;
  title: string;
  started_at: string;
  ended_at: string;
  bodyweight_kg: number;
  sets: { set_number: number; weight_kg: number; reps: number }[];
};

/** A finished workout as last time (ghost) for each exercise done in it, in the shape of
 * GET /workouts/last-sessions. Exercises with no sets are left out, as the API does. */
export function sessionsFrom(state: ActiveWorkout, endedAt: string, bodyweightKg: number): Session[] {
  return [...state.exercises]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({ row, sets: setsFor(state, row.id) }))
    .filter(({ sets }) => sets.length > 0)
    .map(({ row, sets }) => ({
      exercise_id: row.exercise_id,
      workout_id: state.workout.id,
      title: state.workout.title,
      started_at: state.workout.started_at,
      ended_at: endedAt,
      bodyweight_kg: bodyweightKg,
      sets: sets.map(({ set_number, weight_kg, reps }) => ({ set_number, weight_kg, reps })),
    }));
}

/** Per exercise, the session that ended last: the server's, or one finished on the phone
 * that the server hasn't received yet. */
export function mergeLastSessions<T extends Pick<Session, 'exercise_id' | 'ended_at'>>(
  server: readonly T[],
  local: readonly T[],
): T[] {
  const merged = new Map(server.map((s) => [s.exercise_id, s]));
  for (const session of local) {
    const known = merged.get(session.exercise_id);
    if (!known || new Date(session.ended_at) > new Date(known.ended_at)) merged.set(session.exercise_id, session);
  }
  return [...merged.values()];
}
