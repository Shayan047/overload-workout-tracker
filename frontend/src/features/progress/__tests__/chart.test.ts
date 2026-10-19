import { estMaxChart, sparkline } from '../chart';

const LB = 0.45359237;
const kg = (lb: number) => lb * LB;
const day = (month: number, date: number) => new Date(2026, month - 1, date, 18, 0).toISOString();

// 14 as drawn: bicep curl, 16 sessions from Aug 18 to today (Oct 9) at 10, 15 and 20 lb,
// projected to about 28 lb by Dec 1.
const sessions: [number, number, number, number][] = [
  // month, date, weight (lb), est. max (lb)
  [8, 18, 10, 14.0],
  [8, 21, 10, 14.0],
  [8, 25, 10, 14.0],
  [8, 28, 10, 14.3],
  [9, 1, 10, 14.7],
  [9, 4, 15, 19.0],
  [9, 8, 15, 19.5],
  [9, 11, 15, 19.5],
  [9, 15, 15, 20.0],
  [9, 18, 15, 20.0],
  [9, 22, 15, 20.5],
  [9, 25, 15, 20.5],
  [9, 28, 15, 21.0],
  [10, 2, 20, 24.0],
  [10, 6, 20, 24.0],
  [10, 9, 20, 24.7],
];
const series = sessions.map(([m, d, w, e]) => ({ at: day(m, d), est_max_kg: kg(e), best_set: { weight_kg: kg(w), reps: 1 } }));
const chart = estMaxChart({
  series,
  projection: { at: day(12, 1), est_max_kg: kg(28) },
  unit: 'lb',
  now: new Date(2026, 9, 9, 18, 5),
});
const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 0);

describe('est. max chart (14): positions match the design', () => {
  test('points: x by date from the first session to the projection, 7 px per lb', () => {
    const expected = [
      [30, 132], [38.9, 132], [50.7, 132], [59.5, 129.9], [71.3, 127.1],
      [80.2, 97], [92, 93.5], [100.9, 93.5], [112.7, 90], [121.5, 90],
      [133.3, 86.5], [142.2, 86.5], [151, 83], [162.9, 62], [174.7, 62], [183.5, 57.1],
    ];
    chart.points.forEach((p, i) => {
      near(p.x, expected[i][0]);
      near(p.y, expected[i][1]);
    });
  });

  test('gridlines every 5 lb from 10 to 30, labelled', () => {
    expect(chart.ticks.map((t) => [t.label, Math.round(t.y)])).toEqual([
      ['30', 20],
      ['25', 55],
      ['20', 90],
      ['15', 125],
      ['10', 160],
    ]);
  });

  test('weight bands change halfway between sessions, labelled by weight', () => {
    expect(chart.bands.map((b) => b.label)).toEqual(['10 lb', '15 lb', '20 lb']);
    near(chart.bands[0].x0, 30);
    near(chart.bands[0].x1, 75.7);
    near(chart.bands[1].x1, 157);
    near(chart.bands[2].x1, 189);
    expect(chart.bands.map((b) => b.shade)).toEqual([0, 1, 0]);
  });

  test('projection: dashed to "~28 lb" at Dec 1', () => {
    near(chart.projection!.x, 340);
    near(chart.projection!.y, 34);
    expect(chart.projection!.label).toBe('~28 lb');
  });

  test('x labels: first session, the session nearest the middle, Today, and the projection date', () => {
    expect(chart.xLabels.map((l) => [l.text, l.anchor, l.current])).toEqual([
      ['Aug 18', 'start', false],
      ['Sep 15', 'middle', false],
      ['Today', 'middle', true],
      ['Dec 1', 'end', false],
    ]);
    [30, 112.7, 183.5, 340].forEach((x, i) => near(chart.xLabels[i].x, x));
  });

  test('a single session still draws, centred, without bands that make no sense', () => {
    const one = estMaxChart({ series: series.slice(0, 1), projection: null, unit: 'lb', now: new Date(2026, 7, 18, 19) });
    expect(one.points).toHaveLength(1);
    expect(one.points[0].x).toBeGreaterThanOrEqual(30);
    expect(one.points[0].x).toBeLessThanOrEqual(340);
  });
});

describe('sparkline (13): first to last session across 2–82, lowest at the bottom', () => {
  test('path and end dot', () => {
    const s = sparkline([
      { at: day(8, 18), est_max_kg: 10 },
      { at: day(9, 15), est_max_kg: 15 },
      { at: day(10, 13), est_max_kg: 20 },
    ]);
    expect(s.path).toBe('M2 28L42 17L82 6');
    expect(s.end).toEqual({ x: 82, y: 6 });
  });

  test('flat: a level line through the middle', () => {
    expect(sparkline([{ at: day(8, 18), est_max_kg: 10 }, { at: day(9, 1), est_max_kg: 10 }]).path).toBe('M2 17L82 17');
  });

  test('one session: a dot only', () => {
    expect(sparkline([{ at: day(8, 18), est_max_kg: 10 }])).toEqual({ path: '', end: { x: 82, y: 17 } });
  });
});
