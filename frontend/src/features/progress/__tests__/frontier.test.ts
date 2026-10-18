import { compareOptions, frontierChart, nextTargets } from '../frontier';

const LB = 0.45359237;
const kg = (lb: number) => Math.round(lb * LB * 1000) / 1000;
const day = (month: number, date: number) => new Date(2026, month - 1, date, 18, 40).toISOString();
const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 0);
const point = (lb: number, reps: number, at = day(9, 1)) => ({ weight_kg: kg(lb), reps, at });

// docs/product-spec.md: after Oct 9 the frontier is 20 × 7, 15 × 12, 10 × 14 (lightest first,
// as the API sends it). On Sep 15 it was 15 × 10, 10 × 14.
const today = [point(10, 14), point(15, 12, day(9, 28)), point(20, 7, day(10, 9))];
const sep15 = [point(10, 14), point(15, 10, day(9, 15))];

describe('frontier chart (17): positions match the design', () => {
  const chart = frontierChart({ today, compare: sep15, unit: 'lb' });

  test("today's points and labels: 20 × 7, 15 × 12 and 10 × 14", () => {
    expect(chart.today.points.map((p) => p.label)).toEqual(['20 × 7', '15 × 12', '10 × 14']);
    const expected = [
      // x, y, label x, label y, anchor
      [169.5, 60, 160, 47, 'middle'],
      [262, 100, 262, 86, 'middle'],
      [299, 140, 308, 160, 'start'],
    ];
    chart.today.points.forEach((p, i) => {
      near(p.x, expected[i][0] as number);
      near(p.y, expected[i][1] as number);
      near(p.labelX, expected[i][2] as number);
      near(p.labelY, expected[i][3] as number);
      expect(p.anchor).toBe(expected[i][4]);
    });
  });

  test('the line runs from the weight axis through the points down to the reps axis', () => {
    expect(chart.today.path).toBe('M40 60L169.5 60L262 100L299 140L299 220');
    expect(chart.today.area).toBe('40,60 169.5,60 262,100 299,140 299,220 40,220');
  });

  test('the earlier frontier is dashed, with hollow dots only where it differs from today', () => {
    expect(chart.compare!.path).toBe('M40 100L225 100L299 140L299 220');
    expect(chart.compare!.points.map((p) => [p.label, p.x, p.y, p.labelX, p.labelY])).toEqual([['15 × 10', 225, 100, 218, 120]]);
  });

  test('next targets: one more rep at the heaviest weight, and a first set at the next one', () => {
    expect(chart.targets.map((t) => [t.text, t.x, t.y])).toEqual([
      ['20 × 8', 188, 60],
      ['25 × 3', 95.5, 20],
    ]);
    expect(chart.targets.map((t) => t.note)).toEqual(['One rep past your best at 20 lb', 'Your first set at a new weight']);
  });

  test('axes: weight every 5 lb to 25, reps every 4 to 16', () => {
    expect(chart.yTicks.map((t) => [t.label, t.y])).toEqual([
      ['25', 20],
      ['20', 60],
      ['15', 100],
      ['10', 140],
      ['5', 180],
    ]);
    expect(chart.xTicks.map((t) => [t.label, t.x, t.anchor])).toEqual([
      ['0', 40, 'middle'],
      ['4', 114, 'middle'],
      ['8', 188, 'middle'],
      ['12', 262, 'middle'],
      ['16 reps', 336, 'end'],
    ]);
  });

  test('without a comparison', () => {
    expect(frontierChart({ today, compare: null, unit: 'lb' }).compare).toBeNull();
  });

  test('a single point is labelled above', () => {
    const one = frontierChart({ today: [point(10, 12)], compare: null, unit: 'lb' });
    expect(one.today.path).toMatch(/^M40 \d+(\.\d+)?L[\d.]+ [\d.]+L[\d.]+ 220$/);
    expect(one.today.points[0].anchor).toBe('middle');
    expect(one.today.points[0].labelY).toBeLessThan(one.today.points[0].y);
  });
});

describe('next targets', () => {
  test('the step up is the gap between the two heaviest weights', () => {
    expect(nextTargets([{ weight: 100, reps: 10 }, { weight: 90, reps: 12 }], 'lb')[1]).toMatchObject({ weight: 110 });
  });

  test('reps at the new weight come from the best est. max, at least 3', () => {
    // 100 × 10 is an est. max of 133.3; at 110 that predicts 6.4 reps.
    expect(nextTargets([{ weight: 100, reps: 10 }, { weight: 90, reps: 12 }], 'lb')[1].reps).toBe(6);
  });

  test('one weight: 5 lb or 2.5 kg up', () => {
    expect(nextTargets([{ weight: 20, reps: 8 }], 'lb')[1].weight).toBe(25);
    expect(nextTargets([{ weight: 20, reps: 8 }], 'kg')[1].weight).toBe(22.5);
  });

  test('none without a frontier', () => {
    expect(nextTargets([], 'lb')).toEqual([]);
  });
});

describe('compare with', () => {
  const at = [day(8, 18), day(8, 21), day(9, 11), day(9, 15), day(9, 18), day(10, 9)].map((iso) => ({ at: iso }));

  test('the session nearest the middle (the later on a tie), then the first', () => {
    expect(compareOptions(at).map((o) => o.label)).toEqual(['Sep 15', 'Aug 18']);
    expect(compareOptions(at)[0].at).toBe(day(9, 15));
  });

  test('two sessions: only the first; one: nothing', () => {
    expect(compareOptions(at.slice(0, 2)).map((o) => o.label)).toEqual(['Aug 18']);
    expect(compareOptions(at.slice(0, 1))).toEqual([]);
  });
});
