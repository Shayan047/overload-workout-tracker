import {
  addDay,
  addExercises,
  draftFromPreset,
  draftFromTree,
  moveDay,
  moveExercise,
  newDraft,
  removeDay,
  removeExercise,
  renameDay,
  renameSplit,
  setDayWeekday,
  setRepeatMode,
  setRest,
  validateDraft,
  type Preset,
  type SplitDraft,
} from '../draft';

let counter = 0;
const makeId = () => `id-${(counter += 1)}`;
beforeEach(() => {
  counter = 0;
});

const ARNOLD: Preset = {
  key: 'arnold',
  name: 'Arnold split',
  summary: '3-day rotation',
  repeat_mode: 'in_order',
  days: [
    { name: 'Chest & Back', weekday: null, exercises: [{ exercise_id: 'bench', rest_seconds: 150 }] },
    {
      name: 'Shoulders & Arms',
      weekday: null,
      exercises: [
        { exercise_id: 'ohp', rest_seconds: 150 },
        { exercise_id: 'curl', rest_seconds: 90 },
      ],
    },
    { name: 'Legs', weekday: null, exercises: [] },
  ],
};

const SPLIT = '11111111-2222-4333-8444-555555555555';

describe('starting a draft', () => {
  test('from a preset: its days and exercises, with ids derived like the server does', () => {
    const draft = draftFromPreset(ARNOLD, SPLIT);

    expect(draft.id).toBe(SPLIT);
    expect(draft.name).toBe('Arnold split');
    expect(draft.repeatMode).toBe('in_order');
    expect(draft.days.map((d) => d.name)).toEqual(['Chest & Back', 'Shoulders & Arms', 'Legs']);
    // Python: uuid.uuid5(UUID(SPLIT), "day:0") and "day:1:exercise:1"
    expect(draft.days[0].id).toBe('8ec520e9-e8f9-5f0f-be6e-7ea280c63772');
    expect(draft.days[1].exercises.map((e) => [e.exerciseId, e.restSeconds])).toEqual([
      ['ohp', 150],
      ['curl', 90],
    ]);
  });

  test('from scratch: one empty day', () => {
    const draft = newDraft(makeId);
    expect(draft).toEqual({
      id: 'id-1',
      name: 'My split',
      repeatMode: 'in_order',
      days: [{ id: 'id-2', name: 'Day 1', weekday: null, exercises: [] }],
    });
  });

  test('from a saved split, in order', () => {
    const draft = draftFromTree({
      id: 's',
      name: 'Mine',
      repeat_mode: 'weekdays',
      days: [
        {
          id: 'd1',
          name: 'A',
          weekday: 0,
          exercises: [{ id: 'x1', exercise_id: 'bench', rest_seconds: 120 }],
        },
      ],
    });
    expect(draft).toEqual({
      id: 's',
      name: 'Mine',
      repeatMode: 'weekdays',
      days: [{ id: 'd1', name: 'A', weekday: 0, exercises: [{ id: 'x1', exerciseId: 'bench', restSeconds: 120 }] }],
    });
  });
});

describe('editing', () => {
  const base = (): SplitDraft => draftFromPreset(ARNOLD, SPLIT);

  test('rename the split and a day; names are trimmed when checked, not while typing', () => {
    let draft = renameSplit(base(), 'Arnold, my way ');
    draft = renameDay(draft, draft.days[2].id, 'Leg day');
    expect(draft.name).toBe('Arnold, my way ');
    expect(draft.days[2].name).toBe('Leg day');
  });

  test('switching to set weekdays spreads days over the week when they have none', () => {
    const draft = setRepeatMode(base(), 'weekdays');
    expect(draft.days.map((d) => d.weekday)).toEqual([0, 2, 4]); // Mon, Wed, Fri
    expect(setRepeatMode(draft, 'in_order').days.map((d) => d.weekday)).toEqual([0, 2, 4]);
  });

  test('add a day: named after its place, on a free weekday in weekdays mode', () => {
    let draft = addDay(base(), makeId);
    expect(draft.days.at(-1)).toEqual({ id: 'id-1', name: 'Day 4', weekday: null, exercises: [] });

    draft = addDay(setRepeatMode(base(), 'weekdays'), makeId);
    expect(draft.days.at(-1)?.weekday).toBe(1); // Tue: the first day not taken by Mon, Wed, Fri
  });

  test('remove and reorder days', () => {
    const draft = base();
    const [chest, shoulders, legs] = draft.days;
    expect(removeDay(draft, shoulders.id).days.map((d) => d.id)).toEqual([chest.id, legs.id]);
    expect(moveDay(draft, 2, 0).days.map((d) => d.id)).toEqual([legs.id, chest.id, shoulders.id]);
    expect(moveDay(draft, 0, 0)).toBe(draft);
  });

  test('add exercises to a day, skipping ones already in it, with the default rest', () => {
    const draft = base();
    const day = draft.days[1];
    const next = addExercises(draft, day.id, ['curl', 'hammer', 'pushdown'], makeId);
    expect(next.days[1].exercises.map((e) => [e.exerciseId, e.restSeconds])).toEqual([
      ['ohp', 150],
      ['curl', 90],
      ['hammer', 90],
      ['pushdown', 90],
    ]);
  });

  test('remove, reorder and set rest on exercises', () => {
    const draft = base();
    const day = draft.days[1];
    const [ohp, curl] = day.exercises;

    expect(removeExercise(draft, day.id, ohp.id).days[1].exercises).toEqual([curl]);
    expect(moveExercise(draft, day.id, 1, 0).days[1].exercises.map((e) => e.id)).toEqual([curl.id, ohp.id]);
    expect(setRest(draft, day.id, curl.id, 105).days[1].exercises[1].restSeconds).toBe(105);
    expect(setRest(draft, day.id, curl.id, -15).days[1].exercises[1].restSeconds).toBe(0);
    expect(setRest(draft, day.id, curl.id, 4000).days[1].exercises[1].restSeconds).toBe(3600);
  });

  test('a weekday can be set per day', () => {
    const draft = setRepeatMode(base(), 'weekdays');
    expect(setDayWeekday(draft, draft.days[0].id, 6).days[0].weekday).toBe(6);
  });

  test('edits never change the draft they were given', () => {
    const draft = base();
    const before = JSON.stringify(draft);
    renameSplit(draft, 'x');
    addDay(draft, makeId);
    removeDay(draft, draft.days[0].id);
    addExercises(draft, draft.days[0].id, ['a'], makeId);
    setRest(draft, draft.days[1].id, draft.days[1].exercises[0].id, 30);
    expect(JSON.stringify(draft)).toBe(before);
  });
});

describe('validateDraft', () => {
  const base = (): SplitDraft => draftFromPreset(ARNOLD, SPLIT);

  test('a preset is valid as it comes', () => {
    expect(validateDraft(base())).toBeNull();
  });

  test('names are required', () => {
    expect(validateDraft(renameSplit(base(), '  '))).toBe('Give your split a name.');
    const draft = base();
    expect(validateDraft(renameDay(draft, draft.days[1].id, ''))).toBe('Give day 2 a name.');
  });

  test('a split needs a day', () => {
    const draft = base();
    const empty = draft.days.reduce((d, day) => removeDay(d, day.id), draft);
    expect(validateDraft(empty)).toBe('Add at least one day.');
  });

  test('set weekdays: every day on its own weekday', () => {
    let draft = setRepeatMode(base(), 'weekdays');
    draft = setDayWeekday(draft, draft.days[1].id, 0);
    expect(validateDraft(draft)).toBe('Two days are set to Monday. Give each day its own weekday.');
  });
});
