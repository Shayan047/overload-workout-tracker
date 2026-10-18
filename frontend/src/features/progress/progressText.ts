// The words and numbers on Progress (13) and Exercise detail (14).

import { formatWeight, fromKg, type Unit } from '@/lib/units';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (iso: string, now: Date) => Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86_400_000);

/** "24.7", "95.0", "205": one decimal under 100, whole above. */
export function estMaxText(kg: number, unit: Unit): string {
  const value = fromKg(kg, unit);
  return value < 100 ? value.toFixed(1) : String(Math.round(value));
}

/** "+76%", "−3%". Empty without a change (one session in the window). */
export function changeText(change: number | null): string {
  if (change === null) return '';
  const percent = Math.round(change * 100);
  if (percent === 0) return '0%';
  return percent > 0 ? `+${percent}%` : `−${-percent}%`;
}

type Flags = { latest_at: string; is_new_best: boolean; plateau: { weeks_flat: number } | null };

/** "Sep 1"; with the year when it isn't this year; "today". */
export function whenText(iso: string, now: Date): string {
  const date = new Date(iso);
  if (daysAgo(iso, now) === 0) return 'today';
  const text = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? text : `${text}, ${date.getFullYear()}`;
}

export type Status = { kind: 'best' | 'plateau'; text: string } | { kind: 'plain' };

/** The line under a lift on 13: amber for a new best (you, today), ice for a plateau (the
 * past holding you level). */
export function statusOf(item: Flags, now: Date): Status {
  if (item.is_new_best) {
    const ago = daysAgo(item.latest_at, now);
    const when = ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `on ${whenText(item.latest_at, now)}`;
    return { kind: 'best', text: `New best ${when}` };
  }
  if (item.plateau) return { kind: 'plateau', text: `Flat for ${item.plateau.weeks_flat} weeks` };
  return { kind: 'plain' };
}

const isBestToday = (item: Flags, now: Date) => item.is_new_best && daysAgo(item.latest_at, now) === 0;

/** "2 new bests today, 1 lift flat for 3 weeks." */
export function progressSubtitle(items: readonly Flags[], now: Date): string {
  if (!items.length) return 'Finish a workout to see your progress here.';
  const bests = items.filter((i) => isBestToday(i, now)).length;
  const flat = items.filter((i) => i.plateau).map((i) => i.plateau!.weeks_flat);
  const parts: string[] = [];
  if (bests) parts.push(`${bests} new ${bests === 1 ? 'best' : 'bests'} today`);
  if (flat.length) {
    const weeks = Math.min(...flat);
    const same = flat.every((w) => w === weeks);
    parts.push(`${flat.length} ${flat.length === 1 ? 'lift' : 'lifts'} flat for ${weeks}${same ? '' : '+'} weeks`);
  }
  if (!parts.length) return 'No plateaus. Keep it going.';
  return `${parts.join(', ')}.`;
}

/** What needs a look first: today's new bests, then plateaus, then the rest in API order
 * (most recently trained first). */
export function orderProgress<T extends Flags>(items: readonly T[], now: Date): T[] {
  const rank = (i: T) => (isBestToday(i, now) ? 0 : i.plateau ? 1 : 2);
  return items.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index).map((x) => x.item);
}

/** "Up 10.7 lb since your first session, Aug 18". */
export function sinceFirstText(estMaxKg: number, first: { at: string; est_max_kg: number }, unit: Unit) {
  const diff = fromKg(estMaxKg, unit) - fromKg(first.est_max_kg, unit);
  const date = new Date(first.at);
  return {
    up: diff >= 0,
    text: `${diff >= 0 ? 'Up' : 'Down'} ${Math.abs(diff).toFixed(1)} ${unit} since your first session, ${MONTHS[date.getMonth()]} ${date.getDate()}`,
  };
}

/** "Today", "Tue, Oct 6". */
export function sessionTitle(iso: string, now: Date): string {
  if (daysAgo(iso, now) === 0) return 'Today';
  const date = new Date(iso);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "20 lb × 7, 6, 6, 5"; bodyweight exercises "BW+10 lb × 8". */
export function sessionSets(sets: readonly { weight_kg: number; reps: number }[], unit: Unit, bodyweight: boolean): string {
  const groups: { kg: number; reps: number[] }[] = [];
  for (const set of sets) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.kg - set.weight_kg) < 0.0005) last.reps.push(set.reps);
    else groups.push({ kg: set.weight_kg, reps: [set.reps] });
  }
  return groups
    .map(({ kg, reps }) => {
      const weight = `${formatWeight(fromKg(kg, unit))} ${unit}`;
      const load = !bodyweight ? weight : kg > 0 ? `BW+${weight}` : 'BW';
      return `${load} × ${reps.join(', ')}`;
    })
    .join(', ');
}
