// Ghost mode and the numbers around it (08, 09): today against the most recent finished
// session of the same exercise (rule 9), set by set. Computed on the phone from the cached
// previous session, so it works offline.

import { formatWeight, fromKg, type Unit } from '@/lib/units';

type SetLike = { set_number: number; weight_kg: number; reps: number };

export type Ghost = {
  /** Sets logged today. */
  sets: number;
  /** Your reps through those sets. */
  you: number;
  /** Last time's reps through the same sets (all of them, if you've done more). */
  last: number;
  /** Last time's reps in total. */
  lastTotal: number;
  /** you − last. */
  delta: number;
};

const byNumber = (sets: readonly SetLike[]) => [...sets].sort((a, b) => a.set_number - b.set_number);
const sum = (sets: readonly SetLike[]) => sets.reduce((total, s) => total + s.reps, 0);

export function ghost(today: readonly SetLike[], last: readonly SetLike[]): Ghost {
  const mine = byNumber(today);
  const theirs = byNumber(last);
  const you = sum(mine);
  const lastThrough = sum(theirs.slice(0, mine.length));
  return { sets: mine.length, you, last: lastThrough, lastTotal: sum(theirs), delta: you - lastThrough };
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

/** Up next (08): "25 × 9, 8, 7"; a new weight starts a new group: "25 × 9, 22.5 × 8". */
export function lastTimeText(sets: readonly SetLike[], unit: Unit, bodyweight: boolean): string {
  const groups: { weight: number; reps: number[] }[] = [];
  for (const set of byNumber(sets)) {
    const last = groups[groups.length - 1];
    if (last && last.weight === set.weight_kg) last.reps.push(set.reps);
    else groups.push({ weight: set.weight_kg, reps: [set.reps] });
  }
  return groups
    .map(({ weight, reps }) => {
      const load = bodyweight
        ? weight > 0
          ? `bodyweight + ${weightText(weight, unit)}`
          : 'bodyweight'
        : weightText(weight, unit);
      return `${load} × ${reps.join(', ')}`;
    })
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
