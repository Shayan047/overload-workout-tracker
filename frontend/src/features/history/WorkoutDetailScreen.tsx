import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { type WorkoutDetail, useWorkoutDetail, useWorkoutEdits } from '@/api/workouts';
import { BottomSheet, Button, IconButton, Notice, Text, useFrameInsets } from '@/components';
import { BackIcon, CloseIcon, PencilIcon, PlusIcon } from '@/components/icons';
import { estMaxText } from '@/features/progress/progressText';
import { timeRange } from '@/features/workout/summary';
import { newId } from '@/lib/ids';
import { equipmentLabel, type Exercise } from '@/lib/exercises';
import { formatWeight, fromKg, type Unit } from '@/lib/units';
import { colors, figure, figures, figureTimes, radius, space } from '@/theme';

import { dayText, type ExerciseView, workoutView } from './workoutDetail';
import { checkDraft, type DraftSet, editDraft, type EditDraft, planWorkoutEdit } from './workoutEdit';

const TILES_PER_ROW = 4;
const TILE_GAP = 8;
const CARD_PADDING = 16;

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/history');
}

/** "75", "+10" (added weight on a bodyweight exercise), "BW" (none added). */
function weightText(kg: number, unit: Unit, bodyweight: boolean): string {
  const value = formatWeight(fromKg(kg, unit));
  if (!bodyweight) return value;
  return kg > 0 ? `+${value}` : 'BW';
}

/** A past workout (21), opened from History; Edit turns it into 22. */
export function WorkoutDetailScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const { top, bottom } = useFrameInsets();
  const query = useWorkoutDetail(workoutId);
  const exercises = useExercises();
  const settings = useSettings();
  const edits = useWorkoutEdits();
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const unit = settings.data?.unit ?? 'lb';
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const detail = query.data ?? null;

  // Android's back button leaves editing without saving, like the close button.
  useEffect(() => {
    if (!draft) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDraft(null);
      setError(null);
      return true;
    });
    return () => sub.remove();
  }, [draft]);

  if (!detail) {
    const message = query.isPending
      ? 'Loading…'
      : query.isError
        ? 'This workout needs a connection the first time. It’s saved on this phone after that.'
        : 'This workout was deleted.';
    return (
      <View style={[styles.screen, { paddingTop: top + 8, paddingHorizontal: space.gutter }]}>
        <IconButton accessibilityLabel="Back to history" onPress={back}>
          <BackIcon color={colors.text} />
        </IconButton>
        <Text color="textMuted" style={styles.message}>
          {message}
        </Text>
      </View>
    );
  }

  const nameOf = (exerciseId: string) => byId.get(exerciseId)?.name ?? 'Exercise';
  const save = async () => {
    if (!draft) return;
    const problem = checkDraft(draft, nameOf);
    if (problem) return setError(problem);
    setSaving(true);
    await edits.save(detail, planWorkoutEdit(detail, draft, unit, newId));
    setSaving(false);
    setDraft(null);
    setError(null);
  };

  if (draft) {
    return (
      <EditWorkout
        detail={detail}
        draft={draft}
        unit={unit}
        byId={byId}
        error={error}
        saving={saving}
        onChange={(next) => {
          setDraft(next);
          setError(null);
        }}
        onCancel={() => {
          setDraft(null);
          setError(null);
        }}
        onSave={() => void save()}
        onDelete={() => setDeleting(true)}
        deleting={deleting}
        onDeleteClose={() => setDeleting(false)}
        onDeleteConfirm={() => {
          setDeleting(false);
          back();
          void edits.remove(detail.id);
        }}
      />
    );
  }

  const bodyweightIds = new Set((exercises.data ?? []).filter((e) => e.kind === 'bodyweight').map((e) => e.id));
  const view = workoutView(detail, bodyweightIds);
  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back to history" onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit workout"
            onPress={() => setDraft(editDraft(detail, unit))}
            style={({ pressed }) => [styles.editPill, pressed && styles.editPillPressed]}
          >
            <PencilIcon color={colors.text} size={18} />
            <Text variant="bodyHeavy">Edit</Text>
          </Pressable>
        </View>

        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          {detail.title}
        </Text>
        <Text color="textMuted" style={styles.when}>
          {detail.ended_at ? timeRange(new Date(detail.started_at), new Date(detail.ended_at)) : dayText(new Date(detail.started_at))}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{view.minutes}</Text>
            <Text variant="small" color="textMuted">
              minutes
            </Text>
          </View>
          <View style={styles.statRule} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{view.sets}</Text>
            <Text variant="small" color="textMuted">
              sets
            </Text>
          </View>
          <View style={styles.statRule} />
          <View style={[styles.stat, styles.statWide]}>
            <Text style={styles.statValue}>{Math.round(fromKg(view.volumeKg, unit)).toLocaleString('en-US')}</Text>
            <Text variant="small" color="textMuted">
              {unit} lifted
            </Text>
          </View>
        </View>

        {view.exercises.map((e) => (
          <ExerciseCard
            key={e.rowId}
            view={e}
            exercise={byId.get(e.exerciseId)}
            unit={unit}
            bodyweightKg={detail.bodyweight_kg}
          />
        ))}

        {view.exercises.length ? (
          <Text variant="small" color="textFaint" style={styles.footnote}>
            The outlined set is each exercise’s best set. Its est. max comes from that set.
          </Text>
        ) : (
          <Text color="textMuted" style={styles.message}>
            No sets were logged in this workout.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

/** One exercise on 21: its sets as tiles, four to a row, and its est. max. */
function ExerciseCard({
  view,
  exercise,
  unit,
  bodyweightKg,
}: {
  view: ExerciseView;
  exercise: Exercise | undefined;
  unit: Unit;
  bodyweightKg: number;
}) {
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * space.gutter - 2 * CARD_PADDING - (TILES_PER_ROW - 1) * TILE_GAP) / TILES_PER_ROW;
  const bodyweight = exercise?.kind === 'bodyweight';
  const name = exercise?.name ?? 'Exercise';
  const reps = `${view.totalReps} ${view.totalReps === 1 ? 'rep' : 'reps'}`;
  const equipment = exercise ? equipmentLabel(exercise.equipment) : null;
  const subtitle = bodyweight
    ? `Bodyweight ${formatWeight(fromKg(bodyweightKg, unit))} ${unit} plus added weight`
    : [equipment, reps].filter(Boolean).join(', ');
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text variant="h2">{name}</Text>
          <Text variant="small" color="textMuted">
            {subtitle}
          </Text>
        </View>
        {view.estMaxKg !== null ? (
          <View style={styles.estMax}>
            <Text style={styles.estMaxValue}>{estMaxText(view.estMaxKg, unit)}</Text>
            <Text variant="small" color="textFaint">
              est. max
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tiles}>
        {view.sets.map((set, i) => {
          const weight = weightText(set.weight_kg, unit, bodyweight);
          return (
            <View
              key={set.id}
              accessible
              accessibilityLabel={`Set ${i + 1}, ${weight} times ${set.reps}${i === view.bestIndex ? ', best set' : ''}`}
              style={[styles.tile, { width: tileWidth }, i === view.bestIndex && styles.tileBest]}
            >
              <Text variant="tileLabel" color="textFaint">
                Set {i + 1}
              </Text>
              <View style={styles.tileValue}>
                <Text style={styles.tileNumber}>{weight}</Text>
                <Text style={styles.tileTimes}>×</Text>
                <Text style={styles.tileNumber}>{set.reps}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type EditProps = {
  detail: WorkoutDetail;
  draft: EditDraft;
  unit: Unit;
  byId: Map<string, Exercise>;
  error: string | null;
  saving: boolean;
  onChange: (draft: EditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  deleting: boolean;
  onDeleteClose: () => void;
  onDeleteConfirm: () => void;
};

/** Editing a past workout (22): weight and reps as fields, sets added or deleted. Nothing is
 * written until Save. */
function EditWorkout(props: EditProps) {
  const { detail, draft, unit, byId, error, saving, onChange } = props;
  const { top, bottom } = useFrameInsets();
  const [focused, setFocused] = useState<string | null>(null);

  const updateSet = (rowIndex: number, setIndex: number, change: Partial<DraftSet>) =>
    onChange({
      rows: draft.rows.map((row, r) =>
        r === rowIndex ? { ...row, sets: row.sets.map((s, i) => (i === setIndex ? { ...s, ...change } : s)) } : row,
      ),
    });
  const removeSet = (rowIndex: number, setIndex: number) =>
    onChange({
      rows: draft.rows.map((row, r) => (r === rowIndex ? { ...row, sets: row.sets.filter((_, i) => i !== setIndex) } : row)),
    });
  const addSet = (rowIndex: number) =>
    onChange({
      rows: draft.rows.map((row, r) =>
        r === rowIndex
          ? { ...row, sets: [...row.sets, { id: null, weightText: row.sets.at(-1)?.weightText ?? '', repsText: '', original: null }] }
          : row,
      ),
    });

  return (
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: top }]} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: bottom }]}>
        <View style={styles.editHeader}>
          <IconButton accessibilityLabel="Cancel editing" onPress={props.onCancel}>
            <CloseIcon color={colors.text} />
          </IconButton>
          <Text variant="h1Small" accessibilityRole="header" style={styles.flex}>
            Edit workout
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={props.onSave}
            style={({ pressed }) => [styles.savePill, pressed && styles.savePillPressed]}
          >
            <Text variant="bodyHeavy" color="onAccent">
              Save
            </Text>
          </Pressable>
        </View>
        <Text color="textMuted" style={styles.editNote}>
          {detail.title}, {dayText(new Date(detail.started_at))}. Your progress updates when you save.
        </Text>

        {draft.rows.map((row, r) => {
          const exercise = byId.get(row.exerciseId);
          const name = exercise?.name ?? 'Exercise';
          const bodyweight = exercise?.kind === 'bodyweight';
          return (
            <View key={row.rowId} style={styles.editCard}>
              <Text variant="h2" style={styles.editName}>
                {name}
              </Text>
              <View style={[styles.editGrid, styles.editLabels]}>
                <Text variant="label" color="textFaint" style={styles.editSetCol}>
                  Set
                </Text>
                <Text variant="label" color="textFaint" style={styles.editValueCol}>
                  {bodyweight ? `Added ${unit}` : unit}
                </Text>
                <Text variant="label" color="textFaint" style={styles.editValueCol}>
                  Reps
                </Text>
                <View style={styles.editDeleteCol} />
              </View>
              {row.sets.map((set, i) => {
                const key = `${row.rowId}-${i}`;
                return (
                  <View key={set.id ?? key} style={[styles.editGrid, styles.editRow]}>
                    <Text style={[styles.editSetNumber, styles.editSetCol]}>{i + 1}</Text>
                    <TextInput
                      accessibilityLabel={`${name}, set ${i + 1}, ${bodyweight ? 'added weight' : 'weight'} in ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
                      value={set.weightText}
                      onChangeText={(weightText) => updateSet(r, i, { weightText })}
                      onFocus={() => setFocused(`${key}-w`)}
                      onBlur={() => setFocused(null)}
                      keyboardType="decimal-pad"
                      maxLength={6}
                      selectionColor={colors.accent}
                      cursorColor={colors.accent}
                      style={[styles.field, styles.editValueCol, focused === `${key}-w` && styles.fieldFocused]}
                    />
                    <TextInput
                      accessibilityLabel={`${name}, set ${i + 1}, reps`}
                      value={set.repsText}
                      onChangeText={(repsText) => updateSet(r, i, { repsText })}
                      onFocus={() => setFocused(`${key}-r`)}
                      onBlur={() => setFocused(null)}
                      keyboardType="number-pad"
                      maxLength={4}
                      selectionColor={colors.accent}
                      cursorColor={colors.accent}
                      style={[styles.field, styles.editValueCol, focused === `${key}-r` && styles.fieldFocused]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${name.toLowerCase()} set ${i + 1}`}
                      onPress={() => removeSet(r, i)}
                      style={({ pressed }) => [styles.delete, styles.editDeleteCol, pressed && styles.deletePressed]}
                    >
                      <CloseIcon color={colors.textFaint} size={18} />
                    </Pressable>
                  </View>
                );
              })}
              <Pressable accessibilityRole="button" accessibilityLabel={`Add a set of ${name.toLowerCase()}`} onPress={() => addSet(r)} style={styles.addSet}>
                <PlusIcon color={colors.text} size={20} />
                <Text variant="bodyStrong">Add set</Text>
              </Pressable>
              {bodyweight ? (
                <Text variant="small" color="textFaint" style={styles.editBodyweight}>
                  This counts your bodyweight that day, {formatWeight(fromKg(detail.bodyweight_kg, unit))} {unit}, plus the added weight.
                </Text>
              ) : null}
            </View>
          );
        })}

        {error ? (
          <View style={styles.error}>
            <Notice message={error} />
          </View>
        ) : null}

        <View style={styles.deleteWorkout}>
          <Button title="Delete workout" variant="secondary" onPress={props.onDelete} />
        </View>
        <Text variant="small" color="textFaint" style={styles.deleteNote}>
          Removes it from your history and progress.
        </Text>
      </ScrollView>

      <BottomSheet visible={props.deleting} onClose={props.onDeleteClose} accessibilityLabel="Delete workout">
        <View style={styles.sheet}>
          <Text variant="h2">Delete this workout?</Text>
          <Text variant="small" color="textMuted" style={styles.sheetNote}>
            {detail.title} on {dayText(new Date(detail.started_at))} comes off your history and progress. This can’t be undone.
          </Text>
          <View style={styles.sheetActions}>
            <Button title="Delete workout" onPress={props.onDeleteConfirm} />
            <Button title="Keep it" variant="text" onPress={props.onDeleteClose} />
          </View>
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.gutter },
  flex: { flex: 1, minWidth: 0 },
  message: { marginTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editPill: {
    height: 44,
    paddingLeft: 14,
    paddingRight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  editPillPressed: { backgroundColor: colors.surfaceRaised },
  title: { marginTop: 22 },
  when: { marginTop: 6 },
  stats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, gap: 6 },
  statWide: { flex: 1.4 },
  statRule: { width: 1, backgroundColor: colors.line },
  statValue: { ...figure(figures.summaryStat), color: colors.text },
  card: {
    marginTop: 12,
    paddingTop: 14,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  estMax: { alignItems: 'flex-end' },
  estMaxValue: { ...figure(figures.pastEstMax), color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, marginTop: 12 },
  tile: {
    height: 58,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 9,
    justifyContent: 'space-between',
    borderRadius: radius.setRow,
    backgroundColor: colors.surfaceRaised,
  },
  // The best set: an inset ring, so the tile keeps its size.
  tileBest: { borderWidth: 1, borderColor: colors.ring, paddingTop: 7, paddingHorizontal: 9, paddingBottom: 8 },
  tileValue: { flexDirection: 'row', alignItems: 'baseline' },
  tileNumber: { ...figure(figures.pastSet), color: colors.text },
  tileTimes: { ...figureTimes(15, figures.pastSet), color: colors.textMuted, marginHorizontal: 1 },
  footnote: { marginTop: 14, marginHorizontal: 4 },
  editHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savePill: {
    height: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.accent,
  },
  savePillPressed: { backgroundColor: colors.accentPressed },
  editNote: { marginTop: 14, marginHorizontal: 2 },
  editCard: {
    marginTop: 12,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  editName: { paddingHorizontal: 4 },
  editGrid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editLabels: { paddingTop: 12, paddingBottom: 6, paddingHorizontal: 4 },
  editRow: { height: 58, paddingLeft: 4 },
  editSetCol: { width: 34 },
  editValueCol: { flex: 1, minWidth: 0, width: 0 },
  editDeleteCol: { width: 40 },
  editSetNumber: { ...figure(figures.editSetNumber), color: colors.textFaint },
  field: {
    ...figure(figures.editValue),
    height: 46,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.setRow,
    backgroundColor: colors.inset,
    color: colors.text,
  },
  fieldFocused: { borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: 11.5 },
  delete: { height: 40, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
  deletePressed: { backgroundColor: colors.surfaceRaised },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 6 },
  editBodyweight: { marginHorizontal: 6, marginBottom: 10 },
  error: { marginTop: 16 },
  deleteWorkout: { marginTop: 22 },
  deleteNote: { marginTop: 10, marginHorizontal: 4, textAlign: 'center' },
  sheet: { paddingHorizontal: 6 },
  sheetNote: { marginTop: 6 },
  sheetActions: { marginTop: 22, gap: 6 },
});
