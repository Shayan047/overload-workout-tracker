import {
  addExercisesToWorkout,
  addRow,
  afterName,
  currentExercise,
  deleteSet,
  defaultWeightKg,
  finishWorkout,
  lastPlanned,
  logSet,
  markDone,
  mergeLastSessions,
  moveToEnd,
  plannedRows,
  restoreExercise,
  sessionsFrom,
  setsFor,
  skipExercise,
  startWorkout,
  swapExercise,
  type ActiveWorkout,
} from '../workout';

let n = 0;
const makeId = () => `id-${(n += 1)}`;
beforeEach(() => {
  n = 0;
});

const T0 = new Date(2026, 9, 9, 17, 22, 42);
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

const DAY = {
  id: 'day-2',
  name: 'Shoulders & Arms',
  exercises: [
    { id: 'sde-1', exercise_id: 'ohp', rest_seconds: 150 },
    { id: 'sde-2', exercise_id: 'curl', rest_seconds: 90 },
  ],
};

const start = () => startWorkout(DAY, { bodyweightKg: 78, now: T0, makeId });
const paths = (writes: { method: string; path: string }[]) => writes.map((w) => `${w.method} ${w.path}`);

describe('startWorkout', () => {
  test('creates the workout and one row per split exercise, copying rest lengths', () => {
    const { state, writes } = start();

    expect(state.workout).toEqual({
      id: 'id-1',
      split_day_id: 'day-2',
      title: 'Shoulders & Arms',
      started_at: T0.toISOString(),
      bodyweight_kg: 78,
    });
    expect(state.exercises.map((e) => [e.exercise_id, e.position, e.status, e.source, e.rest_seconds])).toEqual([
      ['ohp', 0, 'planned', 'split', 150],
      ['curl', 1, 'planned', 'split', 90],
    ]);
    expect(paths(writes)).toEqual(['PUT /workouts/id-1', 'PUT /workout-exercises/id-2', 'PUT /workout-exercises/id-3']);
    expect(writes[0].body).toEqual({
      split_day_id: 'day-2',
      title: 'Shoulders & Arms',
      started_at: T0.toISOString(),
      bodyweight_kg: 78,
    });
    expect(writes[1].body).toEqual({
      workout_id: 'id-1',
      exercise_id: 'ohp',
      position: 0,
      status: 'planned',
      source: 'split',
      rest_seconds: 150,
    });
  });

  test('with no bodyweight on the phone, the server fills in the latest entry', () => {
    const { state, writes } = startWorkout(DAY, { bodyweightKg: null, now: T0, makeId });
    expect(state.workout.bodyweight_kg).toBeNull();
    expect(writes[0].body).not.toHaveProperty('bodyweight_kg');
  });
});

describe('logging sets', () => {
  test('sets are numbered in order and written as PUTs', () => {
    let { state } = start();
    const row = state.exercises[0].id;
    let writes;
    ({ state, writes } = logSet(state, { rowId: row, weightKg: 34.019, reps: 8, now: at(5), makeId }));
    expect(paths(writes)).toEqual([`PUT /sets/id-4`]);
    expect(writes[0].body).toEqual({
      workout_exercise_id: row,
      set_number: 1,
      weight_kg: 34.019,
      reps: 8,
      logged_at: at(5).toISOString(),
    });
    ({ state } = logSet(state, { rowId: row, weightKg: 34.019, reps: 7, now: at(8), makeId }));
    expect(setsFor(state, row).map((s) => [s.set_number, s.reps])).toEqual([
      [1, 8],
      [2, 7],
    ]);
  });

  test('editing a logged set rewrites the same id', () => {
    let { state } = start();
    const row = state.exercises[0].id;
    ({ state } = logSet(state, { rowId: row, weightKg: 34, reps: 8, now: at(5), makeId }));
    const setId = setsFor(state, row)[0].id;
    const result = logSet(state, { rowId: row, setId, weightKg: 36, reps: 6, now: at(9), makeId });

    expect(paths(result.writes)).toEqual([`PUT /sets/${setId}`]);
    expect(result.writes[0].body).toMatchObject({ set_number: 1, weight_kg: 36, reps: 6, logged_at: at(5).toISOString() });
    expect(setsFor(result.state, row)).toHaveLength(1);
  });

  test('finishing the planned sets marks the exercise done and moves on', () => {
    let { state } = start();
    const [ohp, curl] = state.exercises.map((e) => e.id);
    expect(currentExercise(state, {})?.id).toBe(ohp);
    let writes: { method: string; path: string; body?: unknown }[] = [];
    for (let i = 0; i < 3; i += 1) {
      ({ state, writes } = logSet(state, { rowId: ohp, weightKg: 34, reps: 8, now: at(i), makeId, plannedSets: 3 }));
    }
    expect(paths(writes)).toEqual([`PUT /sets/id-6`, `PUT /workout-exercises/${ohp}`]);
    expect(writes[1].body).toMatchObject({ status: 'done' });
    expect(state.exercises[0].status).toBe('done');
    expect(currentExercise(state, {})?.id).toBe(curl);
  });

  test('deleting a set renumbers the ones after it', () => {
    let { state } = start();
    const row = state.exercises[0].id;
    for (const reps of [8, 7, 6]) ({ state } = logSet(state, { rowId: row, weightKg: 34, reps, now: at(reps), makeId }));
    const [first, second, third] = setsFor(state, row);
    const result = deleteSet(state, first.id);

    expect(paths(result.writes)).toEqual([`DELETE /sets/${first.id}`, `PUT /sets/${second.id}`, `PUT /sets/${third.id}`]);
    expect(setsFor(result.state, row).map((s) => [s.set_number, s.reps])).toEqual([
      [1, 7],
      [2, 6],
    ]);
  });
});

describe('rows and defaults', () => {
  test('rows: as many as last time (3 when there is no last time), plus added ones', () => {
    let { state } = start();
    const row = state.exercises[0].id;
    expect(plannedRows(state, row, 4)).toBe(4);
    expect(plannedRows(state, row, 0)).toBe(3);
    state = addRow(state, row);
    expect(plannedRows(state, row, 4)).toBe(5);
    for (let i = 0; i < 6; i += 1) ({ state } = logSet(state, { rowId: row, weightKg: 34, reps: 5, now: at(i), makeId }));
    expect(plannedRows(state, row, 4)).toBe(6); // never fewer than logged
  });

  test('the next set’s weight: the previous set today, else last time’s set, else nothing', () => {
    let { state } = start();
    const row = state.exercises[0].id;
    const last = [
      { set_number: 1, weight_kg: 34.019, reps: 8 },
      { set_number: 2, weight_kg: 31.751, reps: 8 },
    ];
    expect(defaultWeightKg(state, row, last)).toBe(34.019);
    expect(defaultWeightKg(state, row, [])).toBeNull();
    ({ state } = logSet(state, { rowId: row, weightKg: 36.287, reps: 6, now: at(1), makeId }));
    expect(defaultWeightKg(state, row, last)).toBe(36.287);
  });

  test('a focused exercise wins over the first planned one', () => {
    const { state } = start();
    expect(currentExercise(state, { focusId: state.exercises[1].id })?.exercise_id).toBe('curl');
  });
});

describe('finishWorkout', () => {
  test('writes ended_at, keeping the start and snapshot', () => {
    const { state } = start();
    const { workout, writes } = finishWorkout(state as ActiveWorkout, at(47));
    expect(workout.ended_at).toBe(at(47).toISOString());
    expect(paths(writes)).toEqual(['PUT /workouts/id-1']);
    expect(writes[0].body).toEqual({
      split_day_id: 'day-2',
      title: 'Shoulders & Arms',
      started_at: T0.toISOString(),
      ended_at: at(47).toISOString(),
      bodyweight_kg: 78,
    });
  });
});

describe('after finishing: last time for the next workout, offline', () => {
  test('each exercise with sets becomes its own last session', () => {
    let { state } = start();
    const [ohp] = state.exercises.map((e) => e.id);
    for (const reps of [8, 7]) ({ state } = logSet(state, { rowId: ohp, weightKg: 34, reps, now: at(reps), makeId }));
    const sessions = sessionsFrom(state, at(47).toISOString(), 78);

    expect(sessions).toEqual([
      {
        exercise_id: 'ohp',
        workout_id: 'id-1',
        title: 'Shoulders & Arms',
        started_at: T0.toISOString(),
        ended_at: at(47).toISOString(),
        bodyweight_kg: 78,
        sets: [
          { set_number: 1, weight_kg: 34, reps: 8 },
          { set_number: 2, weight_kg: 34, reps: 7 },
        ],
      },
    ]); // curl had no sets, so its last time stays as it was
  });

  test('merging: per exercise, the session that ended last wins', () => {
    const session = (exercise_id: string, ended_at: string) => ({
      exercise_id,
      workout_id: `w-${ended_at}`,
      title: 'Day',
      started_at: ended_at,
      ended_at,
      bodyweight_kg: 78,
      sets: [],
    });
    const server = [session('ohp', '2026-10-06T18:00:00Z'), session('curl', '2026-10-06T18:00:00Z')];
    const local = [session('ohp', '2026-10-09T18:00:00Z'), session('row', '2026-10-09T18:00:00Z')];
    expect(mergeLastSessions(server, local).map((s) => [s.exercise_id, s.ended_at])).toEqual([
      ['ohp', '2026-10-09T18:00:00Z'],
      ['curl', '2026-10-06T18:00:00Z'],
      ['row', '2026-10-09T18:00:00Z'],
    ]);
  });
});

describe('today-only changes (10): PUTs to this workout’s rows, never to the split', () => {
  const rowPaths = (writes: { method: string; path: string }[]) => {
    expect(writes.every((w) => w.path.startsWith('/workout-exercises/'))).toBe(true);
    return paths(writes);
  };

  test('swap: the same row with the new exercise, marked swapped', () => {
    const { state } = start();
    const [, curl] = state.exercises;
    const result = swapExercise(state, curl.id, 'hammer');
    expect(rowPaths(result.writes)).toEqual([`PUT /workout-exercises/${curl.id}`]);
    expect(result.writes[0].body).toMatchObject({ exercise_id: 'hammer', source: 'swapped', position: 1, rest_seconds: 90 });
    expect(result.state.exercises[1]).toMatchObject({ id: curl.id, exercise_id: 'hammer', source: 'swapped' });
  });

  test('skip, and undo', () => {
    const { state } = start();
    const [ohp, curl] = state.exercises.map((e) => e.id);
    const skipped = skipExercise(state, ohp);
    expect(skipped.writes[0].body).toMatchObject({ status: 'skipped' });
    expect(currentExercise(skipped.state, {})?.id).toBe(curl);
    const back = restoreExercise(skipped.state, ohp);
    expect(back.writes[0].body).toMatchObject({ status: 'planned' });
    expect(currentExercise(back.state, {})?.id).toBe(ohp);
  });

  test('move to the end: after the last row', () => {
    const { state } = start();
    const [ohp, curl] = state.exercises.map((e) => e.id);
    const moved = moveToEnd(state, ohp);
    expect(moved.writes[0].body).toMatchObject({ position: 2 });
    expect(currentExercise(moved.state, {})?.id).toBe(curl);
    expect(lastPlanned(moved.state)?.id).toBe(ohp);
  });

  test('add: new rows at the end, marked added, with the default rest', () => {
    const { state } = start();
    const result = addExercisesToWorkout(state, ['row', 'fly'], makeId);
    expect(rowPaths(result.writes)).toEqual(['PUT /workout-exercises/id-4', 'PUT /workout-exercises/id-5']);
    expect(result.state.exercises.slice(2).map((e) => [e.exercise_id, e.position, e.source, e.status, e.rest_seconds])).toEqual([
      ['row', 2, 'added', 'planned', 90],
      ['fly', 3, 'added', 'planned', 90],
    ]);
  });

  test('done for today: an exercise with sets stops early', () => {
    let { state } = start();
    const [ohp, curl] = state.exercises.map((e) => e.id);
    ({ state } = logSet(state, { rowId: ohp, weightKg: 34, reps: 8, now: at(1), makeId }));
    const result = markDone(state, ohp);
    expect(result.writes[0].body).toMatchObject({ status: 'done' });
    expect(currentExercise(result.state, {})?.id).toBe(curl);
  });
});

describe('afterName: "Do it after chin-ups"', () => {
  test.each([
    ['Chin-up', 'chin-ups'],
    ['Triceps pushdown', 'triceps pushdowns'],
    ['Leg press', 'leg presses'],
    ['Dumbbell fly', 'dumbbell flies'],
    ['Triceps', 'triceps'],
    ['Bench press', 'bench presses'],
  ])('%s → %s', (name, plural) => {
    expect(afterName(name)).toBe(plural);
  });
});
