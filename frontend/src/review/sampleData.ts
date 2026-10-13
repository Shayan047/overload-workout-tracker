// Fixed data for review mode (see reviewMode.ts), taken from the designs and from
// docs/product-spec.md. Weights are in kg, as the API sends them; the sample user's unit
// is lb, so screens show the designs' lb numbers. Screens read from here in review mode
// once they exist (chunks 10–20).

import type { Preset, SplitDraft } from '@/features/splits/draft';
import type { LastSession, WorkoutSummary } from '@/api/workouts';
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
});

export const sampleLastSessions: LastSession[] = [
  lastSession('rv-ohp', 75, [8, 7, 7, 6]),
  lastSession('rv-lateral', 20, [12, 11, 10]),
  lastSession('rv-curl', 20, [6, 5, 5, 4]),
  lastSession('rv-hammer', 25, [9, 8, 7]),
  lastSession('rv-pushdown', 50, [12, 12, 10]),
  lastSession('rv-chinup', 10, [8, 6, 6]),
];

/** Bicep curl history from docs/product-spec.md ("Sample data for stats tests"). */
export const bicepCurlSessions = [
  { date: '2026-08-18', weightKg: kg(10), reps: [12, 8, 7, 7] },
  { date: '2026-08-21', weightKg: kg(10), reps: [12, 9, 9, 8] },
  { date: '2026-08-25', weightKg: kg(10), reps: [12, 10, 9, 9] },
  { date: '2026-08-28', weightKg: kg(10), reps: [13, 11, 10, 10] },
  { date: '2026-09-01', weightKg: kg(10), reps: [14, 12, 11, 11] },
  { date: '2026-09-28', weightKg: kg(15), reps: [12, 10, 9, 9] },
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

export const sampleActiveWorkout: { state: ActiveWorkout; focusId: string | null } = {
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
};
