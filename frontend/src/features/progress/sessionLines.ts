// Geometry for "Your last 3 workouts" (14) and "All workouts" (23): one line per session,
// the est. max of every set by set number, in the designs' SVG coordinates. Pure, so
// positions are tested against the designs.

import { formatWeight, fromKg, type Unit } from '@/lib/units';

import { niceTicks } from './chart';

type StatSet = { weight_kg: number; reps: number };
export type SessionInput = {
  workout_id: string;
  at: string;
  est_max_kg: number;
  best_set: StatSet;
  sets: StatSet[];
};

/** 14's chart: a 350 × 196 viewBox; sets run x 44–330 and values y 20–160. 23 is taller. */
export const LINES = { width: 350, height: 196, left: 44, right: 330, gridLeft: 34, gridRight: 342, top: 20, bottom: 160 };
export type LinesFrame = typeof LINES;

export type SessionLine = {
  workoutId: string;
  at: string;
  /** 0 for the latest session, 1 for the one before… */
  age: number;
  points: { x: number; y: number }[];
};

export type LinesChart = {
  lines: SessionLine[];
  ticks: { y: number; label: string }[];
  xLabels: { x: number; text: string }[];
};

const epley = (weight: number, reps: number) => weight * (1 + reps / 30);

/** Each set's est. max in kg (rule 4). For a bodyweight exercise the sets hold only the
 * added weight, so the session's bodyweight is recovered from its est. max and best set
 * (est. max = (bodyweight + added) × (1 + reps ÷ 30)) and added to every set (rule 2). */
export function perSetEstMax(session: SessionInput, bodyweight: boolean): number[] {
  const best = session.best_set;
  const offset = bodyweight && best.reps > 0 ? session.est_max_kg / (1 + best.reps / 30) - best.weight_kg : 0;
  return session.sets.map((s) => epley(s.weight_kg + offset, s.reps));
}

/** Lines for `sessions` (oldest first), newest first in the result so it draws on top. */
export function sessionLines(
  sessions: readonly SessionInput[],
  unit: Unit,
  frame: LinesFrame = LINES,
  bodyweight = false,
): LinesChart {
  const values = sessions.map((s) => perSetEstMax(s, bodyweight).map((kg) => fromKg(kg, unit)));
  const all = values.flat();
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const high = ticks[0];
  const low = ticks[ticks.length - 1];
  const y = (v: number) => frame.bottom - ((v - low) / (high - low)) * (frame.bottom - frame.top);
  const setCount = Math.max(...values.map((v) => v.length));
  const x = (i: number) =>
    setCount === 1 ? (frame.left + frame.right) / 2 : frame.left + (i / (setCount - 1)) * (frame.right - frame.left);

  const lines = sessions
    .map((s, i) => ({
      workoutId: s.workout_id,
      at: s.at,
      age: sessions.length - 1 - i,
      points: values[i].map((v, set) => ({ x: x(set), y: y(v) })),
    }))
    .reverse();
  return {
    lines,
    ticks: ticks.map((t) => ({ y: y(t), label: formatWeight(t) })),
    xLabels: Array.from({ length: setCount }, (_, i) => ({ x: x(i), text: `Set ${i + 1}` })),
  };
}
