// A split being edited (04, 05, 06). Edits are pure functions that return a new draft;
// nothing is written until "Save split", which turns the draft into outbox writes
// (plan.ts).

import { derivedId } from '@/lib/ids';

export type RepeatMode = 'in_order' | 'weekdays';
export type DraftExercise = { id: string; exerciseId: string; restSeconds: number };
export type DraftDay = { id: string; name: string; weekday: number | null; exercises: DraftExercise[] };
export type SplitDraft = { id: string; name: string; repeatMode: RepeatMode; days: DraftDay[] };

/** GET /presets. */
export type Preset = {
  key: string;
  name: string;
  summary: string;
  repeat_mode: RepeatMode;
  days: {
    name: string;
    weekday: number | null;
    exercises: { exercise_id: string; rest_seconds: number }[];
  }[];
};

/** GET /splits/{id}. */
export type SplitTree = {
  id: string;
  name: string;
  repeat_mode: RepeatMode;
  days: {
    id: string;
    name: string;
    weekday: number | null;
    exercises: { id: string; exercise_id: string; rest_seconds: number }[];
  }[];
};

/** Rest for exercises added from Add exercises (06). */
export const DEFAULT_REST_SECONDS = 90;
export const MAX_REST_SECONDS = 3600;

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A preset copied into a new split. Ids follow the server's from-preset convention
 * (uuid5 of the split id), so the same split can be re-created anywhere. */
export function draftFromPreset(preset: Preset, splitId: string): SplitDraft {
  return {
    id: splitId,
    name: preset.name,
    repeatMode: preset.repeat_mode,
    days: preset.days.map((day, i) => ({
      id: derivedId(splitId, `day:${i}`),
      name: day.name,
      weekday: day.weekday,
      exercises: day.exercises.map((e, j) => ({
        id: derivedId(splitId, `day:${i}:exercise:${j}`),
        exerciseId: e.exercise_id,
        restSeconds: e.rest_seconds,
      })),
    })),
  };
}

/** "Build my own" (03): one empty day to start from. */
export function newDraft(makeId: () => string): SplitDraft {
  return {
    id: makeId(),
    name: 'My split',
    repeatMode: 'in_order',
    days: [{ id: makeId(), name: 'Day 1', weekday: null, exercises: [] }],
  };
}

export function draftFromTree(tree: SplitTree): SplitDraft {
  return {
    id: tree.id,
    name: tree.name,
    repeatMode: tree.repeat_mode,
    days: tree.days.map((day) => ({
      id: day.id,
      name: day.name,
      weekday: day.weekday,
      exercises: day.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        restSeconds: e.rest_seconds,
      })),
    })),
  };
}

const mapDay = (draft: SplitDraft, dayId: string, change: (day: DraftDay) => DraftDay): SplitDraft => ({
  ...draft,
  days: draft.days.map((day) => (day.id === dayId ? change(day) : day)),
});

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function renameSplit(draft: SplitDraft, name: string): SplitDraft {
  return { ...draft, name };
}

/** Days with no weekday yet get spread over the week (3 days: Mon, Wed, Fri). */
const SPREAD: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function setRepeatMode(draft: SplitDraft, repeatMode: RepeatMode): SplitDraft {
  if (repeatMode === 'in_order' || draft.days.every((d) => d.weekday !== null)) {
    return { ...draft, repeatMode };
  }
  const spread = SPREAD[Math.min(draft.days.length, 7)] ?? [];
  return {
    ...draft,
    repeatMode,
    days: draft.days.map((day, i) => (day.weekday === null ? { ...day, weekday: spread[i] ?? null } : day)),
  };
}

export function addDay(draft: SplitDraft, makeId: () => string): SplitDraft {
  const taken = new Set(draft.days.map((d) => d.weekday));
  const freeWeekday = draft.repeatMode === 'weekdays' ? ([0, 1, 2, 3, 4, 5, 6].find((w) => !taken.has(w)) ?? null) : null;
  return {
    ...draft,
    days: [...draft.days, { id: makeId(), name: `Day ${draft.days.length + 1}`, weekday: freeWeekday, exercises: [] }],
  };
}

export function renameDay(draft: SplitDraft, dayId: string, name: string): SplitDraft {
  return mapDay(draft, dayId, (day) => ({ ...day, name }));
}

export function setDayWeekday(draft: SplitDraft, dayId: string, weekday: number | null): SplitDraft {
  return mapDay(draft, dayId, (day) => ({ ...day, weekday }));
}

export function removeDay(draft: SplitDraft, dayId: string): SplitDraft {
  return { ...draft, days: draft.days.filter((d) => d.id !== dayId) };
}

export function moveDay(draft: SplitDraft, from: number, to: number): SplitDraft {
  return from === to ? draft : { ...draft, days: move(draft.days, from, to) };
}

/** Adds exercises to the end of a day, skipping any already in it. */
export function addExercises(
  draft: SplitDraft,
  dayId: string,
  exerciseIds: readonly string[],
  makeId: () => string,
  restSeconds = DEFAULT_REST_SECONDS,
): SplitDraft {
  return mapDay(draft, dayId, (day) => {
    const present = new Set(day.exercises.map((e) => e.exerciseId));
    const added = exerciseIds
      .filter((id) => !present.has(id))
      .map((exerciseId) => ({ id: makeId(), exerciseId, restSeconds }));
    return { ...day, exercises: [...day.exercises, ...added] };
  });
}

export function removeExercise(draft: SplitDraft, dayId: string, rowId: string): SplitDraft {
  return mapDay(draft, dayId, (day) => ({ ...day, exercises: day.exercises.filter((e) => e.id !== rowId) }));
}

export function moveExercise(draft: SplitDraft, dayId: string, from: number, to: number): SplitDraft {
  return from === to ? draft : mapDay(draft, dayId, (day) => ({ ...day, exercises: move(day.exercises, from, to) }));
}

export function setRest(draft: SplitDraft, dayId: string, rowId: string, seconds: number): SplitDraft {
  const restSeconds = Math.min(MAX_REST_SECONDS, Math.max(0, Math.round(seconds)));
  return mapDay(draft, dayId, (day) => ({
    ...day,
    exercises: day.exercises.map((e) => (e.id === rowId ? { ...e, restSeconds } : e)),
  }));
}

/** What to fix before saving, or null. */
export function validateDraft(draft: SplitDraft): string | null {
  if (!draft.name.trim()) return 'Give your split a name.';
  if (!draft.days.length) return 'Add at least one day.';
  const unnamed = draft.days.findIndex((d) => !d.name.trim());
  if (unnamed >= 0) return `Give day ${unnamed + 1} a name.`;
  if (draft.repeatMode === 'weekdays') {
    const missing = draft.days.find((d) => d.weekday === null);
    if (missing) return `Pick a weekday for ${missing.name.trim()}.`;
    const seen = new Set<number>();
    for (const day of draft.days) {
      if (seen.has(day.weekday!)) {
        return `Two days are set to ${WEEKDAYS[day.weekday!]}. Give each day its own weekday.`;
      }
      seen.add(day.weekday!);
    }
  }
  return null;
}
