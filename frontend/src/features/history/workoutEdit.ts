// Editing a past workout (22): the draft the screen edits, what Save refuses, and the
// minimal outbox writes for the changes. Only sets change: weight, reps, added or deleted
// sets, renumbered in order. The workout's bodyweight snapshot never changes (rule 3).

import type { WorkoutDetail } from '@/api/pendingWrites';
import { formatWeight, fromKg, toKg, type Unit } from '@/lib/units';

export type DraftSet = {
  /** Null for a set added in this edit. */
  id: string | null;
  weightText: string;
  repsText: string;
  /** The set as it was, with the text it started as; null for an added set. */
  original: { weight_kg: number; reps: number; weightText: string } | null;
};
export type DraftRow = { rowId: string; exerciseId: string; sets: DraftSet[] };
export type EditDraft = { rows: DraftRow[] };

export type SetWrite =
  | { method: 'PUT'; path: string; body: { workout_exercise_id: string; set_number: number; weight_kg: number; reps: number; logged_at: string } }
  | { method: 'DELETE'; path: string };

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** The workout's exercises that have sets, as editable text in the user's unit. */
export function editDraft(detail: WorkoutDetail, unit: Unit): EditDraft {
  return {
    rows: detail.exercises
      .filter((r) => r.sets.length > 0)
      .map((r) => ({
        rowId: r.id,
        exerciseId: r.exercise_id,
        sets: r.sets.map((s) => {
          const weightText = formatWeight(fromKg(s.weight_kg, unit));
          return {
            id: s.id,
            weightText,
            repsText: String(s.reps),
            original: { weight_kg: s.weight_kg, reps: s.reps, weightText },
          };
        }),
      })),
  };
}

const parseWeight = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));
const parseReps = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN);

/** Why Save can't go ahead yet, naming the set (and its exercise, given `nameOf`), or null. */
export function checkDraft(draft: EditDraft, nameOf?: (exerciseId: string) => string): string | null {
  for (const row of draft.rows) {
    const prefix = nameOf ? `${nameOf(row.exerciseId)}, set` : 'Set';
    for (const [i, set] of row.sets.entries()) {
      const weight = parseWeight(set.weightText);
      if (!Number.isFinite(weight) || weight < 0) return `${prefix} ${i + 1} needs a weight of 0 or more.`;
      const reps = parseReps(set.repsText);
      if (!Number.isFinite(reps) || reps < 1) return `${prefix} ${i + 1} needs reps.`;
      if (reps > 1000) return `${prefix} ${i + 1} has more reps than a set can.`;
    }
  }
  return null;
}

/** The writes that turn `original` into `draft`: a PUT for every new or changed set
 * (renumbered 1, 2, 3… in order), and a DELETE for every set removed. Call after
 * `checkDraft` passes. */
export function planWorkoutEdit(original: WorkoutDetail, draft: EditDraft, unit: Unit, makeId: () => string): SetWrite[] {
  const puts: SetWrite[] = [];
  const kept = new Set<string>();
  for (const row of draft.rows) {
    const source = original.exercises.find((r) => r.id === row.rowId);
    const before = new Map((source?.sets ?? []).map((s) => [s.id, s]));
    const lastLogged = source?.sets.at(-1)?.logged_at ?? original.ended_at ?? original.started_at;
    row.sets.forEach((set, i) => {
      const setNumber = i + 1;
      const reps = parseReps(set.repsText);
      // An untouched weight keeps its stored kg; converting the shown text back could drift.
      const weightKg =
        set.original && set.weightText === set.original.weightText
          ? set.original.weight_kg
          : round3(toKg(parseWeight(set.weightText), unit));
      const prior = set.id ? before.get(set.id) : undefined;
      if (prior) kept.add(prior.id);
      if (prior && prior.set_number === setNumber && prior.weight_kg === weightKg && prior.reps === reps) return;
      const id = prior?.id ?? makeId();
      puts.push({
        method: 'PUT',
        path: `/sets/${id}`,
        body: {
          workout_exercise_id: row.rowId,
          set_number: setNumber,
          weight_kg: weightKg,
          reps,
          logged_at: prior?.logged_at ?? lastLogged,
        },
      });
    });
  }
  const deletes: SetWrite[] = original.exercises
    .flatMap((r) => r.sets)
    .filter((s) => !kept.has(s.id))
    .map((s) => ({ method: 'DELETE', path: `/sets/${s.id}` }));
  return [...puts, ...deletes];
}
