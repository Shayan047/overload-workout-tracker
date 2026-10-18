import { calendar, monthNote, ordinal, workoutLine } from '../history';

const NOW = new Date(2026, 9, 9, 18, 5); // Friday, October 9
const on = (month: number, date: number, hour = 18, minutes = 47) => ({
  started_at: new Date(2026, month - 1, date, hour, 0).toISOString(),
  ended_at: new Date(2026, month - 1, date, hour, minutes).toISOString(),
});
// 18: trained Oct 1–3 and 5–9; Sunday the 4th was a rest day.
const october = [1, 2, 3, 5, 6, 7, 8, 9].map((d) => on(10, d));
const withAugust = [on(8, 3), ...october];

describe('calendar (18)', () => {
  const month = calendar(2026, 9, withAugust, NOW);

  test('weeks start on Monday; October 2026 starts on a Thursday', () => {
    expect(month.weeks).toHaveLength(5);
    expect(month.weeks[0].map((c) => c?.day ?? null)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(month.weeks[4].map((c) => c?.day ?? null)).toEqual([26, 27, 28, 29, 30, 31, null]);
  });

  test('trained days get a dot, today is marked, later days are dimmed', () => {
    const state = (day: number) => month.weeks.flat().find((c) => c?.day === day)!.state;
    expect(state(1)).toBe('trained');
    expect(state(4)).toBe('rest');
    expect(state(9)).toBe('today-trained');
    expect(state(10)).toBe('future');
  });

  test('title', () => {
    expect(month.title).toBe('October 2026');
  });

  test('today without a workout yet', () => {
    const state = calendar(2026, 9, october.slice(0, -1), NOW).weeks.flat().find((c) => c?.day === 9)!.state;
    expect(state).toBe('today');
  });
});

describe('the line under the calendar', () => {
  test("this month: workouts so far and the rest days before today (18)", () => {
    expect(monthNote(2026, 9, withAugust, NOW)).toBe('8 workouts so far this month. Your only rest day was Sunday the 4th.');
  });

  test('more rest days, none, and nothing yet', () => {
    const fewer = october.filter((_, i) => i !== 2 && i !== 4);
    expect(monthNote(2026, 9, [on(8, 3), ...fewer], NOW)).toBe('6 workouts so far this month, with 3 rest days.');
    const daily = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => on(10, d));
    expect(monthNote(2026, 9, [on(8, 3), ...daily], NOW)).toBe('8 workouts so far this month. No rest days yet.');
    expect(monthNote(2026, 9, [on(8, 3)], NOW)).toBe('No workouts yet this month.');
  });

  test('rest days only count from the first workout ever', () => {
    expect(monthNote(2026, 9, [on(10, 6), on(10, 7), on(10, 8)], NOW)).toBe('3 workouts so far this month. No rest days yet.');
  });

  test('an earlier month: just the count', () => {
    expect(monthNote(2026, 7, withAugust, NOW)).toBe('1 workout in August.');
    expect(monthNote(2026, 6, withAugust, NOW)).toBe('No workouts in July.');
    expect(monthNote(2026, 10, withAugust, NOW)).toBe('');
  });

  test('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ]);
  });
});

test('a workout row: day, minutes and sets', () => {
  expect(workoutLine({ ...on(10, 9, 18, 47), sets: 20 })).toBe('Fri, Oct 9. 47 min, 20 sets');
  expect(workoutLine({ ...on(10, 9, 18, 30), sets: 1 })).toBe('Fri, Oct 9. 30 min, 1 set');
});
