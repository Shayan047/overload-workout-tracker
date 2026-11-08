import { LINES, perSetEstMax, sessionLines } from '../sessionLines';

const LB = 0.45359237;
const kg = (lb: number) => Math.round(lb * LB * 1000) / 1000;
const epley = (w: number, r: number) => w * (1 + r / 30);

const session = (id: string, at: string, weightKg: number, reps: number[], offsetKg = 0) => {
  const bestReps = Math.max(...reps);
  return {
    workout_id: id,
    at,
    est_max_kg: Math.round(epley(weightKg + offsetKg, bestReps) * 1000) / 1000,
    best_set: { weight_kg: weightKg, reps: bestReps },
    sets: reps.map((r) => ({ weight_kg: weightKg, reps: r })),
  };
};

// 14's "Your last 3 workouts": bicep curl at 20 lb.
const last3 = [
  session('oct2', '2026-10-02T18:00:00Z', kg(20), [6, 5, 4, 4]),
  session('oct6', '2026-10-06T18:00:00Z', kg(20), [6, 5, 5, 4]),
  session('oct9', '2026-10-09T18:00:00Z', kg(20), [7, 6, 6, 5]),
];

describe('perSetEstMax: Epley for every set (rule 4)', () => {
  test('a weighted exercise uses each set’s weight', () => {
    expect(perSetEstMax(last3[2], false).map((v) => Math.round((v / LB) * 100) / 100)).toEqual([24.67, 24, 24, 23.33]);
  });

  test('a bodyweight exercise adds that session’s bodyweight, recovered from its est. max (rule 2)', () => {
    const chinup = session('c', '2026-10-06T18:00:00Z', kg(10), [8, 6, 6], kg(172));
    const values = perSetEstMax(chinup, true);
    expect(values[0]).toBeCloseTo(epley(kg(182), 8), 2);
    expect(values[2]).toBeCloseTo(epley(kg(182), 6), 2);
  });
});

describe('sessionLines: 14’s chart in its SVG coordinates', () => {
  const chart = sessionLines(last3, 'lb');

  test('gridlines every pound from 25 down to 22', () => {
    expect(chart.ticks.map((t) => t.label)).toEqual(['25', '24', '23', '22']);
    expect(chart.ticks[0].y).toBe(LINES.top);
    expect(chart.ticks[3].y).toBe(LINES.bottom);
  });

  test('sets spread across the plot, labelled Set 1 to Set 4', () => {
    expect(chart.xLabels.map((l) => [l.text, Math.round(l.x * 10) / 10])).toEqual([
      ['Set 1', 44],
      ['Set 2', 139.3],
      ['Set 3', 234.7],
      ['Set 4', 330],
    ]);
  });

  test('one line per session, newest first, with its age', () => {
    expect(chart.lines.map((l) => [l.workoutId, l.age])).toEqual([
      ['oct9', 0],
      ['oct6', 1],
      ['oct2', 2],
    ]);
    // 20 lb is stored as 9.072 kg (20.0002 lb), so within a fifth of a unit of 14's drawing.
    [35.6, 66.7, 66.7, 97.8].forEach((y, i) => expect(Math.abs(chart.lines[0].points[i].y - y)).toBeLessThan(0.2));
  });

  test('a session with fewer sets stops early', () => {
    const short = sessionLines([...last3.slice(0, 2), session('x', '2026-10-09T18:00:00Z', kg(20), [7, 6])], 'lb');
    expect(short.lines[0].points).toHaveLength(2);
    expect(short.xLabels).toHaveLength(4);
  });

  test('a single set sits in the middle', () => {
    const one = sessionLines([session('x', '2026-10-09T18:00:00Z', kg(20), [7])], 'lb');
    expect(one.lines[0].points[0].x).toBe((LINES.left + LINES.right) / 2);
  });

  test('a taller frame (23) keeps the same rules', () => {
    const tall = sessionLines(last3, 'lb', { ...LINES, height: 306, top: 16, bottom: 276 });
    expect(tall.ticks[0].y).toBe(16);
    expect(tall.ticks[tall.ticks.length - 1].y).toBe(276);
  });
});
