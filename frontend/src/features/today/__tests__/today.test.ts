import type { SplitTree } from '@/features/splits/draft';

import { bestSetText, dateHeading, nextDayId, relativeDay, todayPlan, type FinishedWorkout } from '../today';

const FRI = new Date(2026, 9, 9, 18, 5); // Friday, October 9

const split = (repeat_mode: 'in_order' | 'weekdays', weekdays: (number | null)[] = [null, null, null]): SplitTree => ({
  id: 's',
  name: 'Arnold split',
  repeat_mode,
  days: ['Chest & Back', 'Shoulders & Arms', 'Legs'].map((name, i) => ({
    id: `d${i}`,
    name,
    weekday: weekdays[i],
    exercises: [],
  })),
});

const done = (dayId: string, month: number, day: number): FinishedWorkout => ({
  split_day_id: dayId,
  ended_at: new Date(2026, month, day, 19).toISOString(),
});

describe('nextDayId (same rule as the API)', () => {
  test('in order: the first day, then the day after the last one done, wrapping', () => {
    expect(nextDayId(split('in_order'), [], FRI)).toBe('d0');
    expect(nextDayId(split('in_order'), [done('d0', 9, 8)], FRI)).toBe('d1');
    expect(nextDayId(split('in_order'), [done('d2', 9, 8)], FRI)).toBe('d0');
  });

  test('in order: rest days never shift it', () => {
    const history = [done('d0', 9, 1)];
    for (let d = 2; d < 30; d += 1) {
      expect(nextDayId(split('in_order'), history, new Date(2026, 9, d))).toBe('d1');
    }
  });

  test('in order: the most recent finished workout counts, not the order of the list', () => {
    expect(nextDayId(split('in_order'), [done('d1', 9, 8), done('d0', 9, 2)], FRI)).toBe('d2');
  });

  test('in order: workouts for days of other splits are ignored', () => {
    expect(nextDayId(split('in_order'), [done('other', 9, 8), done('d0', 9, 1)], FRI)).toBe('d1');
  });

  test('set weekdays: the day for this weekday, whatever was done', () => {
    const s = split('weekdays', [0, 2, 4]); // Mon, Wed, Fri
    expect(nextDayId(s, [], FRI)).toBe('d2');
    expect(nextDayId(s, [done('d2', 9, 9)], new Date(2026, 9, 12))).toBe('d0'); // Monday
    expect(nextDayId(s, [], new Date(2026, 9, 10))).toBeNull(); // Saturday: rest
  });
});

describe('todayPlan', () => {
  test('in order: yesterday’s day, today’s and the next one (07)', () => {
    const plan = todayPlan(split('in_order'), [done('d0', 9, 8)], FRI);

    expect(plan.kind).toBe('train');
    if (plan.kind !== 'train') return;
    expect(plan.day.name).toBe('Shoulders & Arms');
    expect(plan.position).toBe(2);
    expect(plan.strip).toEqual([
      { dayId: 'd0', name: 'Chest & Back', role: 'previous', label: 'Yesterday', done: true },
      { dayId: 'd1', name: 'Shoulders & Arms', role: 'today', label: 'Today', done: false },
      { dayId: 'd2', name: 'Legs', role: 'next', label: 'Next', done: false },
    ]);
  });

  test('in order, nothing done yet: today and next only', () => {
    const plan = todayPlan(split('in_order'), [], FRI);
    expect(plan.kind === 'train' && plan.strip.map((s) => s.role)).toEqual(['today', 'next']);
  });

  test('a one-day split has no strip neighbours', () => {
    const one: SplitTree = { ...split('in_order'), days: [split('in_order').days[0]] };
    const plan = todayPlan(one, [done('d0', 9, 8)], FRI);
    expect(plan.kind === 'train' && plan.strip.map((s) => s.role)).toEqual(['today']);
  });

  test('set weekdays: neighbours are the scheduled days before and after', () => {
    const plan = todayPlan(split('weekdays', [0, 2, 4]), [done('d1', 9, 7)], FRI);
    expect(plan.kind === 'train' && plan.strip).toEqual([
      { dayId: 'd1', name: 'Shoulders & Arms', role: 'previous', label: 'Wed', done: true },
      { dayId: 'd2', name: 'Legs', role: 'today', label: 'Today', done: false },
      { dayId: 'd0', name: 'Chest & Back', role: 'next', label: 'Mon', done: false },
    ]);
  });

  test('set weekdays: a missed day shows unchecked', () => {
    const plan = todayPlan(split('weekdays', [0, 2, 4]), [], FRI);
    expect(plan.kind === 'train' && plan.strip[0]).toMatchObject({ role: 'previous', done: false });
  });

  test('set weekdays, nothing today: a rest day, with the next scheduled one', () => {
    const plan = todayPlan(split('weekdays', [0, 2, 4]), [], new Date(2026, 9, 10)); // Saturday
    expect(plan).toEqual({ kind: 'rest', next: { dayId: 'd0', name: 'Chest & Back', label: 'Mon' } });
  });

  test('"Do a different day" overrides today', () => {
    const plan = todayPlan(split('in_order'), [done('d0', 9, 8)], FRI, 'd2');
    expect(plan.kind === 'train' && plan.day.name).toBe('Legs');
    expect(plan.kind === 'train' && plan.position).toBe(3);
  });

  test('a split with no days', () => {
    expect(todayPlan({ ...split('in_order'), days: [] }, [], FRI)).toEqual({ kind: 'empty' });
  });
});

describe('dates', () => {
  test('relativeDay', () => {
    expect(relativeDay(new Date(2026, 9, 9, 7), FRI)).toBe('Today');
    expect(relativeDay(new Date(2026, 9, 8, 23), FRI)).toBe('Yesterday');
    expect(relativeDay(new Date(2026, 9, 10, 9), FRI)).toBe('Tomorrow');
    expect(relativeDay(new Date(2026, 9, 6), FRI)).toBe('Tue');
    expect(relativeDay(new Date(2026, 9, 12), FRI)).toBe('Mon');
    expect(relativeDay(new Date(2026, 9, 2), FRI)).toBe('Oct 2');
    expect(relativeDay(new Date(2026, 9, 20), FRI)).toBe('Oct 20');
  });

  test('dateHeading', () => {
    expect(dateHeading(FRI)).toBe('Friday, October 9');
  });
});

describe('bestSetText (07: "75 × 8", "BW+10 × 8")', () => {
  const LB = 0.45359237;
  const set = (lb: number, reps: number) => ({ set_number: 1, weight_kg: Math.round(lb * LB * 1000) / 1000, reps });

  test('the set with the highest est. max, in the user’s unit', () => {
    const sets = [set(70, 10), set(75, 8), set(75, 6)];
    expect(bestSetText(sets, { unit: 'lb', bodyweightKg: 78, bodyweight: false })).toBe('75 × 8');
    expect(bestSetText([{ set_number: 1, weight_kg: 34, reps: 8 }], { unit: 'kg', bodyweightKg: 78, bodyweight: false })).toBe(
      '34 × 8',
    );
  });

  test('bodyweight exercises show the added weight, and the load picks the best set', () => {
    const sets = [set(10, 8), set(0, 12), set(25, 3)];
    // Loads with 172 lb bodyweight: 182 × 8 (230.5), 172 × 12 (240.8), 197 × 3 (216.7).
    expect(bestSetText(sets, { unit: 'lb', bodyweightKg: 172 * LB, bodyweight: true })).toBe('BW × 12');
    expect(bestSetText([set(10, 8)], { unit: 'lb', bodyweightKg: 172 * LB, bodyweight: true })).toBe('BW+10 × 8');
  });

  test('nothing logged: null', () => {
    expect(bestSetText([], { unit: 'lb', bodyweightKg: 78, bodyweight: false })).toBeNull();
  });
});
