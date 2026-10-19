import {
  fingerprint,
  movedUpTo,
  percentText,
  progressHero,
  retentionHero,
  stackedBars,
  type WeightSession,
} from '../oneWeight';

const LB = 0.45359237;
const kg = (lb: number) => Math.round(lb * LB * 1000) / 1000;
const day = (month: number, date: number) => new Date(2026, month - 1, date, 18, 40).toISOString();
const NOW = new Date(2026, 9, 9, 18, 5);
const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 0);

// docs/product-spec.md: bicep curl at 10 lb, as GET /stats/exercises/{id}/weights/{kg} sends it.
const session = (month: number, date: number, reps: number[]): WeightSession => {
  const total = reps.reduce((a, b) => a + b, 0);
  return {
    workout_id: `w-${month}-${date}`,
    at: day(month, date),
    reps,
    total,
    average: total / reps.length,
    retention: reps[reps.length - 1] / reps[0],
  };
};
const sessions = [
  session(8, 18, [12, 8, 7, 7]),
  session(8, 21, [12, 9, 9, 8]),
  session(8, 25, [12, 10, 9, 9]),
  session(8, 28, [13, 11, 10, 10]),
  session(9, 1, [14, 12, 11, 11]),
];

describe('sample data: the totals and retention docs/product-spec.md expects', () => {
  test('totals 34, 38, 40, 44, 48 and retention 58%, 67%, 75%, 77%, 79%', () => {
    expect(stackedBars(sessions, NOW).bars.map((b) => b.total)).toEqual([34, 38, 40, 44, 48]);
    expect(sessions.map((s) => percentText(s.retention!))).toEqual(['58%', '67%', '75%', '77%', '79%']);
  });
});

describe('stacked bars (15): positions match the design', () => {
  const chart = stackedBars(sessions, NOW);

  test('gridlines every 10 reps from 0 to 50', () => {
    expect(chart.ticks.map((t) => [t.label, Math.round(t.y)])).toEqual([
      ['50', 20],
      ['40', 56],
      ['30', 92],
      ['20', 128],
      ['10', 164],
      ['0', 200],
    ]);
  });

  test('one 44 px bar per session, evenly spaced', () => {
    [64.8, 126.4, 188, 249.6, 311.2].forEach((x, i) => near(chart.bars[i].x, x));
    expect(chart.barWidth).toBe(44);
  });

  test('a segment per set, set 1 at the bottom, 2 px apart, reps inside', () => {
    const first = chart.bars[0];
    const expected = [
      // y, height, label y
      [156.8, 41.2, 181.4],
      [128, 26.8, 145.4],
      [102.8, 23.2, 118.4],
      [77.6, 23.2, 93.2],
    ];
    first.segments.forEach((s, i) => {
      near(s.y, expected[i][0]);
      near(s.height, expected[i][1]);
      near(s.labelY, expected[i][2]);
      expect(s.shade).toBe(i);
      expect(s.showLabel).toBe(true);
    });
    expect(first.segments.map((s) => s.reps)).toEqual([12, 8, 7, 7]);
  });

  test('totals sit above each bar; the latest is current', () => {
    // The design's totals are hand-placed 7.2–8.2 px above their bars.
    [70, 55, 48, 34, 20].forEach((y, i) => expect(Math.abs(chart.bars[i].totalY - y)).toBeLessThanOrEqual(1));
    expect(chart.bars.map((b) => [b.label, b.current])).toEqual([
      ['Aug 18', false],
      ['Aug 21', false],
      ['Aug 25', false],
      ['Aug 28', false],
      ['Sep 1', true],
    ]);
  });

  test('legend: one key per set', () => {
    expect(chart.legend).toEqual(['Set 1', 'Set 2', 'Set 3', 'Set 4']);
  });

  test('sets past the fourth share the darkest shade, and the legend says so', () => {
    const many = stackedBars([session(9, 1, [10, 9, 8, 8, 7, 6])], NOW);
    expect(many.bars[0].segments.map((s) => s.shade)).toEqual([0, 1, 2, 3, 3, 3]);
    expect(many.legend).toEqual(['Set 1', 'Set 2', 'Set 3', 'Sets 4+']);
  });

  test('only the latest six sessions are drawn', () => {
    const lots = [...sessions, session(9, 4, [14, 12, 12, 11]), session(9, 8, [15, 12, 12, 12])];
    const drawn = stackedBars(lots, NOW).bars;
    expect(drawn).toHaveLength(6);
    expect(drawn[0].label).toBe('Aug 21');
  });

  test('a session today reads "Today"', () => {
    expect(stackedBars([session(10, 9, [8, 7])], NOW).bars[0].label).toBe('Today');
  });

  test('labels are left out of segments too thin to hold them', () => {
    const tall = stackedBars([session(9, 1, [40, 30, 2])], NOW);
    expect(tall.bars[0].segments.map((s) => s.showLabel)).toEqual([true, true, false]);
  });
});

describe('fingerprint (16): positions match the design', () => {
  const chart = fingerprint(sessions);

  test('gridlines every 2 reps from 6 to 14', () => {
    expect(chart.ticks.map((t) => t.label)).toEqual(['14', '12', '10', '8', '6']);
    [38.9, 76.7, 114.4, 152.2, 190].forEach((y, i) => near(chart.ticks[i].y, y));
  });

  test('the latest line in amber, earlier ones fading with age', () => {
    expect(chart.latest.points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10])).toEqual([
      [40, 38.9],
      [136.7, 76.7],
      [233.3, 95.6],
      [330, 95.6],
    ]);
    expect(chart.earlier.map((l) => l.opacity)).toEqual([0.35, 0.5, 0.65, 0.85]);
    const aug18 = chart.earlier[0].points;
    [76.7, 152.2, 171.1, 171.1].forEach((y, i) => near(aug18[i].y, y));
  });

  test('the gain fills between the oldest and latest lines', () => {
    const corners = chart.gain!.map((p) => [Math.round(p.x), Math.round(p.y)]);
    expect(corners).toEqual([
      [40, 39],
      [137, 77],
      [233, 96],
      [330, 96],
      [330, 171],
      [233, 171],
      [137, 152],
      [40, 77],
    ]);
  });

  test('labels: the latest above its line, the oldest below', () => {
    expect(chart.latestLabel.text).toBe('Sep 1');
    near(chart.latestLabel.x, 330);
    near(chart.latestLabel.y, 86);
    expect(chart.oldestLabel!.text).toBe('Aug 18');
    near(chart.oldestLabel!.y, 187);
  });

  test('x labels by set number, the last right-aligned', () => {
    expect(chart.xLabels.map((l) => [l.text, l.anchor])).toEqual([
      ['Set 1', 'middle'],
      ['Set 2', 'middle'],
      ['Set 3', 'middle'],
      ['Set 4', 'end'],
    ]);
  });

  test('at most four earlier sessions', () => {
    const lots = [session(8, 14, [12, 6, 6, 5]), ...sessions];
    expect(fingerprint(lots).earlier).toHaveLength(4);
  });

  test('one session: no earlier lines and no gain', () => {
    const one = fingerprint(sessions.slice(0, 1));
    expect(one.earlier).toHaveLength(0);
    expect(one.gain).toBeNull();
    expect(one.oldestLabel).toBeNull();
  });
});

describe('heroes', () => {
  test('progress: reps gained and where they came from (15)', () => {
    expect(progressHero(sessions, '10 lb', NOW)).toEqual({
      value: '+14',
      text: 'more reps per workout at 10 lb, from 34 to 48.',
      muted: 'Most of it came from sets 2 to 4 catching up to set 1.',
    });
  });

  test('progress: a stronger first set, extra sets, fewer reps, and one session', () => {
    expect(progressHero([session(8, 18, [10, 8, 8]), session(8, 21, [14, 8, 9])], '10 lb', NOW)!.muted).toBe(
      'Most of it came from your first set.',
    );
    expect(progressHero([session(8, 18, [10, 8]), session(8, 21, [10, 8, 7])], '10 lb', NOW)!.muted).toBe(
      'Most of it came from an extra set.',
    );
    expect(progressHero([session(8, 18, [10, 9]), session(8, 21, [9, 8])], '10 lb', NOW)).toEqual({
      value: '−2',
      text: 'fewer reps per workout at 10 lb, from 19 to 17.',
      muted: 'Off days happen. The trend matters more.',
    });
    expect(progressHero(sessions.slice(0, 1), '10 lb', NOW)).toEqual({
      value: '34',
      text: 'reps at 10 lb on Aug 18.',
      muted: 'Do it again to see how it moves.',
    });
    expect(progressHero([session(8, 18, [10, 8]), session(10, 9, [9, 9])], '10 lb', NOW)).toEqual({
      value: '0',
      text: 'change in reps per workout at 10 lb, still 18.',
      muted: '',
    });
    expect(progressHero([], '10 lb', NOW)).toBeNull();
  });

  test('progress: two sets catching up reads "set 2"', () => {
    expect(progressHero([session(8, 18, [10, 6]), session(8, 21, [10, 9])], '10 lb', NOW)!.muted).toBe(
      'Most of it came from set 2 catching up to set 1.',
    );
  });

  test('fingerprint: latest retention against the first (16)', () => {
    expect(retentionHero(sessions, NOW)).toEqual({
      value: '79%',
      text: "of your first set's reps held through your last set on Sep 1.",
      muted: 'Up from 58% on Aug 18.',
    });
  });

  test('fingerprint: down, same, today and single sessions', () => {
    const down = [session(8, 18, [10, 9]), session(10, 9, [10, 7])];
    expect(retentionHero(down, NOW)).toEqual({
      value: '70%',
      text: "of your first set's reps held through your last set today.",
      muted: 'Down from 90% on Aug 18.',
    });
    expect(retentionHero([session(8, 18, [10, 8]), session(8, 21, [10, 8])], NOW)!.muted).toBe('Same as on Aug 18.');
    expect(retentionHero(sessions.slice(0, 1), NOW)!.muted).toBe('');
    expect(retentionHero([{ ...session(8, 18, [10]), retention: null }], NOW)).toBeNull();
  });
});

describe('moved up to', () => {
  const series = [
    { at: day(9, 1), sets: [{ weight_kg: kg(10), reps: 14 }] },
    { at: day(9, 4), sets: [{ weight_kg: kg(15), reps: 8 }, { weight_kg: kg(10), reps: 12 }] },
  ];

  test('the heaviest weight in the session where a heavier weight was first used', () => {
    expect(movedUpTo(series, kg(10), day(9, 4))).toBe(kg(15));
  });

  test('nothing without a date or a matching session', () => {
    expect(movedUpTo(series, kg(10), null)).toBeNull();
    expect(movedUpTo(series, kg(10), day(9, 8))).toBeNull();
  });
});
