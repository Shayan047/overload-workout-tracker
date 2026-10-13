// What Today (07) shows, worked out on the phone from cached data so it works offline:
// the split, finished workouts and the last-time sets. The next-day rule matches the API's
// (backend app/services/splits.py, next_day).

import type { SplitTree } from '@/features/splits/draft';
import { formatWeight, fromKg, type Unit } from '@/lib/units';

export type FinishedWorkout = { split_day_id: string | null; ended_at: string | null };
type Day = SplitTree['days'][number];

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_SHORT = MONTH_LONG.map((m) => m.slice(0, 3));

/** Split weekdays are 0 = Monday; JavaScript's getDay() is 0 = Sunday. */
const splitWeekday = (date: Date) => (date.getDay() + 6) % 7;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

/** "Friday, October 9". */
export function dateHeading(date: Date): string {
  return `${WEEKDAY_LONG[date.getDay()]}, ${MONTH_LONG[date.getMonth()]} ${date.getDate()}`;
}

/** "Today", "Yesterday", "Tomorrow", a weekday within six days ("Tue"), else "Oct 2". */
export function relativeDay(date: Date, now: Date): string {
  const diff = daysBetween(now, date);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (Math.abs(diff) <= 6) return WEEKDAY_SHORT[date.getDay()];
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** Finished workouts for this split's days, most recent first. */
function finishedFor(split: SplitTree, workouts: readonly FinishedWorkout[]) {
  const ids = new Set(split.days.map((d) => d.id));
  return workouts
    .filter((w) => w.ended_at && w.split_day_id && ids.has(w.split_day_id))
    .map((w) => ({ dayId: w.split_day_id!, endedAt: new Date(w.ended_at!) }))
    .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
}

const scheduledOn = (split: SplitTree, date: Date): Day | undefined =>
  split.days.find((d) => d.weekday === splitWeekday(date));

/**
 * The day to train on `on`. In order: the day after the last one done, wrapping; the date
 * doesn't matter, so rest days never shift it. Set weekdays: the day for that weekday, or
 * null on a rest day. (Days deleted since are not on the phone, so a workout on a deleted
 * day doesn't count here; the API would continue from its old place.)
 */
export function nextDayId(split: SplitTree, workouts: readonly FinishedWorkout[], on: Date): string | null {
  if (!split.days.length) return null;
  if (split.repeat_mode === 'weekdays') return scheduledOn(split, on)?.id ?? null;
  const last = finishedFor(split, workouts)[0];
  if (!last) return split.days[0].id;
  const index = split.days.findIndex((d) => d.id === last.dayId);
  return split.days[(index + 1) % split.days.length].id;
}

export type StripItem = {
  dayId: string;
  name: string;
  role: 'previous' | 'today' | 'next';
  /** "Yesterday", "Today", "Next", "Mon"… */
  label: string;
  /** A check: that day was done. */
  done: boolean;
};

export type TodayPlan =
  | { kind: 'train'; day: Day; position: number; strip: StripItem[] }
  | { kind: 'rest'; next: { dayId: string; name: string; label: string } | null }
  | { kind: 'empty' };

/** Today's day and the rotation strip around it. `override` is "Do a different day". */
export function todayPlan(
  split: SplitTree,
  workouts: readonly FinishedWorkout[],
  now: Date,
  override?: string | null,
): TodayPlan {
  if (!split.days.length) return { kind: 'empty' };
  const finished = finishedFor(split, workouts);
  const lastDone = (dayId: string) => finished.find((w) => w.dayId === dayId)?.endedAt;
  const dayId = (override && split.days.some((d) => d.id === override) ? override : null) ?? nextDayId(split, workouts, now);

  if (split.repeat_mode === 'weekdays') {
    const findScheduled = (direction: 1 | -1) => {
      for (let i = 1; i <= 7; i += 1) {
        const date = addDays(now, i * direction);
        const day = scheduledOn(split, date);
        if (day) return { day, date };
      }
      return null;
    };
    const after = findScheduled(1);
    if (!dayId) {
      return {
        kind: 'rest',
        next: after ? { dayId: after.day.id, name: after.day.name, label: relativeDay(after.date, now) } : null,
      };
    }
    const index = split.days.findIndex((d) => d.id === dayId);
    const before = findScheduled(-1);
    const strip: StripItem[] = [];
    if (before && before.day.id !== dayId) {
      const done = lastDone(before.day.id);
      strip.push({
        dayId: before.day.id,
        name: before.day.name,
        role: 'previous',
        label: relativeDay(before.date, now),
        done: !!done && daysBetween(before.date, done) >= 0,
      });
    }
    strip.push({ dayId, name: split.days[index].name, role: 'today', label: 'Today', done: false });
    if (after && after.day.id !== dayId) {
      strip.push({ dayId: after.day.id, name: after.day.name, role: 'next', label: relativeDay(after.date, now), done: false });
    }
    return { kind: 'train', day: split.days[index], position: index + 1, strip };
  }

  const index = split.days.findIndex((d) => d.id === dayId);
  const n = split.days.length;
  const strip: StripItem[] = [];
  const previous = split.days[(index - 1 + n) % n];
  const previousDone = lastDone(previous.id);
  if (n >= 3 && previousDone) {
    strip.push({
      dayId: previous.id,
      name: previous.name,
      role: 'previous',
      label: relativeDay(previousDone, now),
      done: true,
    });
  }
  strip.push({ dayId: split.days[index].id, name: split.days[index].name, role: 'today', label: 'Today', done: false });
  if (n >= 2) {
    const next = split.days[(index + 1) % n];
    strip.push({ dayId: next.id, name: next.name, role: 'next', label: 'Next', done: false });
  }
  return { kind: 'train', day: split.days[index], position: index + 1, strip };
}

type LoggedSet = { set_number: number; weight_kg: number; reps: number };

/** "75 × 8", or "BW+10 × 8" / "BW × 12" for bodyweight exercises: the set with the highest
 * est. max (on the full load for bodyweight exercises), in the user's unit. */
export function bestSetText(
  sets: readonly LoggedSet[],
  options: { unit: Unit; bodyweightKg: number; bodyweight: boolean },
): string | null {
  const load = (s: LoggedSet) => s.weight_kg + (options.bodyweight ? options.bodyweightKg : 0);
  const best = sets
    .filter((s) => s.reps >= 1)
    .reduce<LoggedSet | null>((top, s) => (!top || load(s) * (1 + s.reps / 30) > load(top) * (1 + top.reps / 30) ? s : top), null);
  if (!best) return null;
  const weight = formatWeight(fromKg(best.weight_kg, options.unit));
  if (!options.bodyweight) return `${weight} × ${best.reps}`;
  return best.weight_kg > 0 ? `BW+${weight} × ${best.reps}` : `BW × ${best.reps}`;
}
