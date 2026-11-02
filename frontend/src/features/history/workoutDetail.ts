// A past workout (21): its totals and each exercise's sets and best set, from the workout as
// the server (and the outbox) has it. Est. max is Epley on the best set (rule 4);
// bodyweight exercises use the workout's snapshot plus the added weight (rule 2).

import type { WorkoutDetail, WorkoutSet } from '@/api/pendingWrites';

export type ExerciseView = {
  rowId: string;
  exerciseId: string;
  sets: WorkoutSet[];
  totalReps: number;
  /** Null when no set has a rep. */
  estMaxKg: number | null;
  /** Index into `sets` of the set the est. max comes from (outlined on 21). */
  bestIndex: number | null;
};

export type WorkoutView = {
  minutes: number;
  sets: number;
  /** Load × reps over every set, in kg. */
  volumeKg: number;
  exercises: ExerciseView[];
};

const epley = (weight: number, reps: number) => weight * (1 + reps / 30);

export function workoutView(detail: WorkoutDetail, bodyweightIds: ReadonlySet<string>): WorkoutView {
  const end = detail.ended_at ? new Date(detail.ended_at).getTime() : new Date(detail.started_at).getTime();
  const minutes = Math.max(0, Math.round((end - new Date(detail.started_at).getTime()) / 60_000));
  let volumeKg = 0;
  const exercises: ExerciseView[] = [];
  for (const row of detail.exercises) {
    if (!row.sets.length) continue;
    const offset = bodyweightIds.has(row.exercise_id) ? detail.bodyweight_kg : 0;
    let estMaxKg: number | null = null;
    let bestIndex: number | null = null;
    row.sets.forEach((set, i) => {
      volumeKg += (set.weight_kg + offset) * set.reps;
      if (set.reps < 1) return;
      const estMax = epley(set.weight_kg + offset, set.reps);
      if (estMaxKg === null || estMax > estMaxKg) {
        estMaxKg = estMax;
        bestIndex = i;
      }
    });
    exercises.push({
      rowId: row.id,
      exerciseId: row.exercise_id,
      sets: row.sets,
      totalReps: row.sets.reduce((total, s) => total + s.reps, 0),
      estMaxKg,
      bestIndex,
    });
  }
  return {
    minutes,
    sets: exercises.reduce((total, e) => total + e.sets.length, 0),
    volumeKg: Math.round(volumeKg * 1000) / 1000,
    exercises,
  };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tuesday, Oct 6" (22). */
export function dayText(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}
