// The one-weight views: Progress (15, stacked reps per set) and Fingerprint (16, reps by set
// number). Geometry is in the designs' SVG coordinates; pure, so it's tested against them.

import type { WeightSession } from '@/api/stats';

import { niceTicks } from './chart';

export type { WeightSession };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => `${MONTHS[new Date(iso).getMonth()]} ${new Date(iso).getDate()}`;
const sameDay = (iso: string, now: Date) => new Date(iso).toDateString() === now.toDateString();
const onDate = (iso: string, now: Date) => (sameDay(iso, now) ? 'today' : `on ${shortDate(iso)}`);
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** "79%". */
export const percentText = (retention: number) => `${Math.round(retention * 100)}%`;

type Tick = { y: number; label: string };

// 15: a 350 × 232 viewBox. Bars stand on y 200; the top gridline is y 20. Slots share x 34–342.
export const BARS = { width: 350, height: 232, left: 30, gridRight: 342, slotsLeft: 34, top: 20, bottom: 200 };
const BAR_WIDTH = 44;
const BAR_GAP = 2;
const SLOTS = 5;
const MAX_BARS = 6;
const MIN_LABEL_HEIGHT = 13;
const TOTAL_RAISE = 8;
/** Sets past the fourth share the darkest shade (tokens chart.setShades). */
export const SHADES = 4;

export type Bars = {
  ticks: Tick[];
  barWidth: number;
  bars: {
    x: number;
    label: string;
    current: boolean;
    total: number;
    totalY: number;
    segments: { y: number; height: number; reps: number; shade: number; labelY: number; showLabel: boolean }[];
  }[];
  legend: string[];
};

/** Stacked reps per set for the latest six sessions, set 1 at the bottom. */
export function stackedBars(sessions: readonly WeightSession[], now: Date): Bars {
  const shown = sessions.slice(-MAX_BARS);
  const ticks = niceTicks(0, Math.max(1, ...shown.map((s) => s.total)), 5);
  const top = ticks[0];
  const scale = (BARS.bottom - BARS.top) / top;
  const y = (value: number) => BARS.bottom - value * scale;

  const slot = (BARS.gridRight - BARS.slotsLeft) / Math.max(shown.length, SLOTS);
  const offset = (BARS.gridRight - BARS.slotsLeft - slot * shown.length) / 2;
  const barWidth = Math.min(BAR_WIDTH, Math.round((slot - 12) * 10) / 10);

  const bars = shown.map((s, i) => {
    let below = 0;
    const segments = s.reps.map((reps, set) => {
      const height = Math.max(0, reps * scale - BAR_GAP);
      const segY = y(below + reps);
      below += reps;
      return {
        y: segY,
        height,
        reps,
        shade: Math.min(set, SHADES - 1),
        labelY: segY + height / 2 + 4,
        showLabel: height >= MIN_LABEL_HEIGHT,
      };
    });
    return {
      x: BARS.slotsLeft + offset + slot * (i + 0.5),
      label: sameDay(s.at, now) ? 'Today' : shortDate(s.at),
      current: i === shown.length - 1,
      total: s.total,
      totalY: y(s.total) - TOTAL_RAISE,
      segments,
    };
  });

  const sets = Math.max(0, ...shown.map((s) => s.reps.length));
  const legend = Array.from({ length: Math.min(sets, SHADES) }, (_, i) =>
    i === SHADES - 1 && sets > SHADES ? `Sets ${SHADES}+` : `Set ${i + 1}`,
  );
  return { ticks: ticks.map((v) => ({ y: y(v), label: String(v) })), barWidth, bars, legend };
}

// 16: a 350 × 220 viewBox. Set 1 at x 40, the last set at 330; gridlines from y 38.9 to 190.
export const PRINT = { width: 350, height: 220, left: 40, right: 330, gridRight: 336, top: 38.9, bottom: 190 };
/** Earlier sessions fade with age: the oldest of four is faintest. */
const EARLIER_OPACITY = [0.35, 0.5, 0.65, 0.85];
const LABEL_ABOVE = 9.6;
const LABEL_BELOW = 16;

type Point = { x: number; y: number };
type Label = { x: number; y: number; text: string };

export type Fingerprint = {
  ticks: Tick[];
  latest: { points: Point[] };
  /** Oldest first. */
  earlier: { points: Point[]; opacity: number }[];
  /** The area between the oldest line and the latest: your gain. */
  gain: Point[] | null;
  latestLabel: Label;
  oldestLabel: Label | null;
  xLabels: { x: number; text: string; anchor: 'middle' | 'end' }[];
};

/** Reps by set number: the latest session and up to four before it. */
export function fingerprint(sessions: readonly WeightSession[]): Fingerprint {
  const shown = sessions.slice(-(EARLIER_OPACITY.length + 1));
  const reps = shown.flatMap((s) => s.reps);
  const ticks = niceTicks(Math.min(...reps), Math.max(...reps));
  const [hi, lo] = [ticks[0], ticks[ticks.length - 1]];
  const y = (value: number) => PRINT.bottom - ((value - lo) / (hi - lo)) * (PRINT.bottom - PRINT.top);

  const sets = Math.max(...shown.map((s) => s.reps.length));
  const x = (set: number) =>
    sets === 1 ? (PRINT.left + PRINT.right) / 2 : PRINT.left + (set * (PRINT.right - PRINT.left)) / (sets - 1);
  const line = (s: WeightSession) => s.reps.map((r, set) => ({ x: x(set), y: y(r) }));

  const latest = { points: line(shown[shown.length - 1]) };
  const earlierSessions = shown.slice(0, -1);
  const earlier = earlierSessions.map((s, i) => ({
    points: line(s),
    opacity: EARLIER_OPACITY[EARLIER_OPACITY.length - earlierSessions.length + i],
  }));

  const end = (points: Point[]) => points[points.length - 1];
  const latestEnd = end(latest.points);
  const oldest = earlier[0];
  // The higher line's label goes above it, the lower one's below, clear of the x axis.
  const latestHigher = !oldest || latestEnd.y <= end(oldest.points).y;
  const place = (p: Point, above: boolean) =>
    above ? p.y - LABEL_ABOVE : Math.min(p.y + LABEL_BELOW, PRINT.bottom - 3);

  return {
    ticks: ticks.map((v) => ({ y: y(v), label: String(v) })),
    latest,
    earlier,
    gain: oldest ? [...latest.points, ...[...oldest.points].reverse()] : null,
    latestLabel: { x: latestEnd.x, y: place(latestEnd, latestHigher), text: shortDate(shown[shown.length - 1].at) },
    oldestLabel: oldest
      ? { x: end(oldest.points).x, y: place(end(oldest.points), !latestHigher), text: shortDate(shown[0].at) }
      : null,
    xLabels: Array.from({ length: sets }, (_, set) => ({
      x: x(set),
      text: `Set ${set + 1}`,
      anchor: sets > 1 && set === sets - 1 ? 'end' : 'middle',
    })),
  };
}

export type Hero = { value: string; text: string; muted: string };

/** Where the extra reps came from, latest against first. */
function gainSource(first: readonly number[], latest: readonly number[]): string {
  const both = Math.min(first.length, latest.length);
  const firstSet = latest[0] - first[0];
  let later = 0;
  for (let i = 1; i < both; i += 1) later += latest[i] - first[i];
  const extraSets = Math.max(0, latest.length - first.length);
  const extra = sum(latest.slice(first.length));
  if (extraSets && extra > Math.max(firstSet, later)) {
    return `Most of it came from ${extraSets === 1 ? 'an extra set' : `${extraSets} extra sets`}.`;
  }
  if (later > firstSet) {
    const sets = both === 2 ? 'set 2' : `sets 2 to ${both}`;
    return `Most of it came from ${sets} catching up to set 1.`;
  }
  return 'Most of it came from your first set.';
}

/** 15's headline: reps gained per workout at this weight, first session to latest. */
export function progressHero(sessions: readonly WeightSession[], weight: string, now: Date): Hero | null {
  if (!sessions.length) return null;
  const first = sessions[0];
  const latest = sessions[sessions.length - 1];
  if (sessions.length === 1) {
    return {
      value: String(latest.total),
      text: `reps at ${weight} ${onDate(latest.at, now)}.`,
      muted: 'Do it again to see how it moves.',
    };
  }
  const change = latest.total - first.total;
  if (change === 0) {
    return { value: '0', text: `change in reps per workout at ${weight}, still ${latest.total}.`, muted: '' };
  }
  const from = `from ${first.total} to ${latest.total}.`;
  if (change < 0) {
    return {
      value: `−${-change}`,
      text: `fewer reps per workout at ${weight}, ${from}`,
      muted: 'Off days happen. The trend matters more.',
    };
  }
  return {
    value: `+${change}`,
    text: `more reps per workout at ${weight}, ${from}`,
    muted: gainSource(first.reps, latest.reps),
  };
}

/** 16's headline: the latest retention, against the first session that has one. */
export function retentionHero(sessions: readonly WeightSession[], now: Date): Hero | null {
  const latest = sessions[sessions.length - 1];
  if (!latest || latest.retention === null) return null;
  const text = `of your first set's reps held through your last set ${onDate(latest.at, now)}.`;
  const first = sessions.find((s) => s.retention !== null);
  if (!first || first === latest) return { value: percentText(latest.retention), text, muted: '' };

  const [was, is] = [Math.round(first.retention! * 100), Math.round(latest.retention * 100)];
  const when = shortDate(first.at);
  const muted =
    is > was ? `Up from ${was}% on ${when}.` : is < was ? `Down from ${was}% on ${when}.` : `Same as on ${when}.`;
  return { value: percentText(latest.retention), text, muted };
}

/** The weight moved up to on `movedUpOn`: the heaviest above `weightKg` in that session. */
export function movedUpTo(
  series: readonly { at: string; sets: readonly { weight_kg: number }[] }[],
  weightKg: number,
  movedUpOn: string | null,
): number | null {
  if (!movedUpOn) return null;
  const at = new Date(movedUpOn).getTime();
  const session = series.find((s) => new Date(s.at).getTime() === at);
  const heavier = session?.sets.map((s) => s.weight_kg).filter((w) => w > weightKg + 0.0005) ?? [];
  return heavier.length ? Math.max(...heavier) : null;
}
