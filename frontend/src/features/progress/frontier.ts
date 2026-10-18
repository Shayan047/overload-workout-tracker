// The rep-weight frontier (17): the most reps at every weight (rule 8), today's against an
// earlier date, plus the next targets that push the line. Geometry is in the design's SVG
// coordinates; pure, so it's tested against them.

import type { FrontierPoint } from '@/api/stats';
import { formatWeight, fromKg, type Unit } from '@/lib/units';

import { niceTicks } from './chart';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => `${MONTHS[new Date(iso).getMonth()]} ${new Date(iso).getDate()}`;
const round1 = (value: number) => Math.round(value * 10) / 10;

/** A 350 × 250 viewBox: reps run along x 40–336, weight up y 220–20. */
export const FRONTIER = { width: 350, height: 250, left: 40, right: 336, top: 20, bottom: 220 };
const REP_STEPS = [1, 2, 4, 5, 10, 20, 25, 50, 100];
/** The first step up at a new weight when only one weight has been used. */
const FIRST_STEP: Record<Unit, number> = { lb: 5, kg: 2.5 };
const MIN_TARGET_REPS = 3;

/** A frontier point in the user's unit. */
type Lift = { weight: number; reps: number };
type Placed = { x: number; y: number; label: string; labelX: number; labelY: number; anchor: 'start' | 'middle' | 'end' };

export type Target = Lift & { x: number; y: number; text: string; note: string };

export type FrontierChart = {
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string; anchor: 'middle' | 'end' }[];
  /** Heaviest point first. */
  today: { path: string; area: string; points: Placed[] };
  /** Only the points that today's frontier has moved past get a dot. */
  compare: { path: string; points: Placed[] } | null;
  targets: Target[];
};

const text = (lift: Lift) => `${formatWeight(lift.weight)} × ${lift.reps}`;

/** Heaviest first, in the user's unit. */
function lifts(points: readonly FrontierPoint[], unit: Unit): Lift[] {
  return points.map((p) => ({ weight: round1(fromKg(p.weight_kg, unit)), reps: p.reps })).sort((a, b) => b.weight - a.weight);
}

/** One rep past the best at the heaviest weight, and a first set one step heavier: the step
 * between the two heaviest weights, with the reps the best est. max predicts (Epley), at
 * least three. */
export function nextTargets(frontier: readonly Lift[], unit: Unit): (Lift & { note: string })[] {
  if (!frontier.length) return [];
  const [heaviest, next] = [...frontier].sort((a, b) => b.weight - a.weight);
  const step = next ? heaviest.weight - next.weight : FIRST_STEP[unit];
  const weight = round1(heaviest.weight + step);
  const estMax = Math.max(...frontier.map((p) => p.weight * (1 + p.reps / 30)));
  const reps = Math.max(MIN_TARGET_REPS, Math.floor(30 * (estMax / weight - 1)));
  return [
    { weight: heaviest.weight, reps: heaviest.reps + 1, note: `One rep past your best at ${formatWeight(heaviest.weight)} ${unit}` },
    { weight, reps, note: 'Your first set at a new weight' },
  ];
}

export function frontierChart({
  today,
  compare,
  unit,
}: {
  today: readonly FrontierPoint[];
  compare: readonly FrontierPoint[] | null;
  unit: Unit;
}): FrontierChart {
  const now = lifts(today, unit);
  const then = compare ? lifts(compare, unit) : [];
  const targets = nextTargets(now, unit);
  const all = [...now, ...then, ...targets];

  const weightTicks = niceTicks(0, Math.max(1, ...all.map((p) => p.weight)), 5);
  const repTicks = niceTicks(0, Math.max(1, ...all.map((p) => p.reps)), 4, REP_STEPS);
  const [maxWeight, maxReps] = [weightTicks[0], repTicks[0]];
  const x = (reps: number) => round1(FRONTIER.left + (reps / maxReps) * (FRONTIER.right - FRONTIER.left));
  const y = (weight: number) => round1(FRONTIER.bottom - (weight / maxWeight) * (FRONTIER.bottom - FRONTIER.top));

  const corners = (line: Lift[]) => [
    { x: FRONTIER.left, y: y(line[0].weight) },
    ...line.map((p) => ({ x: x(p.reps), y: y(p.weight) })),
    { x: x(line[line.length - 1].reps), y: FRONTIER.bottom },
  ];
  const path = (line: Lift[]) =>
    corners(line)
      .map((c, i) => `${i ? 'L' : 'M'}${c.x} ${c.y}`)
      .join('');

  // Labels sit above each point; the lightest one (at the far right) goes below, to the right.
  const todayPoints = now.map((p, i): Placed => {
    const [px, py] = [x(p.reps), y(p.weight)];
    if (now.length > 1 && i === now.length - 1) return { x: px, y: py, label: text(p), labelX: px + 9, labelY: py + 20, anchor: 'start' };
    if (now.length > 1 && i === 0) return { x: px, y: py, label: text(p), labelX: px - 9.5, labelY: py - 13, anchor: 'middle' };
    return { x: px, y: py, label: text(p), labelX: px, labelY: py - 14, anchor: 'middle' };
  });

  const onToday = (p: Lift) => now.some((q) => q.weight === p.weight && q.reps === p.reps);
  const compareOut = then.length
    ? {
        path: path(then),
        points: then
          .filter((p) => !onToday(p))
          .map((p): Placed => {
            const [px, py] = [x(p.reps), y(p.weight)];
            return { x: px, y: py, label: text(p), labelX: px - 7, labelY: py + 20, anchor: 'end' };
          }),
      }
    : null;

  return {
    yTicks: weightTicks.filter((w) => w > 0).map((w) => ({ y: y(w), label: formatWeight(w) })),
    xTicks: [...repTicks].reverse().map((r, i, list) => ({
      x: x(r),
      label: i === list.length - 1 ? `${r} reps` : String(r),
      anchor: i === list.length - 1 ? 'end' : 'middle',
    })),
    today: {
      path: now.length ? path(now) : '',
      area: now.length
        ? [...corners(now), { x: FRONTIER.left, y: FRONTIER.bottom }].map((c) => `${c.x},${c.y}`).join(' ')
        : '',
      points: todayPoints,
    },
    compare: compareOut,
    targets: targets.map((t) => ({ ...t, x: x(t.reps), y: y(t.weight), text: text(t) })),
  };
}

/** The dates to compare with: the session nearest the middle of the history (the later on a
 * tie), then the first. Never the latest, which is today's frontier. */
export function compareOptions(series: readonly { at: string }[]): { at: string; label: string }[] {
  if (series.length < 2) return [];
  const time = (iso: string) => new Date(iso).getTime();
  const [first, last] = [series[0], series[series.length - 1]];
  const middle = (time(first.at) + time(last.at)) / 2;
  const inner = series.slice(1, -1);
  const nearest = inner.reduce<{ at: string } | null>(
    (best, p) => (!best || Math.abs(time(p.at) - middle) <= Math.abs(time(best.at) - middle) ? p : best),
    null,
  );
  return [...(nearest ? [nearest] : []), first].map((p) => ({ at: p.at, label: shortDate(p.at) }));
}
