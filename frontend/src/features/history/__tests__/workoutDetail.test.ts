import type { OutboxEntry } from '@/api/outbox';
import { type WorkoutDetail, withPendingDetail } from '@/api/pendingWrites';

import { editDraft, planWorkoutEdit, checkDraft, type EditDraft } from '../workoutEdit';
import { dayText, workoutView } from '../workoutDetail';

const LB = 0.45359237;

const detail = (): WorkoutDetail => ({
  id: 'w-1',
  split_day_id: 'day-1',
  title: 'Shoulders & Arms',
  started_at: '2026-10-06T18:00:00.000Z',
  ended_at: '2026-10-06T18:45:00.000Z',
  bodyweight_kg: 78,
  exercises: [
    {
      id: 'row-1',
      workout_id: 'w-1',
      exercise_id: 'curl',
      position: 0,
      status: 'done',
      source: 'split',
      rest_seconds: 90,
      sets: [
        { id: 's-1', workout_exercise_id: 'row-1', set_number: 1, weight_kg: 10, reps: 6, logged_at: '2026-10-06T18:05:00.000Z' },
        { id: 's-2', workout_exercise_id: 'row-1', set_number: 2, weight_kg: 10, reps: 5, logged_at: '2026-10-06T18:08:00.000Z' },
      ],
    },
    {
      id: 'row-2',
      workout_id: 'w-1',
      exercise_id: 'chinup',
      position: 1,
      status: 'done',
      source: 'split',
      rest_seconds: 120,
      sets: [{ id: 's-3', workout_exercise_id: 'row-2', set_number: 1, weight_kg: 5, reps: 8, logged_at: '2026-10-06T18:20:00.000Z' }],
    },
  ],
});

const entry = (method: OutboxEntry['method'], path: string, body?: unknown): OutboxEntry => ({
  id: `${method} ${path}`,
  method,
  path,
  body,
  createdAt: '2026-10-07T09:00:00.000Z',
});

describe('withPendingDetail: a past workout with the writes still on the phone', () => {
  test('without pending writes it is the server’s answer', () => {
    expect(withPendingDetail(detail(), null, [])).toEqual(detail());
  });

  test('an edited set and a deleted set show at once', () => {
    const pending = [
      entry('PUT', '/sets/s-2', { workout_exercise_id: 'row-1', set_number: 2, weight_kg: 10, reps: 7, logged_at: '2026-10-06T18:08:00.000Z' }),
      entry('DELETE', '/sets/s-1'),
    ];
    const sets = withPendingDetail(detail(), null, pending)!.exercises[0].sets;
    expect(sets.map((s) => [s.id, s.reps])).toEqual([['s-2', 7]]);
  });

  test('sets of other workouts are ignored', () => {
    const pending = [entry('PUT', '/sets/x-1', { workout_exercise_id: 'other-row', set_number: 1, weight_kg: 1, reps: 1, logged_at: '' })];
    expect(withPendingDetail(detail(), null, pending)).toEqual(detail());
  });

  test('a workout the server has not received is built from the outbox, in order', () => {
    const summary = { id: 'w-2', split_day_id: null, title: 'Legs', started_at: '2026-10-09T17:00:00.000Z', ended_at: '2026-10-09T17:50:00.000Z', bodyweight_kg: 78 };
    const pending = [
      entry('PUT', '/workouts/w-2', { title: 'Legs', started_at: summary.started_at, bodyweight_kg: 78 }),
      entry('PUT', '/workout-exercises/r-2', { workout_id: 'w-2', exercise_id: 'curl', position: 1, status: 'planned', source: 'split', rest_seconds: 60 }),
      entry('PUT', '/workout-exercises/r-1', { workout_id: 'w-2', exercise_id: 'squat', position: 0, status: 'planned', source: 'split', rest_seconds: 120 }),
      entry('PUT', '/sets/a-2', { workout_exercise_id: 'r-1', set_number: 2, weight_kg: 100, reps: 5, logged_at: '2026-10-09T17:10:00.000Z' }),
      entry('PUT', '/sets/a-1', { workout_exercise_id: 'r-1', set_number: 1, weight_kg: 100, reps: 6, logged_at: '2026-10-09T17:05:00.000Z' }),
      entry('PUT', '/workouts/w-2', { ended_at: summary.ended_at }),
    ];
    const built = withPendingDetail(null, summary, pending)!;
    expect(built.ended_at).toBe(summary.ended_at);
    expect(built.exercises.map((r) => r.id)).toEqual(['r-1', 'r-2']);
    expect(built.exercises[0].sets.map((s) => s.id)).toEqual(['a-1', 'a-2']);
  });

  test('a workout deleted on the phone is gone', () => {
    expect(withPendingDetail(detail(), null, [entry('DELETE', '/workouts/w-1')])).toBeNull();
  });

  test('nothing from the server and nothing on the phone is nothing', () => {
    expect(withPendingDetail(null, null, [])).toBeNull();
  });
});

describe('workoutView: what 21 shows', () => {
  test('minutes, sets, volume with bodyweight, and each exercise’s best set', () => {
    const view = workoutView(detail(), new Set(['chinup']));
    expect(view.minutes).toBe(45);
    expect(view.sets).toBe(3);
    // 10 × 6 + 10 × 5 + (78 + 5) × 8
    expect(view.volumeKg).toBe(774);
    expect(view.exercises.map((e) => [e.exerciseId, e.totalReps, e.bestIndex])).toEqual([
      ['curl', 11, 0],
      ['chinup', 8, 0],
    ]);
    expect(view.exercises[0].estMaxKg).toBeCloseTo(12);
    // Rule 2: the bodyweight snapshot plus the added weight.
    expect(view.exercises[1].estMaxKg).toBeCloseTo(83 * (1 + 8 / 30));
  });

  test('exercises without sets are left out', () => {
    const d = detail();
    d.exercises[1].sets = [];
    expect(workoutView(d, new Set()).exercises.map((e) => e.exerciseId)).toEqual(['curl']);
  });
});

describe('planWorkoutEdit: the edit (22) as outbox writes', () => {
  const draft = (): EditDraft => editDraft(detail(), 'kg');

  test('no changes, no writes', () => {
    expect(planWorkoutEdit(detail(), draft(), 'kg', () => 'new')).toEqual([]);
  });

  test('an untouched weight keeps its exact kg even in pounds', () => {
    const d = detail();
    d.exercises[0].sets[0].weight_kg = 9.072; // 20 lb as stored
    const edit = editDraft(d, 'lb');
    edit.rows[0].sets[0].repsText = '7';
    const writes = planWorkoutEdit(d, edit, 'lb', () => 'new');
    expect(writes).toEqual([
      { method: 'PUT', path: '/sets/s-1', body: { workout_exercise_id: 'row-1', set_number: 1, weight_kg: 9.072, reps: 7, logged_at: '2026-10-06T18:05:00.000Z' } },
    ]);
  });

  test('a typed weight is converted to kg (rule 1)', () => {
    const edit = editDraft(detail(), 'lb');
    edit.rows[0].sets[1].weightText = '25';
    const [write] = planWorkoutEdit(detail(), edit, 'lb', () => 'new');
    expect(write.method === 'PUT' && write.body.weight_kg).toBe(Math.round(25 * LB * 1000) / 1000);
  });

  test('deleting a set deletes it and renumbers the rest', () => {
    const edit = draft();
    edit.rows[0].sets.splice(0, 1);
    expect(planWorkoutEdit(detail(), edit, 'kg', () => 'new')).toEqual([
      { method: 'PUT', path: '/sets/s-2', body: { workout_exercise_id: 'row-1', set_number: 1, weight_kg: 10, reps: 5, logged_at: '2026-10-06T18:08:00.000Z' } },
      { method: 'DELETE', path: '/sets/s-1' },
    ]);
  });

  test('an added set gets a new id, the next number, and its exercise’s last time', () => {
    const edit = draft();
    edit.rows[0].sets.push({ id: null, weightText: '10', repsText: '4', original: null });
    expect(planWorkoutEdit(detail(), edit, 'kg', () => 'new-1')).toEqual([
      { method: 'PUT', path: '/sets/new-1', body: { workout_exercise_id: 'row-1', set_number: 3, weight_kg: 10, reps: 4, logged_at: '2026-10-06T18:08:00.000Z' } },
    ]);
  });
});

describe('checkDraft: what Save says no to', () => {
  test('a filled-in draft is fine', () => {
    expect(checkDraft(editDraft(detail(), 'kg'))).toBeNull();
  });

  test('empty or impossible numbers are named', () => {
    const edit = editDraft(detail(), 'kg');
    edit.rows[0].sets[1].repsText = '';
    expect(checkDraft(edit)).toBe('Set 2 needs reps.');
    edit.rows[0].sets[1].repsText = '5';
    edit.rows[0].sets[0].weightText = '-3';
    expect(checkDraft(edit)).toBe('Set 1 needs a weight of 0 or more.');
  });
});

test('dayText names the day as 22 does', () => {
  expect(dayText(new Date(2026, 9, 6, 18))).toBe('Tuesday, Oct 6');
});
