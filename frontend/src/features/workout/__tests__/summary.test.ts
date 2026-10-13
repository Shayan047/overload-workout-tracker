import { bestsAfter, summarize, timeRange } from '../summary';
import type { ActiveWorkout } from '../workout';

const LB = 0.45359237;
const kg = (lb: number) => Math.round(lb * LB * 1000) / 1000;
const BW = kg(172);

// 11 as drawn: Shoulders & Arms, 6:12 to 6:59 PM on Friday, October 9, against Tuesday.
const plan: [string, number, number[], number[], boolean][] = [
  // exercise, lb, today's reps, last time's reps, bodyweight?
  ['ohp', 75, [8, 8, 7, 6], [8, 7, 7, 6], false],
  ['lateral', 20, [13, 12, 10], [12, 11, 10], false],
  ['curl', 20, [7, 6, 6, 5], [6, 5, 5, 4], false],
  ['hammer', 25, [9, 8, 7], [9, 8, 7], false],
  ['pushdown', 50, [12, 11, 10], [12, 12, 10], false],
  ['chinup', 10, [8, 7, 6], [8, 6, 6], true],
];

const state: ActiveWorkout = {
  workout: {
    id: 'w',
    split_day_id: 'day',
    title: 'Shoulders & Arms',
    started_at: new Date(2026, 9, 9, 18, 12).toISOString(),
    bodyweight_kg: BW,
  },
  exercises: [
    ...plan.map(([exercise_id], position) => ({
      id: `row-${position}`,
      exercise_id,
      position,
      status: 'done' as const,
      source: 'split' as const,
      rest_seconds: 90,
    })),
    { id: 'row-skipped', exercise_id: 'fly', position: 6, status: 'skipped', source: 'split', rest_seconds: 90 },
  ],
  sets: plan.flatMap(([, lb, reps], position) =>
    reps.map((r, i) => ({
      id: `set-${position}-${i}`,
      workout_exercise_id: `row-${position}`,
      set_number: i + 1,
      weight_kg: kg(lb),
      reps: r,
      logged_at: new Date(2026, 9, 9, 18, 15 + i).toISOString(),
    })),
  ),
  extraRows: {},
};

const last = plan.map(([exercise_id, lb, , reps, bodyweight]) => ({
  exercise_id,
  workout_id: 'tue',
  title: 'Shoulders & Arms',
  started_at: new Date(2026, 9, 6, 18, 0).toISOString(),
  ended_at: new Date(2026, 9, 6, 18, 47).toISOString(),
  bodyweight_kg: BW,
  sets: reps.map((r, i) => ({ set_number: i + 1, weight_kg: kg(lb), reps: r })),
  // The best so far was last time's best set.
  best_est_max_kg: Math.round((kg(lb) + (bodyweight ? BW : 0)) * (1 + reps[0] / 30) * 1000) / 1000,
}));

const bodyweightIds = new Set(['chinup']);
const endedAt = new Date(2026, 9, 9, 18, 59).toISOString();
const summary = summarize(state, endedAt, last, bodyweightIds);

describe('workout summary (11), computed on the phone so it works offline', () => {
  test('47 minutes, 20 sets, 9,427 lb lifted (chin-ups count bodyweight + added, rule 2)', () => {
    expect(summary.minutes).toBe(47);
    expect(summary.sets).toBe(20);
    expect(Math.round(summary.volumeKg / LB)).toBe(9427);
  });

  test('total reps against last time, per exercise in order, skipped ones left out', () => {
    expect(summary.exercises.map((e) => [e.exerciseId, e.today, e.last, e.delta])).toEqual([
      ['ohp', 29, 28, 1],
      ['lateral', 35, 33, 2],
      ['curl', 24, 20, 4],
      ['hammer', 24, 24, 0],
      ['pushdown', 33, 34, -1],
      ['chinup', 21, 20, 1],
    ]);
    expect([summary.ahead, summary.compared]).toEqual([4, 6]);
    expect(summary.lastDate).toBe(new Date(2026, 9, 6, 18, 0).toISOString());
  });

  test('new bests: est. max above the best so far, biggest gain first', () => {
    expect(summary.bests.map((b) => [b.exerciseId, b.set.reps, Number((b.estMaxKg / LB).toFixed(1)), Number((b.previousKg / LB).toFixed(1))])).toEqual([
      ['curl', 7, 24.7, 24],
      ['lateral', 13, 28.7, 28],
    ]);
  });

  test('a first time ever is not a "new best": nothing to beat', () => {
    const first = summarize(state, endedAt, last.filter((l) => l.exercise_id !== 'curl'), bodyweightIds);
    expect(first.bests.map((b) => b.exerciseId)).toEqual(['lateral']);
    expect(first.exercises.find((e) => e.exerciseId === 'curl')).toMatchObject({ last: null, delta: null });
    expect(first.compared).toBe(5);
  });

  test('after finishing, the cached best so far moves up to today’s', () => {
    expect(bestsAfter(summary).get('curl')).toBeCloseTo(kg(20) * (1 + 7 / 30), 3);
    expect(bestsAfter(summary).get('ohp')).toBeCloseTo(kg(75) * (1 + 8 / 30), 3);
  });
});

describe('timeRange: "Friday, Oct 9, 6:12 to 6:59 PM"', () => {
  test('same half of the day', () => {
    expect(timeRange(new Date(2026, 9, 9, 18, 12), new Date(2026, 9, 9, 18, 59))).toBe('Friday, Oct 9, 6:12 to 6:59 PM');
  });
  test('across noon', () => {
    expect(timeRange(new Date(2026, 9, 9, 11, 40), new Date(2026, 9, 9, 12, 25))).toBe('Friday, Oct 9, 11:40 AM to 12:25 PM');
  });
});
