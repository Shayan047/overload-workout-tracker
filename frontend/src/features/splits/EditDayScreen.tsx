import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useExercises } from '@/api/splits';
import {
  BottomSheet,
  Button,
  Chip,
  IconButton,
  ReorderableList,
  RestPill,
  Tag,
  Text,
  TextField,
  useFrameInsets,
} from '@/components';
import { BackIcon, MoreIcon, PencilIcon, PlusIcon } from '@/components/icons';
import { equipmentLabel, type Exercise, formatRest, muscleLabel } from '@/lib/exercises';
import { colors, figure, figures, type } from '@/theme';

import {
  type DraftDay,
  type DraftExercise,
  moveExercise,
  removeDay,
  removeExercise,
  renameDay,
  setDayWeekday,
  setRest,
  WEEKDAYS_SHORT,
} from './draft';
import { draftStore, useDraft } from './draftStore';

const REST_STEP = 15;

function ExerciseRow({
  row,
  exercise,
  handle,
  onMore,
}: {
  row: DraftExercise;
  exercise: Exercise | undefined;
  handle: ReactNode;
  onMore: () => void;
}) {
  const name = exercise?.name ?? 'Exercise';
  const equipment = exercise ? equipmentLabel(exercise.equipment) : null;
  return (
    <View style={styles.exercise}>
      {handle}
      <View style={styles.exerciseText}>
        <Text variant="h2">{name}</Text>
        <View style={styles.tags}>
          {exercise ? <Tag label={muscleLabel(exercise.primary_muscle)} /> : null}
          {equipment ? <Tag label={equipment} /> : null}
          <RestPill text={`Rest ${formatRest(row.restSeconds)}`} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Options for ${name.toLowerCase()}`}
        onPress={onMore}
        style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
      >
        <MoreIcon color={colors.textFaint} />
      </Pressable>
    </View>
  );
}

/** Rest length and removal for one exercise, from its "…" button. */
function ExerciseSheet({
  day,
  row,
  name,
  onClose,
}: {
  day: DraftDay;
  row: DraftExercise | null;
  name: string;
  onClose: () => void;
}) {
  const change = (seconds: number) => row && draftStore.update((d) => setRest(d, day.id, row.id, seconds));
  return (
    <BottomSheet visible={!!row} onClose={onClose} accessibilityLabel={`Options for ${name}`}>
      {row ? (
        <View style={styles.sheet}>
          <Text variant="h2">{name}</Text>
          <Text variant="label" color="textMuted" style={styles.sheetLabel}>
            Rest after each set
          </Text>
          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="15 seconds less"
              onPress={() => change(row.restSeconds - REST_STEP)}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperLabel}>−15</Text>
            </Pressable>
            <Text style={styles.restValue} accessibilityLabel={`Rest ${formatRest(row.restSeconds)}`}>
              {formatRest(row.restSeconds)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="15 seconds more"
              onPress={() => change(row.restSeconds + REST_STEP)}
              style={styles.stepperButton}
            >
              <Text style={styles.stepperLabel}>+15</Text>
            </Pressable>
          </View>
          <View style={styles.sheetActions}>
            <Button title="Done" size="medium" onPress={onClose} />
            <Button
              title="Remove from this day"
              variant="text"
              onPress={() => {
                draftStore.update((d) => removeExercise(d, day.id, row.id));
                onClose();
              }}
            />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** Rename the day, set its weekday, or remove it, from the pencil button. */
function DaySheet({
  day,
  visible,
  weekdays,
  canRemove,
  onClose,
}: {
  day: DraftDay;
  visible: boolean;
  weekdays: boolean;
  canRemove: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={`Edit ${day.name}`}>
      <View style={styles.sheet}>
        <TextField
          label="Day name"
          value={day.name}
          onChangeText={(name) => draftStore.update((d) => renameDay(d, day.id, name))}
          returnKeyType="done"
          onSubmitEditing={onClose}
        />
        {weekdays ? (
          <View style={styles.weekdays}>
            <Text variant="label" color="textMuted" style={styles.sheetLabel}>
              Weekday
            </Text>
            <View style={styles.weekdayChips}>
              {WEEKDAYS_SHORT.map((label, weekday) => (
                <Chip
                  key={label}
                  label={label}
                  selected={day.weekday === weekday}
                  onPress={() => draftStore.update((d) => setDayWeekday(d, day.id, weekday))}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.sheetActions}>
          <Button title="Done" size="medium" onPress={onClose} />
          {canRemove ? (
            <Button
              title="Remove this day"
              variant="text"
              onPress={() => {
                onClose();
                router.back();
                draftStore.update((d) => removeDay(d, day.id));
              }}
            />
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

/** Edit a day (05): the day's exercises in workout order, each with its own rest length. */
export function EditDayScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { top, bottom } = useFrameInsets();
  const state = useDraft();
  const exercises = useExercises();
  const [optionsFor, setOptionsFor] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState(false);

  const draft = state?.draft;
  const index = draft?.days.findIndex((d) => d.id === dayId) ?? -1;
  if (!draft || index < 0) return <View style={styles.screen} />;
  const day = draft.days[index];
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const optionsRow = day.exercises.find((e) => e.id === optionsFor) ?? null;
  const count = day.exercises.length;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back to split" onPress={() => router.back()}>
            <BackIcon color={colors.text} />
          </IconButton>
          <IconButton accessibilityLabel="Rename day" onPress={() => setEditingDay(true)}>
            <PencilIcon color={colors.text} size={20} />
          </IconButton>
        </View>

        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          {day.name || 'Untitled day'}
        </Text>
        <Text color="textMuted" style={styles.subtitle}>
          Day {index + 1} of {draft.days.length} in your {draft.name.trim() || 'split'}
        </Text>

        <View style={styles.listHeader}>
          <Text variant="label" color="textMuted">
            {count} {count === 1 ? 'exercise' : 'exercises'}
          </Text>
          <Text variant="small" color="textFaint">
            Workout order. Drag to change it.
          </Text>
        </View>

        <View style={styles.list}>
          {count ? (
            <ReorderableList
              items={day.exercises}
              keyOf={(row) => row.id}
              handleLabel={(row) => `Reorder ${byId.get(row.exerciseId)?.name ?? 'exercise'}`}
              separator={<View style={styles.separator} />}
              onReorder={(from, to) => draftStore.update((d) => moveExercise(d, day.id, from, to))}
              renderItem={(row, _, handle) => (
                <ExerciseRow
                  row={row}
                  exercise={byId.get(row.exerciseId)}
                  handle={handle}
                  onMore={() => setOptionsFor(row.id)}
                />
              )}
            />
          ) : (
            <Text color="textMuted" style={styles.empty}>
              No exercises yet. Add the ones you do on this day.
            </Text>
          )}
        </View>

        <View style={styles.add}>
          <Button
            title="Add exercise"
            variant="secondary"
            icon={<PlusIcon color={colors.text} size={20} />}
            onPress={() => router.push({ pathname: '/add-exercises/[dayId]', params: { dayId: day.id } })}
          />
        </View>

        <View style={styles.spacer} />
        <Button title="Done" size="medium" onPress={() => router.back()} />
      </ScrollView>

      <ExerciseSheet
        day={day}
        row={optionsRow}
        name={byId.get(optionsRow?.exerciseId ?? '')?.name ?? 'Exercise'}
        onClose={() => setOptionsFor(null)}
      />
      <DaySheet
        day={day}
        visible={editingDay}
        weekdays={draft.repeatMode === 'weekdays'}
        canRemove={draft.days.length > 1}
        onClose={() => setEditingDay(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 22 },
  subtitle: { marginTop: 8 },
  listHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  list: { paddingVertical: 4, borderRadius: 20, backgroundColor: colors.surface, overflow: 'hidden' },
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 4,
  },
  exerciseText: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 4, columnGap: 6, marginTop: 5 },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  morePressed: { backgroundColor: colors.surfaceRaised },
  separator: { height: 1, marginLeft: 46, backgroundColor: colors.line },
  empty: { paddingVertical: 18, paddingHorizontal: 16 },
  add: { marginTop: 14 },
  spacer: { flexGrow: 1, minHeight: 12 },
  sheet: { gap: 4, paddingHorizontal: 6 },
  sheetLabel: { marginTop: 18, marginBottom: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperButton: {
    height: 44,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  stepperLabel: { ...type.stepper, color: colors.text },
  restValue: { ...figure(figures.restValue), color: colors.text },
  weekdays: { marginTop: 4 },
  weekdayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { marginTop: 22, gap: 6 },
});
