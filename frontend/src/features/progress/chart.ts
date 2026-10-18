// Geometry for the est. max chart (14) and the sparklines (13), in the designs' SVG
// coordinates. Pure, so positions are tested against the designs.

import { formatWeight, fromKg, type Unit } from '@/lib/units';

/** 14's chart: a 350 × 196 viewBox; the plot runs x 30–340 and y 20–160. */
export const CHART = { width: 350, height: 196, left: 30, right: 340, gridRight: 342, top: 20, bottom: 160 };
const LAST_BAND_PAD = 5.5;
const NICE_STEPS = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500];
const MAX_INTERVALS = 4;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Point = { at: string; est_max_kg: number };

export type ChartInput = {
  series: (Point & { best_set: { weight_kg: number } })[];
  projection: Point | null;
  unit: Unit;
  now: Date;
};

export type Chart = {
  points: { x: number; y: number }[];
  ticks: { y: number; label: string }[];
  /** Weight used: alternating shades 0 / 1 (tokens chart.weightBands). */
  bands: { x0: number; x1: number; label: string; shade: 0 | 1 }[];
  projection: { x: number; y: number; label: string } | null;
  xLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end'; current: boolean }[];
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shortDate = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}`;
const time = (iso: string) => new Date(iso).getTime();

/** Gridline values, highest first: the smallest "nice" step that covers lo–hi in at most
 * `maxIntervals` intervals (four on 14 and 16, five on 15). */
export function niceTicks(lo: number, hi: number, maxIntervals = MAX_INTERVALS): number[] {
  for (const step of NICE_STEPS) {
    const start = Math.floor(lo / step) * step;
    const end = Math.max(Math.ceil(hi / step) * step, start + step);
    if ((end - start) / step <= maxIntervals) {
      return Array.from({ length: Math.round((end - start) / step) + 1 }, (_, i) => end - i * step);
    }
  }
  return [hi, lo];
}

export function estMaxChart({ series, projection, unit, now }: ChartInput): Chart {
  const values = series.map((p) => fromKg(p.est_max_kg, unit));
  const projected = projection ? fromKg(projection.est_max_kg, unit) : null;
  const ticks = niceTicks(Math.min(...values), Math.max(...values, projected ?? -Infinity));
  const yHigh = ticks[0];
  const yLow = ticks[ticks.length - 1];
  const y = (value: number) => CHART.bottom - ((value - yLow) / (yHigh - yLow)) * (CHART.bottom - CHART.top);

  const t0 = time(series[0].at);
  const t1 = projection ? time(projection.at) : time(series[series.length - 1].at);
  const x = (iso: string) =>
    t1 === t0 ? (CHART.left + CHART.right) / 2 : CHART.left + ((time(iso) - t0) / (t1 - t0)) * (CHART.right - CHART.left);

  const points = series.map((p, i) => ({ x: x(p.at), y: y(values[i]) }));

  // Runs of sessions at the same weight; the edge between two runs is halfway between them.
  const runs: { weightKg: number; first: number; last: number }[] = [];
  series.forEach((p, i) => {
    const run = runs[runs.length - 1];
    if (run && Math.abs(run.weightKg - p.best_set.weight_kg) < 0.0005) run.last = i;
    else runs.push({ weightKg: p.best_set.weight_kg, first: i, last: i });
  });
  const bands =
    series.length > 1
      ? runs.map((run, i) => ({
          x0: i === 0 ? points[run.first].x : (points[runs[i - 1].last].x + points[run.first].x) / 2,
          x1:
            i === runs.length - 1
              ? points[run.last].x + LAST_BAND_PAD
              : (points[run.last].x + points[runs[i + 1].first].x) / 2,
          label: `${formatWeight(fromKg(run.weightKg, unit))} ${unit}`,
          shade: (i % 2) as 0 | 1,
        }))
      : [];

  const last = series[series.length - 1];
  const xLabels: Chart['xLabels'] = [{ x: points[0].x, text: shortDate(new Date(series[0].at)), anchor: 'start', current: false }];
  if (series.length > 2) {
    // The session nearest the middle of the sessions (the later one on a tie), if it has room.
    const middle = (t0 + time(last.at)) / 2;
    const nearest = series.reduce((best, p) => (Math.abs(time(p.at) - middle) <= Math.abs(time(best.at) - middle) ? p : best));
    const mx = x(nearest.at);
    if (mx - points[0].x > 40 && points[points.length - 1].x - mx > 40) {
      xLabels.push({ x: mx, text: shortDate(new Date(nearest.at)), anchor: 'middle', current: false });
    }
  }
  if (series.length > 1) {
    const current = sameDay(new Date(last.at), now);
    xLabels.push({
      x: points[points.length - 1].x,
      text: current ? 'Today' : shortDate(new Date(last.at)),
      anchor: 'middle',
      current,
    });
  }

  let projectionOut: Chart['projection'] = null;
  if (projection && projected !== null) {
    const py = y(projected);
    projectionOut = { x: x(projection.at), y: py, label: `~${Math.round(projected)} ${unit}` };
    xLabels.push({ x: CHART.right, text: shortDate(new Date(projection.at)), anchor: 'end', current: false });
  }

  return {
    points,
    ticks: ticks.map((value) => ({ y: y(value), label: formatWeight(value) })),
    bands,
    projection: projectionOut,
    xLabels,
  };
}

/** 13's sparkline: an 84 × 32 box; the line runs x 2–82, lowest est. max at y 28, highest at 6. */
export function sparkline(points: readonly Point[]): { path: string; end: { x: number; y: number } } {
  if (points.length < 2) return { path: '', end: { x: 82, y: 17 } };
  const values = points.map((p) => p.est_max_kg);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const t0 = time(points[0].at);
  const t1 = time(points[points.length - 1].at);
  const coords = points.map((p) => ({
    x: Math.round((2 + ((time(p.at) - t0) / (t1 - t0 || 1)) * 80) * 10) / 10,
    y: hi === lo ? 17 : Math.round((28 - ((p.est_max_kg - lo) / (hi - lo)) * 22) * 10) / 10,
  }));
  return {
    path: coords.map((c, i) => `${i ? 'L' : 'M'}${c.x} ${c.y}`).join(''),
    end: coords[coords.length - 1],
  };
}
