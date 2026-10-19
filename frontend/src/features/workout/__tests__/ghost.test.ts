import {
  aheadText,
  applyKey,
  elapsedText,
  exerciseDelta,
  ghost,
  ghostDate,
  lastTimeText,
  setText,
} from '../ghost';

const LB = 0.45359237;
const lb = (n: number) => Math.round(n * LB * 1000) / 1000;
const set = (n: number, w: number, reps: number) => ({ set_number: n, weight_kg: lb(w), reps });

describe('ghost (08): reps through the sets logged so far, against the same sets last time', () => {
  const last = [set(1, 20, 6), set(2, 20, 5), set(3, 20, 5), set(4, 20, 4)];

  test('after two sets of 7 and 6 against 6 and 5', () => {
    expect(ghost([set(1, 20, 7), set(2, 20, 6)], last)).toEqual({ sets: 2, you: 13, last: 11, lastTotal: 20, delta: 2 });
  });

  test('before any set', () => {
    expect(ghost([], last)).toEqual({ sets: 0, you: 0, last: 0, lastTotal: 20, delta: 0 });
  });

  test('more sets than last time: the extra sets count, last time stays at its total', () => {
    expect(ghost([6, 5, 5, 4, 3].map((r, i) => set(i + 1, 20, r)), last)).toMatchObject({ you: 23, last: 20, delta: 3 });
  });

  test('ahead/behind wording', () => {
    expect(aheadText(2, 'reps')).toBe('Ahead by 2 reps');
    expect(aheadText(1, 'reps')).toBe('Ahead by 1 rep');
    expect(aheadText(-1, 'reps')).toBe('Behind by 1 rep');
    expect(aheadText(0, 'reps')).toBe('Level with last time');
    expect(aheadText(1, 'short')).toBe('Ahead by 1');
    expect(aheadText(-2, 'short')).toBe('Behind by 2');
    expect(aheadText(0, 'short')).toBe('Level');
  });

  test('a finished exercise against last time (08’s done cards)', () => {
    expect(exerciseDelta(29, 28)).toBe('+1 rep');
    expect(exerciseDelta(35, 33)).toBe('+2 reps');
    expect(exerciseDelta(33, 34)).toBe('−1 rep');
    expect(exerciseDelta(24, 24)).toBe('Even');
  });
});

describe('text', () => {
  test('a set: "20 × 6", bodyweight "BW+10 × 8"', () => {
    expect(setText(set(1, 20, 6), 'lb', false)).toBe('20 × 6');
    expect(setText(set(1, 10, 8), 'lb', true)).toBe('BW+10 × 8');
    expect(setText(set(1, 0, 12), 'lb', true)).toBe('BW × 12');
  });

  test('last time in Up next: "25 × 9, 8, 7"', () => {
    expect(lastTimeText([set(1, 25, 9), set(2, 25, 8), set(3, 25, 7)], 'lb', false)).toBe('25 × 9, 8, 7');
    expect(lastTimeText([set(1, 25, 9), set(2, 22.5, 8)], 'lb', false)).toBe('25 × 9, 22.5 × 8');
    expect(lastTimeText([set(1, 10, 8), set(2, 10, 6), set(3, 10, 6)], 'lb', true)).toBe('bodyweight + 10 × 8, 6, 6');
    expect(lastTimeText([set(1, 0, 12)], 'lb', true)).toBe('bodyweight × 12');
  });

  test('elapsed time from timestamps', () => {
    const start = new Date(2026, 9, 9, 17, 22, 42);
    expect(elapsedText(start, new Date(2026, 9, 9, 18, 5, 0))).toBe('42:18');
    expect(elapsedText(start, new Date(2026, 9, 9, 17, 22, 50))).toBe('0:08');
    expect(elapsedText(start, new Date(2026, 9, 9, 18, 25, 0))).toBe('1:02:18');
    expect(elapsedText(start, new Date(2026, 9, 9, 17, 0))).toBe('0:00');
  });

  test('ghost date: "Tue, Oct 6"', () => {
    expect(ghostDate(new Date(2026, 9, 6, 18, 47))).toBe('Tue, Oct 6');
  });
});

describe('applyKey (09’s keypad)', () => {
  test('reps: digits append, three at most, no decimal point', () => {
    let reps = { text: '', fresh: true };
    for (const key of ['1', '2', '.', '3', '4']) reps = applyKey(reps, key, 'reps');
    expect(reps.text).toBe('123');
    expect(applyKey({ text: '12', fresh: false }, 'delete', 'reps').text).toBe('1');
  });

  test('weight: the first key replaces the value shown, then digits append, one decimal point', () => {
    let weight = { text: '20', fresh: true };
    weight = applyKey(weight, '2', 'weight');
    expect(weight).toEqual({ text: '2', fresh: false });
    for (const key of ['2', '.', '5', '.', '0', '0']) weight = applyKey(weight, key, 'weight');
    expect(weight.text).toBe('22.500');
    expect(applyKey({ text: '20', fresh: true }, '.', 'weight').text).toBe('0.');
    expect(applyKey({ text: '20', fresh: true }, 'delete', 'weight').text).toBe('2');
  });
});
