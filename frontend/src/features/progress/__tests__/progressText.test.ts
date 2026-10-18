import {
  changeText,
  estMaxText,
  orderProgress,
  progressSubtitle,
  sessionSets,
  sessionTitle,
  sinceFirstText,
  statusOf,
  whenText,
} from '../progressText';

const LB = 0.45359237;
const kg = (lb: number) => lb * LB;
const NOW = new Date(2026, 9, 9, 19, 5);
const today = new Date(2026, 9, 9, 18, 40).toISOString();
const item = (id: string, over: object = {}) => ({
  exercise_id: id,
  latest_at: new Date(2026, 9, 7).toISOString(),
  is_new_best: false,
  plateau: null as null | { weeks_flat: number },
  ...over,
});

describe('Progress (13)', () => {
  test('est. max: one decimal under 100, whole above', () => {
    expect(estMaxText(kg(24.7), 'lb')).toBe('24.7');
    expect(estMaxText(kg(95), 'lb')).toBe('95.0');
    expect(estMaxText(kg(205.2), 'lb')).toBe('205');
  });

  test('change over the window', () => {
    expect(changeText(0.764)).toBe('+76%');
    expect(changeText(-0.031)).toBe('−3%');
    expect(changeText(0)).toBe('0%');
    expect(changeText(null)).toBe('');
  });

  test('status: new best today, a plateau, or nothing', () => {
    expect(statusOf(item('a', { is_new_best: true, latest_at: today }), NOW)).toEqual({ kind: 'best', text: 'New best today' });
    expect(statusOf(item('a', { is_new_best: true, latest_at: new Date(2026, 9, 8).toISOString() }), NOW)).toEqual({
      kind: 'best',
      text: 'New best yesterday',
    });
    expect(statusOf(item('a', { plateau: { weeks_flat: 3 } }), NOW)).toEqual({ kind: 'plateau', text: 'Flat for 3 weeks' });
    expect(statusOf(item('a'), NOW)).toEqual({ kind: 'plain' });
  });

  test('subtitle: "2 new bests today, 1 lift flat for 3 weeks."', () => {
    const items = [
      item('a', { is_new_best: true, latest_at: today }),
      item('b', { is_new_best: true, latest_at: today }),
      item('c', { plateau: { weeks_flat: 3 } }),
      item('d'),
    ];
    expect(progressSubtitle(items, NOW)).toBe('2 new bests today, 1 lift flat for 3 weeks.');
    expect(progressSubtitle([item('c', { plateau: { weeks_flat: 4 } }), item('e', { plateau: { weeks_flat: 3 } })], NOW)).toBe(
      '2 lifts flat for 3+ weeks.',
    );
    expect(progressSubtitle([item('d')], NOW)).toBe('No plateaus. Keep it going.');
    expect(progressSubtitle([], NOW)).toBe('Finish a workout to see your progress here.');
  });

  test('order: new bests today, then plateaus, then the rest as the API sends them', () => {
    const items = [item('plain-1'), item('flat', { plateau: { weeks_flat: 3 } }), item('best', { is_new_best: true, latest_at: today }), item('plain-2')];
    expect(orderProgress(items, NOW).map((i) => i.exercise_id)).toEqual(['best', 'flat', 'plain-1', 'plain-2']);
  });
});

describe('Exercise detail (14)', () => {
  test('since the first session', () => {
    expect(sinceFirstText(kg(24.7), { at: new Date(2026, 7, 18).toISOString(), est_max_kg: kg(14) }, 'lb')).toEqual({
      up: true,
      text: 'Up 10.7 lb since your first session, Aug 18',
    });
    expect(sinceFirstText(kg(13), { at: new Date(2026, 7, 18).toISOString(), est_max_kg: kg(14) }, 'lb')).toEqual({
      up: false,
      text: 'Down 1.0 lb since your first session, Aug 18',
    });
  });

  test('dates: "today", "Sep 1", and session titles', () => {
    expect(whenText(today, NOW)).toBe('today');
    expect(whenText(new Date(2026, 8, 1).toISOString(), NOW)).toBe('Sep 1');
    expect(whenText(new Date(2025, 8, 1).toISOString(), NOW)).toBe('Sep 1, 2025');
    expect(sessionTitle(today, NOW)).toBe('Today');
    expect(sessionTitle(new Date(2026, 9, 6).toISOString(), NOW)).toBe('Tue, Oct 6');
  });

  test('a session’s sets: "20 lb × 7, 6, 6, 5"; a new weight starts a new group', () => {
    const at = (lb: number, reps: number) => ({ weight_kg: kg(lb), reps });
    expect(sessionSets([at(20, 7), at(20, 6), at(20, 6), at(20, 5)], 'lb', false)).toBe('20 lb × 7, 6, 6, 5');
    expect(sessionSets([at(20, 6), at(15, 10)], 'lb', false)).toBe('20 lb × 6, 15 lb × 10');
    expect(sessionSets([at(10, 8), at(0, 6)], 'lb', true)).toBe('BW+10 lb × 8, BW × 6');
  });
});
