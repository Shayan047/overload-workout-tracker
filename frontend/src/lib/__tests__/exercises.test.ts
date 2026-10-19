import {
  equipmentLabel,
  type Exercise,
  exerciseSubtitle,
  formatRest,
  muscleGroupOf,
  muscleLabel,
  searchExercises,
} from '../exercises';

const ex = (name: string, primary_muscle = 'biceps', equipment: string | null = 'dumbbell'): Exercise => ({
  id: name,
  name,
  primary_muscle,
  muscle_group: primary_muscle === 'lats' ? 'back' : primary_muscle,
  secondary_muscles: [],
  equipment,
  kind: equipment === 'body only' ? 'bodyweight' : 'weighted',
  is_custom: false,
});

const LIBRARY = [
  ex('Incline dumbbell curl'),
  ex('Hammer curls'),
  ex('Barbell curl', 'biceps', 'barbell'),
  ex('Curl to press', 'shoulders'),
  ex('Chin-up', 'lats', 'body only'),
  ex('Lying leg curls', 'hamstrings', 'machine'),
  ex('Curl', 'biceps', 'cable'),
];

describe('searchExercises (same rules as GET /exercises)', () => {
  const names = (q: string, group: string | null = null) => searchExercises(LIBRARY, q, group).map((e) => e.name);

  test('every word must match; exact, then prefix, then A–Z', () => {
    expect(names('curl')).toEqual([
      'Curl',
      'Curl to press',
      'Barbell curl',
      'Hammer curls',
      'Incline dumbbell curl',
      'Lying leg curls',
    ]);
    expect(names('hammer curl')).toEqual(['Hammer curls']);
  });

  test('case and hyphens do not matter', () => {
    expect(names('CHIN UP')).toEqual(['Chin-up']);
    expect(names('chin-up')).toEqual(['Chin-up']);
  });

  test('the muscle-group filter uses the primary muscle', () => {
    expect(names('curl', 'biceps')).toEqual(['Curl', 'Barbell curl', 'Hammer curls', 'Incline dumbbell curl']);
    expect(names('', 'back')).toEqual(['Chin-up']);
  });

  test('no query lists everything A–Z', () => {
    expect(names('')).toEqual([...LIBRARY.map((e) => e.name)].sort((a, b) => a.localeCompare(b)));
  });
});

describe('labels', () => {
  test('muscles and equipment as the designs write them', () => {
    expect(muscleLabel('middle back')).toBe('Middle back');
    expect(equipmentLabel('body only')).toBe('Bodyweight');
    expect(equipmentLabel('e-z curl bar')).toBe('EZ bar');
    expect(equipmentLabel('kettlebells')).toBe('Kettlebell');
    expect(equipmentLabel(null)).toBeNull();
  });

  test('the subtitle on Add exercises (06): "Biceps, dumbbell"', () => {
    expect(exerciseSubtitle(ex('x', 'biceps', 'dumbbell'))).toBe('Biceps, dumbbell');
    expect(exerciseSubtitle(ex('x', 'biceps', 'e-z curl bar'))).toBe('Biceps, EZ bar');
    expect(exerciseSubtitle(ex('x', 'lats', null))).toBe('Lats');
  });

  test('rest lengths as m:ss', () => {
    expect(formatRest(150)).toBe('2:30');
    expect(formatRest(60)).toBe('1:00');
    expect(formatRest(45)).toBe('0:45');
    expect(formatRest(0)).toBe('0:00');
  });
});

describe('muscleGroupOf: the filter chip a muscle belongs to (swap shows similar ones)', () => {
  test.each([
    ['biceps', 'biceps'],
    ['lats', 'back'],
    ['quadriceps', 'legs'],
    ['abdominals', 'core'],
    ['forearms', 'forearms'],
    ['side delts', null],
  ])('%s → %s', (muscle, group) => {
    expect(muscleGroupOf(muscle)).toBe(group);
  });
});
