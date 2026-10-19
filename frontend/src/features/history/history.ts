// History (18): the month calendar, the line under it, and each workout's row. Pure, so the
// rules are tested; dates are the phone's local calendar days.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Dated = { started_at: string; ended_at: string | null };

export type DayState = 'trained' | 'rest' | 'future' | 'today' | 'today-trained';
export type Cell = { day: number; state: DayState } | null;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The calendar days that have a finished workout. */
function trainedDays(workouts: readonly Dated[]): Set<string> {
  return new Set(workouts.filter((w) => w.ended_at).map((w) => dayKey(new Date(w.started_at))));
}

/** "1st", "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** A month (0-based) as weeks from Monday to Sunday, with each day's state. */
export function calendar(year: number, month: number, workouts: readonly Dated[], now: Date) {
  const trained = trainedDays(workouts);
  const today = startOfDay(now);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: Cell[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month, day);
    const done = trained.has(dayKey(date));
    const isToday = date.getTime() === today.getTime();
    const state: DayState = isToday
      ? done
        ? 'today-trained'
        : 'today'
      : date > today
        ? 'future'
        : done
          ? 'trained'
          : 'rest';
    cells.push({ day, state });
  }
  while (cells.length % 7) cells.push(null);

  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { title: `${MONTHS[month]} ${year}`, weeks };
}

/** The line under the calendar: this month's workouts so far and its rest days before today
 * (counted from the first workout ever); for an earlier month, the count. */
export function monthNote(year: number, month: number, workouts: readonly Dated[], now: Date): string {
  const finished = workouts.filter((w) => w.ended_at);
  const inMonth = finished.filter((w) => {
    const d = new Date(w.started_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const count = inMonth.length;
  const plural = `${count} ${count === 1 ? 'workout' : 'workouts'}`;
  const current = now.getFullYear() === year && now.getMonth() === month;
  if (!current) {
    if (new Date(year, month, 1) > now) return '';
    return count ? `${plural} in ${MONTHS[month]}.` : `No workouts in ${MONTHS[month]}.`;
  }
  if (!count) return 'No workouts yet this month.';

  const trained = trainedDays(finished);
  const first = startOfDay(new Date(Math.min(...finished.map((w) => new Date(w.started_at).getTime()))));
  const rest: Date[] = [];
  for (let day = 1; day < now.getDate(); day += 1) {
    const date = new Date(year, month, day);
    if (date >= first && !trained.has(dayKey(date))) rest.push(date);
  }
  if (!rest.length) return `${plural} so far this month. No rest days yet.`;
  if (rest.length === 1) {
    const [day] = rest;
    return `${plural} so far this month. Your only rest day was ${WEEKDAYS[day.getDay()]} the ${ordinal(day.getDate())}.`;
  }
  return `${plural} so far this month, with ${rest.length} rest days.`;
}

/** "Fri, Oct 9. 47 min, 20 sets". */
export function workoutLine(w: Dated & { sets: number }): string {
  const start = new Date(w.started_at);
  const minutes = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - start.getTime()) / 60_000) : 0;
  const date = `${SHORT_DAYS[start.getDay()]}, ${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
  return `${date}. ${minutes} min, ${w.sets} ${w.sets === 1 ? 'set' : 'sets'}`;
}

/** Workouts that started on `day` (a calendar cell the user picked). */
export function onDay<T extends Dated>(workouts: readonly T[], year: number, month: number, day: number): T[] {
  const key = dayKey(new Date(year, month, day));
  return workouts.filter((w) => dayKey(new Date(w.started_at)) === key);
}
