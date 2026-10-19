// The exercise library as the app sees it (GET /exercises), plus the search and labels the
// splits screens use. Search follows the same rules as the API, so it works offline from
// the cached library.

export type Exercise = {
  id: string;
  name: string;
  primary_muscle: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string | null;
  kind: 'weighted' | 'bodyweight';
  is_custom: boolean;
};

// The API's vocabulary (backend app/services/exercises.py).
export const MUSCLES = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
] as const;

export const MUSCLE_GROUPS: Record<string, readonly string[]> = {
  chest: ['chest'],
  back: ['lats', 'middle back', 'lower back', 'traps'],
  shoulders: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  core: ['abdominals'],
  forearms: ['forearms'],
  neck: ['neck'],
};

/** The group (filter chip) a muscle belongs to, or null. */
export function muscleGroupOf(muscle: string): string | null {
  return Object.entries(MUSCLE_GROUPS).find(([, muscles]) => muscles.includes(muscle))?.[0] ?? null;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function muscleLabel(muscle: string): string {
  return capitalize(muscle);
}

const EQUIPMENT_LABELS: Record<string, string> = {
  'body only': 'Bodyweight',
  'e-z curl bar': 'EZ bar',
  kettlebells: 'Kettlebell',
};

/** "Dumbbell", "Bodyweight", "EZ bar"… (05's tags); null when the exercise has none. */
export function equipmentLabel(equipment: string | null): string | null {
  if (!equipment) return null;
  return EQUIPMENT_LABELS[equipment] ?? capitalize(equipment);
}

/** "Biceps, dumbbell" (06). */
export function exerciseSubtitle(exercise: Exercise): string {
  const equipment = equipmentLabel(exercise.equipment);
  const muscle = muscleLabel(exercise.primary_muscle);
  if (!equipment) return muscle;
  return `${muscle}, ${equipment === 'EZ bar' ? equipment : equipment.toLowerCase()}`;
}

/** 150 -> "2:30". */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const normalize = (text: string) => text.toLowerCase().replace(/-/g, ' ');

/** Every word of `query` must appear in the name (case and hyphens ignored). Exact matches
 * first, then names that start with the query, then A–Z. `group` filters on the primary
 * muscle's group. */
export function searchExercises(
  exercises: readonly Exercise[],
  query: string,
  group: string | null,
): Exercise[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const phrase = words.join(' ');
  const muscles = group ? (MUSCLE_GROUPS[group] ?? []) : null;
  const rank = (name: string) => (!phrase ? 2 : name === phrase ? 0 : name.startsWith(phrase) ? 1 : 2);

  return exercises
    .filter((e) => !muscles || muscles.includes(e.primary_muscle))
    .map((e) => ({ e, name: normalize(e.name) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((a, b) => rank(a.name) - rank(b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map(({ e }) => e);
}
