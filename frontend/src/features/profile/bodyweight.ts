// Bodyweight (20): the range chips, the chart and the words around it. Pure, so the chart is
// tested against the design's SVG coordinates. Dates are `measured_on` (YYYY-MM-DD, local).

import type { BodyweightEntry } from '@/api/pendingWrites';
import { formatWeight, fromKg, type Unit } from '@/lib/units';

import { niceTicks } from '../progress/chart';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const RANGES = [
  { key: '1m', label: '1 month', months: 1 },
  { key: '3m', label: '3 months', months: 3 },
  { key: '1y', label: '1 year', months: 12 },
  { key: 'all', label: 'All', months: null },
] as const;
export type RangeKey = (typeof RANGES)[number]['key'];

/** A 350 × 152 viewBox: entries from x 30 to 340, gridlines from y 20 to 130. */
export const BW_CHART = { width: 350, height: 152, left: 30, right: 340, gridRight: 342, top: 20, bottom: 130 };
/** Room above and below the line, so a steady weight doesn't look like a cliff. */
const PAD: Record<Unit, number> = { lb: 1, kg: 0.5 };

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (iso: string) => `${MONTHS[day(iso).getMonth()]} ${day(iso).getDate()}`;
const isToday = (iso: string, now: Date) => day(iso).toDateString() === now.toDateString();
const value = (entry: BodyweightEntry, unit: Unit) => Math.round(fromKg(entry.weight_kg, unit) * 10) / 10;

/** One entry per day (the last one logged), oldest first. */
export function byDay(entries: readonly BodyweightEntry[]): BodyweightEntry[] {
  const last = new Map<string, BodyweightEntry>();
  for (const entry of entries) last.set(entry.measured_on, entry);
  return [...last.values()].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
}

/** Entries in the range, oldest first. */
export function inRange(entries: readonly BodyweightEntry[], key: RangeKey, now: Date): BodyweightEntry[] {
  const months = RANGES.find((r) => r.key === key)?.months ?? null;
  const all = byDay(entries);
  if (months === null) return all;
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return all.filter((e) => day(e.measured_on) >= from);
}

export type BodyweightChart = {
  ticks: { y: number; label: string }[];
  points: { x: number; y: number }[];
  xLabels: { x: number; text: string; anchor: 'start' | 'middle' | 'end'; current: boolean }[];
};

/** The line: entries evenly spaced, the latest at the right. */
export function bodyweightChart(entries: readonly BodyweightEntry[], unit: Unit, now: Date): BodyweightChart {
  const values = entries.map((e) => value(e, unit));
  const ticks = niceTicks(Math.min(...values) - PAD[unit], Math.max(...values) + PAD[unit]);
  const [hi, lo] = [ticks[0], ticks[ticks.length - 1]];
  const y = (v: number) => BW_CHART.bottom - ((v - lo) / (hi - lo)) * (BW_CHART.bottom - BW_CHART.top);
  const step = entries.length > 1 ? (BW_CHART.right - BW_CHART.left) / (entries.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: entries.length > 1 ? BW_CHART.left + i * step : BW_CHART.right,
    y: y(v),
  }));

  const last = entries[entries.length - 1];
  const xLabels: BodyweightChart['xLabels'] = [];
  if (entries.length > 1) xLabels.push({ x: BW_CHART.left, text: shortDate(entries[0].measured_on), anchor: 'start', current: false });
  if (entries.length > 2) {
    const middle = Math.floor((entries.length - 1) / 2);
    xLabels.push({ x: points[middle].x, text: shortDate(entries[middle].measured_on), anchor: 'middle', current: false });
  }
  if (last) {
    const current = isToday(last.measured_on, now);
    xLabels.push({ x: BW_CHART.gridRight, text: current ? 'Today' : shortDate(last.measured_on), anchor: 'end', current });
  }
  return { ticks: ticks.map((t) => ({ y: y(t), label: formatWeight(t) })), points, xLabels };
}

/** "Up 3.6 lb since Aug 10". */
export function changeText(first: BodyweightEntry, latest: BodyweightEntry, unit: Unit): string {
  if (first.id === latest.id) return `Logged ${shortDate(first.measured_on)}`;
  const diff = Math.round((value(latest, unit) - value(first, unit)) * 10) / 10;
  const since = shortDate(first.measured_on);
  if (diff === 0) return `Same as on ${since}`;
  return `${diff > 0 ? 'Up' : 'Down'} ${Math.abs(diff).toFixed(1)} ${unit} since ${since}`;
}

/** "Today", "Mon, Oct 5"; with the year when it isn't this year. */
export function entryDate(iso: string, now: Date): string {
  if (isToday(iso, now)) return 'Today';
  const date = day(iso);
  const text = `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? text : `${text}, ${date.getFullYear()}`;
}
