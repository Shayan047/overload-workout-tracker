// Ghost mode and the numbers around it (08, 09): today against the most recent finished
// session of the same exercise (rule 9). Computed on the phone from the cached previous
// session, so it works offline.
//
// What's compared depends on the weight (24, 25): the heaviest weight in today's sets
// against the heaviest in the same sets last time. The same weight compares reps; a heavier
// one counts as ahead; a lighter one compares est. max (rule 4, with each workout's
// bodyweight for bodyweight exercises, rule 2).

import { formatWeight, fromKg, type Unit } from '@/lib/units';

type SetLike = { set_number: number; weight_kg: number; reps: number };
type LoadSet = { weight_kg: number; reps: number };

export type Comparison =
  | { kind: 'reps'; you: number; last: number; delta: number }
  | { kind: 'heavier'; todayKg: number; lastKg: number; upKg: number }
  /** Est. max (kg) of the best set today and last time. */
  | { kind: 'lighter'; youKg: number; lastKg: number; deltaKg: number };

export type Ghost = {
  /** Sets logged today. */
  sets: number;
  /** Last time's reps in total. */
  lastTotal: number;
  /** Today's sets against the same sets last time (all of them, if you've done more). */
  comparison: Comparison;
};

/** Bodyweight added to each set's weight for est. max: each workout's own snapshot, or 0. */
export type Offsets = { today: number; last: number };

const SAME = 0.0005;
const byNumber = (sets: readonly SetLike[]) => [...sets].sort((a, b) => a.set_number - b.set_number);
const sum = (sets: readonly LoadSet[]) => sets.reduce((total, s) => total + s.reps, 0);
const counted = (sets: readonly LoadSet[]) => sets.filter((s) => s.reps >= 1);
const top = (sets: readonly LoadSet[]) => Math.max(...counted(sets).map((s) => s.weight_kg));
const bestEstMax = (sets: readonly LoadSet[], offset: number) =>
  Math.max(...counted(sets).map((s) => (s.weight_kg + offset) * (1 + s.reps / 30)));

/** `today` against `last` by option B; null when either has no set with a rep. */
export function compare(today: readonly LoadSet[], last: readonly LoadSet[], offsets: Offsets = { today: 0, last: 0 }): Comparison | null {
  if (!counted(today).length || !counted(last).length) return null;
  const [mine, theirs] = [top(today), top(last)];
  if (mine > theirs + SAME) return { kind: 'heavier', todayKg: mine, lastKg: theirs, upKg: mine - theirs };
  if (mine < theirs - SAME) {
    const [youKg, lastKg] = [bestEstMax(today, offsets.today), bestEstMax(last, offsets.last)];
    return { kind: 'lighter', youKg, lastKg, deltaKg: youKg - lastKg };
  }
  const [you, lastReps] = [sum(today), sum(last)];
  return { kind: 'reps', you, last: lastReps, delta: you - lastReps };
}

/** The ghost panel (08): the sets logged so far against the same sets last time. */
export function ghost(today: readonly SetLike[], last: readonly SetLike[], offsets?: Offsets): Ghost {
  const mine = byNumber(today);
  const through = byNumber(last).slice(0, mine.length);
  const comparison = compare(mine, through, offsets) ?? {
    kind: 'reps',
    you: sum(mine),
    last: sum(through),
    delta: sum(mine) - sum(through),
  };
  return { sets: mine.length, lastTotal: sum(last), comparison };
}

export function isAhead(c: Comparison): boolean {
  if (c.kind === 'heavier') return true;
  if (c.kind === 'lighter') return c.deltaKg > SAME;
  return c.delta > 0;
}

const oneDecimal = (kg: number, unit: Unit) => Math.round(fromKg(Math.abs(kg), unit) * 10) / 10;

/** The verdict: "Ahead by 2 reps" / "Up 2.5 lb" / "Est. max 0.7 lb behind" on the ghost panel,
 * "Ahead by 1" / "Up 2.5 lb" / "Est. max −0.7" on the log-a-set pill (09). */
export function comparisonText(c: Comparison, unit: Unit, style: 'panel' | 'short'): string {
  if (c.kind === 'reps') return aheadText(c.delta, style === 'panel' ? 'reps' : 'short');
  if (c.kind === 'heavier') return `Up ${formatWeight(fromKg(c.upKg, unit))} ${unit}`;
  const amount = oneDecimal(c.deltaKg, unit);
  if (amount === 0) return 'Est. max level';
  if (style === 'short') return `Est. max ${c.deltaKg > 0 ? '+' : '−'}${amount.toFixed(1)}`;
  return `Est. max ${amount.toFixed(1)} ${unit} ${c.deltaKg > 0 ? 'ahead' : 'behind'}`;
}

/** A finished exercise's change: "+1 rep" on 08's done cards, "+1" in 11's Change column;
 * "+2.5 lb" when heavier; "−0.7 est." / "−0.7" when lighter. */
export function changeText(c: Comparison, unit: Unit, style: 'done' | 'summary'): string {
  if (c.kind === 'reps') {
    if (style === 'done') return exerciseDelta(c.you, c.last);
    return c.delta === 0 ? 'Even' : `${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)}`;
  }
  if (c.kind === 'heavier') return `+${formatWeight(fromKg(c.upKg, unit))} ${unit}`;
  const amount = oneDecimal(c.deltaKg, unit);
  if (amount === 0) return 'Even';
  return `${c.deltaKg > 0 ? '+' : '−'}${amount.toFixed(1)}${style === 'done' ? ' est.' : ''}`;
}

/** "Ahead by 2 reps" (ghost panel) or "Ahead by 1" (the log-a-set pill). */
export function aheadText(delta: number, style: 'reps' | 'short'): string {
  if (delta === 0) return style === 'reps' ? 'Level with last time' : 'Level';
  const amount = Math.abs(delta);
  const unit = style === 'reps' ? ` ${amount === 1 ? 'rep' : 'reps'}` : '';
  return `${delta > 0 ? 'Ahead' : 'Behind'} by ${amount}${unit}`;
}

/** A finished exercise's total reps against last time: "+1 rep", "−1 rep", "Even". */
export function exerciseDelta(today: number, last: number): string {
  const delta = today - last;
  if (delta === 0) return 'Even';
  const amount = Math.abs(delta);
  return `${delta > 0 ? '+' : '−'}${amount} ${amount === 1 ? 'rep' : 'reps'}`;
}

const weightText = (kg: number, unit: Unit) => formatWeight(fromKg(kg, unit));

/** One set: "20 × 6"; bodyweight exercises "BW+10 × 8" or "BW × 12". */
export function setText(set: SetLike, unit: Unit, bodyweight: boolean): string {
  if (!bodyweight) return `${weightText(set.weight_kg, unit)} × ${set.reps}`;
  return set.weight_kg > 0 ? `BW+${weightText(set.weight_kg, unit)} × ${set.reps}` : `BW × ${set.reps}`;
}

/** Sets grouped by weight, in order: a new weight starts a new group. `load` is the weight as
 * shown ("25", "bodyweight + 10", "bodyweight"). */
export function setGroups(sets: readonly SetLike[], unit: Unit, bodyweight: boolean): { load: string; reps: number[] }[] {
  const groups: { weight: number; reps: number[] }[] = [];
  for (const set of byNumber(sets)) {
    const last = groups[groups.length - 1];
    if (last && last.weight === set.weight_kg) last.reps.push(set.reps);
    else groups.push({ weight: set.weight_kg, reps: [set.reps] });
  }
  return groups.map(({ weight, reps }) => ({
    load: bodyweight ? (weight > 0 ? `bodyweight + ${weightText(weight, unit)}` : 'bodyweight') : weightText(weight, unit),
    reps,
  }));
}

/** Up next (08): "25 × 9, 8, 7"; a new weight starts a new group: "25 × 9, 22.5 × 8". */
export function lastTimeText(sets: readonly SetLike[], unit: Unit, bodyweight: boolean): string {
  return setGroups(sets, unit, bodyweight)
    .map(({ load, reps }) => `${load} × ${reps.join(', ')}`)
    .join(', ');
}

/** Time since the start, from timestamps (never a counter): "42:18", "1:02:18". */
export function elapsedText(start: Date, now: Date): string {
  const total = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue, Oct 6". */
export function ghostDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** A field on the log-a-set keypad. `fresh`: the value is the one shown when the sheet
 * opened, so the first key replaces it. */
export type KeyField = { text: string; fresh: boolean };

export function applyKey(field: KeyField, key: string, kind: 'weight' | 'reps'): KeyField {
  const text = field.fresh ? '' : field.text;
  if (key === 'delete') return { text: (field.fresh ? field.text : text).slice(0, -1), fresh: false };
  if (key === '.') {
    if (kind === 'reps' || text.includes('.')) return field.fresh ? { text: field.text, fresh: true } : field;
    return { text: `${text || '0'}.`, fresh: false };
  }
  if (!/^\d$/.test(key)) return field;
  const max = kind === 'reps' ? 3 : 7;
  if (text.length >= max) return { text, fresh: false };
  return { text: text + key, fresh: false };
}
