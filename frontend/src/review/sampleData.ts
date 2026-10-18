// Fixed data for review mode (see reviewMode.ts), taken from the designs and from
// docs/product-spec.md. Weights are in kg, as the API sends them; the sample user's unit
// is lb, so screens show the designs' lb numbers. Screens read from here in review mode
// once they exist (chunks 10–20).

import type { Preset, SplitDraft } from '@/features/splits/draft';
import type { LastSession, WorkoutSummary } from '@/api/workouts';
import type { Rest } from '@/features/workout/rest';
import type { ExerciseStats, OneWeightStats, ProgressItem } from '@/api/stats';
import { summarize, type Summary } from '@/features/workout/summary';
import type { ActiveWorkout } from '@/features/workout/workout';
import type { Exercise } from '@/lib/exercises';

const LB = 0.45359237;
const kg = (lb: number) => Math.round(lb * LB * 1000) / 1000;

export const sampleUser = {
  displayName: 'Shayan',
  unit: 'lb' as const,
  bodyweightKg: kg(172),
  trainingSince: '2026-08-01',
  workoutCount: 46,
};

/** Exercises as the designs label them (03–07). Review mode uses these instead of the
 * library, so muscles read "Side delts" and "Back, biceps" as drawn. */
const ex = (id: string, name: string, primary: string, equipment: string | null): Exercise => ({
  id,
  name,
  primary_muscle: primary,
  muscle_group: primary,
  secondary_muscles: [],
  equipment,
  kind: equipment === 'body only' ? 'bodyweight' : 'weighted',
  is_custom: false,
});

export const sampleExercises: Exercise[] = [
  ex('rv-ohp', 'Overhead press', 'shoulders', 'barbell'),
  ex('rv-lateral', 'Lateral raise', 'side delts', 'dumbbell'),
  ex('rv-curl', 'Bicep curl', 'biceps', 'dumbbell'),
  ex('rv-hammer', 'Hammer curl', 'biceps', 'dumbbell'),
  ex('rv-pushdown', 'Triceps pushdown', 'triceps', 'cable'),
  ex('rv-chinup', 'Chin-up', 'back, biceps', 'body only'),
  ex('rv-barbell-curl', 'Barbell curl', 'biceps', 'barbell'),
  ex('rv-ez-curl', 'EZ-bar curl', 'biceps', 'e-z curl bar'),
  ex('rv-preacher', 'Preacher curl', 'biceps', 'machine'),
  ex('rv-cable-curl', 'Cable curl', 'biceps', 'cable'),
  ex('rv-incline-curl', 'Incline dumbbell curl', 'biceps', 'dumbbell'),
  ex('rv-bench', 'Bench press', 'chest', 'barbell'),
  ex('rv-incline-press', 'Incline dumbbell press', 'chest', 'dumbbell'),
  ex('rv-pullup', 'Pull-up', 'lats', 'body only'),
  ex('rv-row', 'Barbell row', 'middle back', 'barbell'),
  ex('rv-fly', 'Dumbbell fly', 'chest', 'dumbbell'),
  ex('rv-pulldown', 'Lat pulldown', 'lats', 'cable'),
  ex('rv-squat', 'Squat', 'quadriceps', 'barbell'),
  ex('rv-rdl', 'Romanian deadlift', 'hamstrings', 'barbell'),
  ex('rv-leg-press', 'Leg press', 'quadriceps', 'machine'),
  ex('rv-leg-curl', 'Leg curl', 'hamstrings', 'machine'),
  ex('rv-calf', 'Calf raise', 'calves', 'machine'),
];

const row = (day: string, i: number, exerciseId: string, restSeconds: number) => ({
  id: `rv-${day}-${i}`,
  exerciseId,
  restSeconds,
});

export const SAMPLE_DAY_ID = 'rv-day-shoulders';

/** The Arnold split being edited (04), with 05's Shoulders & Arms. */
export const sampleSplitDraft: SplitDraft = {
  id: 'rv-arnold',
  name: 'Arnold split',
  repeatMode: 'in_order',
  days: [
    {
      id: 'rv-day-chest',
      name: 'Chest & Back',
      weekday: null,
      exercises: ['rv-bench', 'rv-incline-press', 'rv-pullup', 'rv-row', 'rv-fly', 'rv-pulldown'].map((id, i) =>
        row('chest', i, id, 120),
      ),
    },
    {
      id: SAMPLE_DAY_ID,
      name: 'Shoulders & Arms',
      weekday: null,
      exercises: [
        row('shoulders', 0, 'rv-ohp', 150),
        row('shoulders', 1, 'rv-lateral', 60),
        row('shoulders', 2, 'rv-curl', 90),
        row('shoulders', 3, 'rv-hammer', 90),
        row('shoulders', 4, 'rv-pushdown', 60),
        row('shoulders', 5, 'rv-chinup', 120),
      ],
    },
    {
      id: 'rv-day-legs',
      name: 'Legs',
      weekday: null,
      exercises: ['rv-squat', 'rv-rdl', 'rv-leg-press', 'rv-leg-curl', 'rv-calf'].map((id, i) => row('legs', i, id, 120)),
    },
  ],
};

/** Add exercises (06) as drawn: searching "curl" in Biceps, two picked. */
export const sampleAddExercises = {
  query: 'curl',
  group: 'biceps',
  selected: ['rv-barbell-curl', 'rv-cable-curl'],
};

/** The presets as Pick a split (03) draws them (the app's own Upper/Lower days are A and B). */
const presetDays = (...names: string[]) => names.map((name) => ({ name, weekday: null, exercises: [] }));
export const samplePresets: Preset[] = [
  { key: 'push_pull_legs', name: 'Push, pull, legs', summary: '3-day rotation', repeat_mode: 'in_order', days: presetDays('Push', 'Pull', 'Legs') },
  { key: 'arnold', name: 'Arnold split', summary: '3-day rotation', repeat_mode: 'in_order', days: presetDays('Chest & Back', 'Shoulders & Arms', 'Legs') },
  { key: 'upper_lower', name: 'Upper, lower', summary: '4 days a week', repeat_mode: 'in_order', days: presetDays('Upper', 'Lower', 'Upper', 'Lower') },
  { key: 'body_part', name: 'Body part split', summary: '5 days a week', repeat_mode: 'in_order', days: presetDays('Chest', 'Back', 'Shoulders', 'Arms', 'Legs') },
  {
    key: 'full_body',
    name: 'Full body',
    summary: '3 days a week',
    repeat_mode: 'weekdays',
    days: [0, 2, 4].map((weekday, i) => ({ name: `Full body ${'ABC'[i]}`, weekday, exercises: [] })),
  },
];

/** Today (07): Chest & Back was done yesterday (Thursday, October 8)… */
export const sampleWorkouts: WorkoutSummary[] = [
  {
    id: 'rv-workout-chest',
    split_day_id: 'rv-day-chest',
    title: 'Chest & Back',
    started_at: new Date(2026, 9, 8, 18, 0).toISOString(),
    ended_at: new Date(2026, 9, 8, 18, 52).toISOString(),
    bodyweight_kg: kg(172),
  },
];

/** …and Shoulders & Arms last Tuesday (October 6). The first set of each is its best set,
 * as 07 shows it ("75 × 8", "BW+10 × 8"). */
const lastSession = (exerciseId: string, lb: number, reps: number[]): LastSession => ({
  exercise_id: exerciseId,
  workout_id: 'rv-workout-shoulders',
  title: 'Shoulders & Arms',
  started_at: new Date(2026, 9, 6, 18, 0).toISOString(),
  ended_at: new Date(2026, 9, 6, 18, 47).toISOString(),
  bodyweight_kg: kg(172),
  sets: reps.map((r, i) => ({ set_number: i + 1, weight_kg: kg(lb), reps: r })),
  // The best so far was this session's first set (chin-ups count bodyweight).
  best_est_max_kg:
    Math.round((kg(lb) + (exerciseId === 'rv-chinup' ? kg(172) : 0)) * (1 + reps[0] / 30) * 1000) / 1000,
});

export const sampleLastSessions: LastSession[] = [
  lastSession('rv-ohp', 75, [8, 7, 7, 6]),
  lastSession('rv-lateral', 20, [12, 11, 10]),
  lastSession('rv-curl', 20, [6, 5, 5, 4]),
  lastSession('rv-hammer', 25, [9, 8, 7]),
  lastSession('rv-pushdown', 50, [12, 12, 10]),
  lastSession('rv-chinup', 10, [8, 6, 6]),
];

/** Bicep curl history: docs/product-spec.md's sessions (10 lb, then 15 and 20 lb), plus the
 * 15 lb weeks that 14's chart draws. */
export const bicepCurlSessions = [
  { date: '2026-08-18', weightKg: kg(10), reps: [12, 8, 7, 7] },
  { date: '2026-08-21', weightKg: kg(10), reps: [12, 9, 9, 8] },
  { date: '2026-08-25', weightKg: kg(10), reps: [12, 10, 9, 9] },
  { date: '2026-08-28', weightKg: kg(10), reps: [13, 11, 10, 10] },
  { date: '2026-09-01', weightKg: kg(10), reps: [14, 12, 11, 11] },
  { date: '2026-09-04', weightKg: kg(15), reps: [8, 7, 6, 6] },
  { date: '2026-09-08', weightKg: kg(15), reps: [9, 7, 7, 6] },
  { date: '2026-09-11', weightKg: kg(15), reps: [9, 8, 7, 7] },
  { date: '2026-09-15', weightKg: kg(15), reps: [10, 8, 7, 7] },
  { date: '2026-09-18', weightKg: kg(15), reps: [10, 8, 8, 7] },
  { date: '2026-09-22', weightKg: kg(15), reps: [11, 9, 8, 8] },
  { date: '2026-09-25', weightKg: kg(15), reps: [11, 9, 9, 8] },
  { date: '2026-09-28', weightKg: kg(15), reps: [12, 10, 9, 9] },
  { date: '2026-10-02', weightKg: kg(20), reps: [6, 5, 4, 4] },
  { date: '2026-10-06', weightKg: kg(20), reps: [6, 5, 5, 4] },
  { date: '2026-10-09', weightKg: kg(20), reps: [7, 6, 6, 5] },
];

/** The workout in progress on 08 and 09: started 17:22:42, so it reads 42:18 at 18:05.
 * Overhead press and lateral raise are done (+1 rep, +2 reps on last time); bicep curl is on
 * set 3 after 20 × 7 and 20 × 6. */
const activeRows = sampleSplitDraft.days[1].exercises.map((e, position) => ({
  id: `rv-active-${position}`,
  exercise_id: e.exerciseId,
  position,
  status: position < 2 ? ('done' as const) : ('planned' as const),
  source: 'split' as const,
  rest_seconds: e.restSeconds,
}));
const activeSets = (row: number, lb: number, reps: number[], minute: number) =>
  reps.map((r, i) => ({
    id: `rv-active-${row}-set-${i + 1}`,
    workout_exercise_id: `rv-active-${row}`,
    set_number: i + 1,
    weight_kg: kg(lb),
    reps: r,
    logged_at: new Date(2026, 9, 9, 17, minute + i * 3).toISOString(),
  }));

export const sampleActiveWorkout: { state: ActiveWorkout; focusId: string | null; rest: Rest } = {
  state: {
    workout: {
      id: 'rv-active',
      split_day_id: SAMPLE_DAY_ID,
      title: 'Shoulders & Arms',
      started_at: new Date(2026, 9, 9, 17, 22, 42).toISOString(),
      bodyweight_kg: kg(172),
    },
    exercises: activeRows,
    sets: [...activeSets(0, 75, [8, 8, 7, 6], 25), ...activeSets(1, 20, [13, 12, 10], 38), ...activeSets(2, 20, [7, 6], 58)],
    extraRows: {},
  },
  focusId: null,
  // 08's timer card: 0:47 of 1:30 at 18:05.
  rest: { rowId: 'rv-active-2', endsAt: new Date(2026, 9, 9, 18, 5, 47).toISOString(), totalSeconds: 90 },
};

/** The summary on 11: Shoulders & Arms from 6:12 to 6:59 PM, against Tuesday. */
export function sampleSummary(): Summary {
  const today: [number, number[]][] = [
    [75, [8, 8, 7, 6]],
    [20, [13, 12, 10]],
    [20, [7, 6, 6, 5]],
    [25, [9, 8, 7]],
    [50, [12, 11, 10]],
    [10, [8, 7, 6]],
  ];
  const state: ActiveWorkout = {
    workout: {
      id: 'rv-finished',
      split_day_id: SAMPLE_DAY_ID,
      title: 'Shoulders & Arms',
      started_at: new Date(2026, 9, 9, 18, 12).toISOString(),
      bodyweight_kg: kg(172),
    },
    exercises: activeRows.map((row) => ({ ...row, id: `rv-finished-${row.position}`, status: 'done' })),
    sets: today.flatMap(([lb, reps], row) =>
      reps.map((r, i) => ({
        id: `rv-finished-${row}-set-${i + 1}`,
        workout_exercise_id: `rv-finished-${row}`,
        set_number: i + 1,
        weight_kg: kg(lb),
        reps: r,
        logged_at: new Date(2026, 9, 9, 18, 14 + row * 7 + i * 2).toISOString(),
      })),
    ),
    extraRows: {},
  };
  return summarize(state, new Date(2026, 9, 9, 18, 59).toISOString(), sampleLastSessions, new Set(['rv-chinup']));
}

// Progress (13) and Exercise detail (14). Stats come from the server, so these are written
// out as the API would answer: est. max in kg, rounded to the gram.
const epley = (weightKg: number, reps: number) => Math.round(weightKg * (1 + reps / 30) * 1000) / 1000;
const sessionDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 18, 40).toISOString();
};

/** A sparkline in the shape 13 draws: its SVG points, turned back into est. max values that
 * run from `first` to `last` (lb), over the 8 weeks to today. */
function sparkFrom(path: [number, number][], first: number, last: number) {
  const [y0, y1] = [path[0][1], path[path.length - 1][1]];
  const start = new Date(2026, 7, 18, 18, 40).getTime();
  const span = new Date(2026, 9, 9, 18, 40).getTime() - start;
  return path.map(([x, y]) => ({
    at: new Date(start + ((x - 2) / 80) * span).toISOString(),
    est_max_kg: kg(first + ((y0 - y) / (y0 - y1 || 1)) * (last - first)),
  }));
}

const progressRow = (
  exerciseId: string,
  estLb: number,
  change: number,
  latest: Date,
  path: [number, number][],
  extra: Partial<ProgressItem> = {},
): ProgressItem => ({
  exercise_id: exerciseId,
  includes_bodyweight: false,
  sessions: path.length,
  latest_at: latest.toISOString(),
  est_max_kg: kg(estLb),
  change,
  is_new_best: false,
  plateau: null,
  sparkline: sparkFrom(path, estLb / (1 + change), estLb),
  ...extra,
});

const TODAY = new Date(2026, 9, 9, 18, 40);
export const sampleProgress: ProgressItem[] = [
  progressRow('rv-curl', 24.667, 0.76, TODAY, [[2, 28], [14, 27], [26, 26], [38, 18], [50, 16], [62, 14], [74, 8], [82, 6]], { is_new_best: true }),
  progressRow('rv-lateral', 28.667, 0.17, TODAY, [[2, 27], [18, 22], [34, 22], [50, 17], [66, 13], [82, 9]], { is_new_best: true }),
  progressRow('rv-bench', 205, 0.04, new Date(2026, 9, 8, 18, 30), [[2, 22], [14, 18], [26, 14], [38, 12], [50, 12], [62, 12], [74, 12], [82, 12]], {
    plateau: { weeks_flat: 3, best_kg: kg(205), best_at: new Date(2026, 8, 17).toISOString() },
  }),
  progressRow('rv-ohp', 95, 0.12, TODAY, [[2, 26], [18, 23], [34, 21], [50, 17], [66, 15], [82, 11]]),
  progressRow('rv-row', 182, 0.09, new Date(2026, 9, 8, 18, 20), [[2, 24], [20, 21], [38, 19], [56, 16], [74, 13], [82, 12]]),
  progressRow('rv-squat', 268, 0.07, new Date(2026, 9, 7, 18, 30), [[2, 24], [18, 22], [34, 19], [50, 20], [66, 16], [82, 14]]),
  progressRow('rv-chinup', 231, 0.08, new Date(2026, 9, 6, 18, 40), [[2, 25], [18, 23], [34, 20], [50, 18], [66, 17], [82, 13]], {
    includes_bodyweight: true,
  }),
];

const curlSeries = bicepCurlSessions.map((s, i) => {
  const best = { weight_kg: Math.round(s.weightKg * 1000) / 1000, reps: s.reps[0] };
  return {
    workout_id: `rv-curl-${i}`,
    at: sessionDate(s.date),
    est_max_kg: epley(best.weight_kg, best.reps),
    best_set: best,
    sets: s.reps.map((reps) => ({ weight_kg: best.weight_kg, reps })),
  };
});
const curlWeight = (lb: number) => {
  const sessions = curlSeries.filter((p) => Math.abs(p.best_set.weight_kg - kg(lb)) < 0.001);
  return { weight_kg: kg(lb), sessions: sessions.length, first_at: sessions[0].at };
};

/** The frontier as GET /stats/exercises/{id}/frontier answers: the most reps at each weight,
 * without points another matches or beats on both (rule 8). Lightest first. */
function curlFrontier(asOf?: string) {
  const best = new Map<number, { weight_kg: number; reps: number; at: string }>();
  for (const s of curlSeries) {
    if (asOf && s.at > asOf) break;
    for (const set of s.sets) {
      const seen = best.get(set.weight_kg);
      if (!seen || set.reps > seen.reps) best.set(set.weight_kg, { weight_kg: set.weight_kg, reps: set.reps, at: s.at });
    }
  }
  const points = [...best.values()].sort((a, b) => a.weight_kg - b.weight_kg);
  return points.filter((p) => !points.some((q) => q !== p && q.weight_kg >= p.weight_kg && q.reps >= p.reps));
}

export function sampleFrontier(exerciseId: string, asOf: string) {
  return exerciseId === 'rv-curl' ? { points: curlFrontier(asOf) } : undefined;
}

/** 14: bicep curl, up from 14.0 lb on Aug 18 to 24.7 today, about 28 lb by Dec 1. */
export const sampleExerciseStats: ExerciseStats = {
  exercise_id: 'rv-curl',
  includes_bodyweight: false,
  est_max_kg: curlSeries[curlSeries.length - 1].est_max_kg,
  latest_at: curlSeries[curlSeries.length - 1].at,
  first: { at: curlSeries[0].at, est_max_kg: curlSeries[0].est_max_kg },
  is_new_best: true,
  series: curlSeries,
  weights: [curlWeight(10), curlWeight(15), curlWeight(20)],
  best_set: { weight_kg: kg(20), reps: 7, at: curlSeries[15].at },
  most_reps: { weight_kg: kg(10), reps: 14, at: curlSeries[4].at },
  heaviest: { weight_kg: kg(20), first_at: curlSeries[13].at },
  plateau: null,
  projection: { at: new Date(2026, 11, 1, 18, 40).toISOString(), est_max_kg: kg(28), weekly_gain_kg: kg(0.37), capped: true },
  frontier: curlFrontier(),
};

/** 15 and 16: bicep curl at one weight, as GET /stats/exercises/{id}/weights/{kg} answers. */
export function sampleOneWeight(exerciseId: string, weightKg: number): OneWeightStats | undefined {
  if (exerciseId !== sampleExerciseStats.exercise_id) return undefined;
  const same = (a: number) => Math.abs(a - weightKg) < 0.0005;
  const at = curlSeries.filter((s) => s.sets.some((x) => same(x.weight_kg)));
  if (!at.length) return undefined;
  const sessions = at.map((s) => {
    const reps = s.sets.filter((x) => same(x.weight_kg)).map((x) => x.reps);
    const total = reps.reduce((a, b) => a + b, 0);
    return {
      workout_id: s.workout_id,
      at: s.at,
      reps,
      total,
      average: Math.round((total / reps.length) * 100) / 100,
      retention: reps.length > 1 ? Math.round((reps[reps.length - 1] / reps[0]) * 10000) / 10000 : null,
    };
  });
  const movedUp = curlSeries.find((s) => s.at > at[0].at && s.sets.some((x) => x.weight_kg > weightKg + 0.0005));
  return {
    exercise_id: exerciseId,
    weight_kg: weightKg,
    sessions,
    total_change: sessions.length > 1 ? sessions[sessions.length - 1].total - sessions[0].total : null,
    first_retention: sessions[0].retention,
    latest_retention: sessions[sessions.length - 1].retention,
    moved_up_on: movedUp?.at ?? null,
  };
}
