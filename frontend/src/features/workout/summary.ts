// The workout summary (11), worked out on the phone from the finished workout and last
// time as it stood before it, so it's right offline. Est. max is Epley on the session's best
// set (rule 4); bodyweight exercises use the workout's snapshot plus the added weight (rule 2).

import type { LastSession } from '@/api/workouts';

import { type ActiveWorkout, setsFor } from './workout';

type SetLike = { weight_kg: number; reps: number };

export type ExerciseResult = {
  rowId: string;
  exerciseId: string;
  /** Total reps today and last time; `last` and `delta` are null without a last time. */
  today: number;
  last: number | null;
  delta: number | null;
  /** Today's session est. max (kg), and the best before today. */
  estMaxKg: number | null;
  previousBestKg: number | null;
};

export type NewBest = { exerciseId: string; set: SetLike; estMaxKg: number; previousKg: number };

export type Summary = {
  workoutId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  sets: number;
  /** Weight × reps over every set, in kg. */
  volumeKg: number;
  exercises: ExerciseResult[];
  /** Exercises ahead of last time, out of those with a last time. */
  ahead: number;
  compared: number;
  /** When last time was (the latest one compared against). */
  lastDate: string | null;
  bests: NewBest[];
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const epley = (weight: number, reps: number) => weight * (1 + reps / 30);
const sum = (sets: readonly SetLike[]) => sets.reduce((total, s) => total + s.reps, 0);

/** A session's best set and its est. max; 0-rep sets don't count. */
function best(sets: readonly SetLike[], loadOffset: number): { set: SetLike; estMax: number } | null {
  let top: { set: SetLike; estMax: number } | null = null;
  for (const set of sets) {
    if (set.reps < 1) continue;
    const estMax = epley(set.weight_kg + loadOffset, set.reps);
    if (!top || estMax > top.estMax) top = { set, estMax };
  }
  return top;
}

export function summarize(
  state: ActiveWorkout,
  endedAt: string,
  lastSessions: readonly LastSession[],
  bodyweightIds: ReadonlySet<string>,
): Summary {
  const snapshot = state.workout.bodyweight_kg ?? 0;
  const lastById = new Map(lastSessions.map((s) => [s.exercise_id, s]));
  const rows = [...state.exercises]
    .filter((r) => r.status !== 'skipped')
    .sort((a, b) => a.position - b.position)
    .map((row) => ({ row, sets: setsFor(state, row.id) }))
    .filter(({ sets }) => sets.length > 0);

  let volumeKg = 0;
  const exercises: ExerciseResult[] = [];
  const bests: (NewBest & { gain: number })[] = [];
  for (const { row, sets } of rows) {
    const offset = bodyweightIds.has(row.exercise_id) ? snapshot : 0;
    for (const set of sets) volumeKg += (set.weight_kg + offset) * set.reps;

    const last = lastById.get(row.exercise_id);
    const today = best(sets, offset);
    const previousBestKg = last
      ? (last.best_est_max_kg ??
        best(last.sets, bodyweightIds.has(row.exercise_id) ? last.bodyweight_kg : 0)?.estMax ??
        null)
      : null;
    const lastTotal = last ? sum(last.sets) : null;
    exercises.push({
      rowId: row.id,
      exerciseId: row.exercise_id,
      today: sum(sets),
      last: lastTotal,
      delta: lastTotal === null ? null : sum(sets) - lastTotal,
      estMaxKg: today ? round3(today.estMax) : null,
      previousBestKg,
    });
    if (today && previousBestKg !== null && round3(today.estMax) > round3(previousBestKg)) {
      bests.push({
        exerciseId: row.exercise_id,
        set: today.set,
        estMaxKg: today.estMax,
        previousKg: previousBestKg,
        gain: today.estMax / previousBestKg,
      });
    }
  }

  const compared = exercises.filter((e) => e.delta !== null);
  const lastDate =
    rows
      .map(({ row }) => lastById.get(row.exercise_id)?.started_at)
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;

  return {
    workoutId: state.workout.id,
    title: state.workout.title,
    startedAt: state.workout.started_at,
    endedAt,
    minutes: Math.round((new Date(endedAt).getTime() - new Date(state.workout.started_at).getTime()) / 60_000),
    sets: rows.reduce((total, { sets }) => total + sets.length, 0),
    volumeKg,
    exercises,
    ahead: compared.filter((e) => e.delta! > 0).length,
    compared: compared.length,
    lastDate,
    bests: bests.sort((a, b) => b.gain - a.gain).map(({ gain: _gain, ...rest }) => rest),
  };
}

/** Each exercise's best so far once this workout counts, for the cached last-time data. */
export function bestsAfter(summary: Summary): Map<string, number> {
  const result = new Map<string, number>();
  for (const e of summary.exercises) {
    const values = [e.estMaxKg, e.previousBestKg].filter((v): v is number => v !== null);
    if (values.length) result.set(e.exerciseId, round3(Math.max(...values)));
  }
  return result;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const clock = (date: Date) => `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}`;
const half = (date: Date) => (date.getHours() < 12 ? 'AM' : 'PM');

/** "Friday, Oct 9, 6:12 to 6:59 PM". */
export function timeRange(start: Date, end: Date): string {
  const day = `${WEEKDAYS[start.getDay()]}, ${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const from = half(start) === half(end) ? clock(start) : `${clock(start)} ${half(start)}`;
  return `${day}, ${from} to ${clock(end)} ${half(end)}`;
}
