// What the rest-over screen (26) and its notification (27) say about the set after the rest.

import { currentExercise, plannedRows, setsFor } from './workout';
import type { Saved } from './workoutStore';

export type NextUp = { name: string; setNumber: number; planned: number; lastTime: string | null } | null;

/** The set that comes after the rest, with last time's set of the same number. `lastTimeSets`
 * is how many sets the exercise had last time (0 if none). */
export function nextUp(
  saved: Saved,
  names: Map<string, string>,
  lastTime: (exerciseId: string, setNumber: number) => string | null,
  lastTimeSets: (exerciseId: string) => number,
): NextUp {
  const next = currentExercise(saved.state, { focusId: saved.focusId });
  if (!next) return null;
  const setNumber = setsFor(saved.state, next.id).length + 1;
  return {
    name: names.get(next.exercise_id) ?? 'Your next exercise',
    setNumber,
    planned: plannedRows(saved.state, next.id, lastTimeSets(next.exercise_id)),
    lastTime: lastTime(next.exercise_id, setNumber),
  };
}

/** "Bicep curl, set 3 of 4 next" (27). */
export function detailText(next: NextUp): string {
  if (!next) return 'Time to finish your workout';
  return `${next.name}, set ${next.setNumber}${next.planned >= next.setNumber ? ` of ${next.planned}` : ''} next`;
}

/** "Bicep curl, set 3 of 4 next. Last time 20 × 5.": the plain text, for the lock screen,
 * screen readers and iOS, where the notification has no custom layout. */
export function nextText(next: NextUp): string {
  return `${detailText(next)}.${next?.lastTime ? ` Last time ${next.lastTime}.` : ''}`;
}
