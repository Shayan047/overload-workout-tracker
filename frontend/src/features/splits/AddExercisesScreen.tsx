import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { newId } from '@/lib/ids';
import { isReviewMode } from '@/review/reviewMode';
import { sampleAddExercises } from '@/review/sampleData';
import { colors } from '@/theme';

import { addExercises } from './draft';
import { draftStore, useDraft } from './draftStore';
import { ExercisePicker } from './ExercisePicker';

const exercisesLabel = (n: number) => (n ? `Add ${n} ${n === 1 ? 'exercise' : 'exercises'}` : 'Add exercises');

/** Add exercises (06): several to a split day at once. */
export function AddExercisesScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const state = useDraft();
  const day = state?.draft.days.find((d) => d.id === dayId);
  const inDay = useMemo(() => new Set(day?.exercises.map((e) => e.exerciseId)), [day]);
  if (!day) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <ExercisePicker
      title="Add exercises"
      taken={inDay}
      takenLabel="In this day"
      initial={isReviewMode ? sampleAddExercises : undefined}
      confirmTitle={(picked) => exercisesLabel(picked.length)}
      onConfirm={(ids) => {
        draftStore.update((d) => addExercises(d, day.id, ids, newId));
        router.back();
      }}
    />
  );
}
