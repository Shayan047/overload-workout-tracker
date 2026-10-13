import type { SplitDraft } from '../draft';
import { planSplitWrites } from '../plan';

const draft = (): SplitDraft => ({
  id: 's',
  name: 'Arnold split',
  repeatMode: 'in_order',
  days: [
    { id: 'd1', name: 'Chest & Back', weekday: null, exercises: [{ id: 'x1', exerciseId: 'bench', restSeconds: 150 }] },
    {
      id: 'd2',
      name: 'Shoulders & Arms',
      weekday: null,
      exercises: [
        { id: 'x2', exerciseId: 'ohp', restSeconds: 150 },
        { id: 'x3', exerciseId: 'curl', restSeconds: 90 },
      ],
    },
  ],
});

const paths = (writes: ReturnType<typeof planSplitWrites>) => writes.map((w) => `${w.method} ${w.path}`);

test('a new split writes the split, then its days, then their exercises, in order', () => {
  const writes = planSplitWrites(null, draft());

  expect(paths(writes)).toEqual([
    'PUT /splits/s',
    'PUT /split-days/d1',
    'PUT /split-days/d2',
    'PUT /split-day-exercises/x1',
    'PUT /split-day-exercises/x2',
    'PUT /split-day-exercises/x3',
  ]);
  expect(writes[0].body).toEqual({ name: 'Arnold split', repeat_mode: 'in_order' });
  expect(writes[2].body).toEqual({ split_id: 's', name: 'Shoulders & Arms', position: 1, weekday: null });
  expect(writes[5].body).toEqual({ split_day_id: 'd2', exercise_id: 'curl', position: 1, rest_seconds: 90 });
});

test('names are sent trimmed', () => {
  const edited = { ...draft(), name: '  Arnold  ' };
  edited.days[0] = { ...edited.days[0], name: ' Chest ' };
  const writes = planSplitWrites(null, edited);
  expect(writes[0].body).toEqual({ name: 'Arnold', repeat_mode: 'in_order' });
  expect(writes[1].body).toMatchObject({ name: 'Chest' });
});

test('saving an unchanged split writes nothing', () => {
  expect(planSplitWrites(draft(), draft())).toEqual([]);
});

test('only what changed is written', () => {
  const edited = draft();
  edited.name = 'Arnold, my way';
  edited.days = [edited.days[1], edited.days[0]]; // swap the days
  edited.days[0] = {
    ...edited.days[0],
    exercises: [{ ...edited.days[0].exercises[0], restSeconds: 120 }, edited.days[0].exercises[1]],
  };

  expect(paths(planSplitWrites(draft(), edited))).toEqual([
    'PUT /splits/s',
    'PUT /split-days/d2', // position 1 -> 0
    'PUT /split-days/d1', // position 0 -> 1
    'PUT /split-day-exercises/x2', // rest 150 -> 120
  ]);
});

test('removed exercises and days are deleted, exercises before days', () => {
  const edited = draft();
  edited.days = [{ ...edited.days[1], exercises: [edited.days[1].exercises[1]] }];

  expect(paths(planSplitWrites(draft(), edited))).toEqual([
    'PUT /split-days/d2', // position 1 -> 0
    'PUT /split-day-exercises/x3', // position 1 -> 0
    'DELETE /split-day-exercises/x2',
    'DELETE /split-days/d1',
  ]);
});

test('switching repeat mode rewrites the split and the days whose weekday changed', () => {
  const edited = { ...draft(), repeatMode: 'weekdays' as const };
  edited.days = edited.days.map((d, i) => ({ ...d, weekday: i * 2 }));
  expect(paths(planSplitWrites(draft(), edited))).toEqual([
    'PUT /splits/s',
    'PUT /split-days/d1',
    'PUT /split-days/d2',
  ]);
});
