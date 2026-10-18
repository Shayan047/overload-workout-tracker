import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useExercises } from '@/api/splits';
import { ExercisePicker, GROUPS } from '@/features/splits/ExercisePicker';
import { muscleGroupOf } from '@/lib/exercises';
import { colors } from '@/theme';

import { useWorkoutActions } from './useWorkoutActions';
import { inProgress, useActiveWorkout } from './workoutStore';

const CHIPS = new Set<string | null>(GROUPS.map((g) => g.value));
const exercisesLabel = (n: number) => (n ? `Add ${n} ${n === 1 ? 'exercise' : 'exercises'}` : 'Add exercises');

/** The exercise picker (06) for today's workout: swap one exercise (10's "Swap for another
 * exercise") or add some to the end. Only this workout changes, never the split. */
export function PickExerciseScreen() {
  const { mode, rowId } = useLocalSearchParams<{ mode: 'swap' | 'add'; rowId?: string }>();
  const saved = inProgress(useActiveWorkout());
  const exercises = useExercises();
  const actions = useWorkoutActions();
  if (!saved) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const inWorkout = new Set(saved.state.exercises.filter((e) => e.status !== 'skipped').map((e) => e.exercise_id));
  const done = () => (router.canGoBack() ? router.back() : router.replace('/workout'));

  if (mode === 'swap' && rowId) {
    const row = saved.state.exercises.find((e) => e.id === rowId);
    const exercise = exercises.data?.find((e) => e.id === row?.exercise_id);
    // "Pick a similar one": start on the same muscle group.
    const group = exercise ? muscleGroupOf(exercise.primary_muscle) : null;
    return (
      <ExercisePicker
        title={exercise ? `Swap ${exercise.name.toLowerCase()}` : 'Swap exercise'}
        taken={inWorkout}
        takenLabel="In today's workout"
        single
        initial={{ group: CHIPS.has(group) ? group : null }}
        confirmTitle={([picked]) => (picked ? `Swap for ${picked.name.toLowerCase()}` : 'Pick an exercise')}
        onConfirm={([exerciseId]) => {
          void actions.swap(rowId, exerciseId);
          done();
        }}
      />
    );
  }

  return (
    <ExercisePicker
      title="Add to today"
      taken={inWorkout}
      takenLabel="In today's workout"
      confirmTitle={(picked) => exercisesLabel(picked.length)}
      onConfirm={(ids) => {
        void actions.add(ids);
        done();
      }}
    />
  );
}
