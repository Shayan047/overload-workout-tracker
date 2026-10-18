import { bodyweightChart, byDay, changeText, entryDate, inRange } from '../bodyweight';

const LB = 0.45359237;
const kg = (lb: number) => Math.round(lb * LB * 1000) / 1000;
const NOW = new Date(2026, 9, 9, 18, 5);
const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 0);

// 20: weekly from Monday Aug 10, then today.
const days = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-09'];
const lbs = [168.4, 168.9, 169.6, 169.8, 170.5, 170.4, 171.1, 171.6, 171.8, 172.0];
const entries = days.map((measured_on, i) => ({ id: `b-${i}`, weight_kg: kg(lbs[i]), measured_on }));

describe('bodyweight chart (20): positions match the design', () => {
  const chart = bodyweightChart(entries, 'lb', NOW);

  test('gridlines every 2 lb from 166 to 174, with room around the line', () => {
    expect(chart.ticks.map((t) => [t.label, t.y])).toEqual([
      ['174', 20],
      ['172', 47.5],
      ['170', 75],
      ['168', 102.5],
      ['166', 130],
    ]);
  });

  test('entries evenly spaced from x 30 to 340', () => {
    const expected = [[30, 97], [64.4, 90.1], [98.9, 80.5], [133.3, 77.75], [167.8, 68.1], [202.2, 69.5], [236.7, 59.9], [271.1, 53], [305.6, 50.25], [340, 47.5]];
    chart.points.forEach((p, i) => {
      near(p.x, expected[i][0]);
      near(p.y, expected[i][1]);
    });
  });

  test('x labels: the first entry, the middle one, and Today', () => {
    expect(chart.xLabels.map((l) => [l.text, l.anchor, l.current])).toEqual([
      ['Aug 10', 'start', false],
      ['Sep 7', 'middle', false],
      ['Today', 'end', true],
    ]);
    [30, 167.8, 342].forEach((x, i) => near(chart.xLabels[i].x, x));
  });

  test('one entry: a single dot at the right', () => {
    const one = bodyweightChart(entries.slice(-1), 'lb', NOW);
    expect(one.points).toHaveLength(1);
    expect(one.points[0].x).toBe(340);
  });
});

describe('ranges and text', () => {
  test('3 months reaches back to Jul 9; 1 month to Sep 9', () => {
    expect(inRange(entries, '3m', NOW)).toHaveLength(10);
    expect(inRange(entries, '1m', NOW).map((e) => e.measured_on)).toEqual(days.slice(5));
    expect(inRange(entries, 'all', NOW)).toHaveLength(10);
  });

  test('change since the first entry in the range', () => {
    expect(changeText(entries[0], entries[9], 'lb')).toBe('Up 3.6 lb since Aug 10');
    expect(changeText(entries[9], entries[0], 'lb')).toBe('Down 3.6 lb since Oct 9');
    expect(changeText(entries[0], entries[0], 'lb')).toBe('Logged Aug 10');
    expect(changeText(entries[0], { ...entries[0], id: 'x', measured_on: '2026-08-11' }, 'lb')).toBe('Same as on Aug 10');
  });

  test('dates: Today, or the weekday and date', () => {
    expect(entryDate('2026-10-09', NOW)).toBe('Today');
    expect(entryDate('2026-10-05', NOW)).toBe('Mon, Oct 5');
    expect(entryDate('2025-10-05', NOW)).toBe('Sun, Oct 5, 2025');
  });

  test('one entry per day: the last one logged wins, oldest first', () => {
    const twice = [entries[1], entries[0], { ...entries[0], id: 'again', weight_kg: 70 }];
    expect(byDay(twice).map((e) => e.id)).toEqual(['again', 'b-1']);
  });
});
