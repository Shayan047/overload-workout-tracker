import {
  aheadText,
  applyKey,
  changeText,
  compare,
  comparisonText,
  elapsedText,
  exerciseDelta,
  ghost,
  ghostDate,
  isAhead,
  lastTimeText,
  setText,
} from '../ghost';

const LB = 0.45359237;
const lb = (n: number) => Math.round(n * LB * 1000) / 1000;
const set = (n: number, w: number, reps: number) => ({ set_number: n, weight_kg: lb(w), reps });

describe('ghost (08): reps through the sets logged so far, against the same sets last time', () => {
  const last = [set(1, 20, 6), set(2, 20, 5), set(3, 20, 5), set(4, 20, 4)];

  test('after two sets of 7 and 6 against 6 and 5, at the same weight', () => {
    expect(ghost([set(1, 20, 7), set(2, 20, 6)], last)).toEqual({
      sets: 2,
      lastTotal: 20,
      comparison: { kind: 'reps', you: 13, last: 11, delta: 2 },
    });
  });

  test('before any set', () => {
    expect(ghost([], last)).toEqual({ sets: 0, lastTotal: 20, comparison: { kind: 'reps', you: 0, last: 0, delta: 0 } });
  });

  test('more sets than last time: the extra sets count, last time stays at its total', () => {
    expect(ghost([6, 5, 5, 4, 3].map((r, i) => set(i + 1, 20, r)), last).comparison).toMatchObject({ you: 23, last: 20, delta: 3 });
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

describe('compare (option B): the weight decides what is compared', () => {
  // 25: chest press, last time 100 × 10, 9, 8.
  const lastTime = [set(1, 100, 10), set(2, 100, 9), set(3, 100, 8)];

  test('same top weight: reps', () => {
    expect(ghost([set(1, 100, 11)], lastTime).comparison).toEqual({ kind: 'reps', you: 11, last: 10, delta: 1 });
  });

  test('moving up on set 2: heavier, against the same sets last time', () => {
    const c = ghost([set(1, 100, 11), set(2, 110, 7)], lastTime).comparison!;
    expect(c.kind).toBe('heavier');
    expect(c.kind === 'heavier' && Math.round((c.upKg / LB) * 10) / 10).toBe(10);
    expect(isAhead(c)).toBe(true);
    expect(comparisonText(c, 'lb', 'panel')).toBe('Up 10 lb');
    expect(comparisonText(c, 'lb', 'short')).toBe('Up 10 lb');
  });

  test('a pyramid is not lighter at set 1: only last time’s same sets count', () => {
    const pyramid = [set(1, 100, 10), set(2, 110, 8), set(3, 120, 6)];
    expect(ghost([set(1, 100, 10)], pyramid).comparison!.kind).toBe('reps');
  });

  test('lighter: est. max from the best set (rule 4)', () => {
    // 24: 17.5 × 10 against 20 × 6 → 23.3 against 24.0.
    const c = compare([set(1, 17.5, 10)], [set(1, 20, 6)])!;
    expect(c.kind).toBe('lighter');
    expect(isAhead(c)).toBe(false);
    expect(comparisonText(c, 'lb', 'panel')).toBe('Est. max 0.7 lb behind');
    expect(comparisonText(c, 'lb', 'short')).toBe('Est. max −0.7');
    expect(changeText(c, 'lb', 'summary')).toBe('−0.7');
    expect(changeText(c, 'lb', 'done')).toBe('−0.7 est.');
  });

  test('lighter but stronger counts as ahead', () => {
    const c = compare([set(1, 17.5, 12)], [set(1, 20, 6)])!;
    expect(isAhead(c)).toBe(true);
    expect(comparisonText(c, 'lb', 'panel')).toBe('Est. max 0.5 lb ahead');
  });

  test('bodyweight exercises compare added weight, and est. max counts each workout’s bodyweight', () => {
    expect(compare([set(1, 15, 6)], [set(1, 10, 8)], { today: lb(172), last: lb(172) })!.kind).toBe('heavier');
    const lighter = compare([set(1, 5, 8)], [set(1, 10, 8)], { today: lb(180), last: lb(172) })!;
    // (180 + 5) × 1.267 against (172 + 10) × 1.267: ahead, because the bodyweight went up.
    expect(lighter.kind === 'lighter' && isAhead(lighter)).toBe(true);
  });

  test('the change column and done cards', () => {
    expect(changeText({ kind: 'reps', you: 29, last: 28, delta: 1 }, 'lb', 'summary')).toBe('+1');
    expect(changeText({ kind: 'reps', you: 29, last: 28, delta: 1 }, 'lb', 'done')).toBe('+1 rep');
    expect(changeText({ kind: 'reps', you: 24, last: 24, delta: 0 }, 'lb', 'summary')).toBe('Even');
    expect(changeText(compare([set(1, 22.5, 8)], [set(1, 20, 13)])!, 'lb', 'summary')).toBe('+2.5 lb');
  });

  test('zero-rep sets never decide the weight', () => {
    expect(compare([set(1, 110, 0), set(2, 100, 10)], [set(1, 100, 9), set(2, 100, 9)])!.kind).toBe('reps');
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
