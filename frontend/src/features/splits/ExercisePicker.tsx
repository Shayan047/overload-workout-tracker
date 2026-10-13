import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useCreateExercise, useExercises } from '@/api/splits';
import {
  BottomSheet,
  Button,
  Chip,
  IconButton,
  ListRow,
  Notice,
  Switch,
  Text,
  TextField,
  useFrameInsets,
} from '@/components';
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from '@/components/icons';
import { type Exercise, exerciseSubtitle, muscleLabel, MUSCLES, searchExercises } from '@/lib/exercises';
import { colors, type } from '@/theme';

// The filter chips (06), plus Core.
export const GROUPS = [
  { value: null, label: 'All' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
] as const;

function countLine(count: number, query: string): string {
  const noun = count === 1 ? 'exercise' : 'exercises';
  return query.trim() ? `${count} ${noun} match “${query.trim()}”` : `${count} ${noun}`;
}

function ResultRow({
  exercise,
  taken,
  takenLabel,
  single,
  selected,
  onToggle,
}: {
  exercise: Exercise;
  taken: boolean;
  takenLabel: string;
  single: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.result}>
      <View style={styles.resultText}>
        <Text style={styles.resultName}>{exercise.name}</Text>
        <Text variant="small" color="textMuted">
          {exerciseSubtitle(exercise)}
        </Text>
      </View>
      {taken ? (
        <Text variant="small" color="textFaint" style={styles.inDay}>
          {takenLabel}
        </Text>
      ) : (
        <Pressable
          accessibilityRole={single ? 'radio' : 'checkbox'}
          accessibilityState={{ checked: selected }}
          accessibilityLabel={selected ? `${exercise.name} selected` : `Select ${exercise.name}`}
          onPress={onToggle}
          style={styles.pick}
        >
          <View style={[styles.ring, selected && styles.ringOn]}>
            {selected ? (
              <CheckIcon color={colors.bg} size={16} strokeWidth={2.6} />
            ) : (
              <PlusIcon color={colors.textSecondary} size={16} strokeWidth={2.2} />
            )}
          </View>
        </Pressable>
      )}
    </View>
  );
}

/** "Can't find it? Create a custom exercise". */
function CustomExerciseSheet({
  visible,
  initialName,
  onClose,
  onCreated,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const createExercise = useCreateExercise();
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [bodyweight, setBodyweight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return setError('Give the exercise a name.');
    if (!muscle) return setError('Pick the muscle it works most.');
    const exercise = await createExercise({
      name,
      primary_muscle: muscle,
      kind: bodyweight ? 'bodyweight' : 'weighted',
    });
    onCreated(exercise);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Create a custom exercise">
      <ScrollView style={styles.customSheet} keyboardShouldPersistTaps="handled">
        <TextField label="Name" value={name} onChangeText={setName} returnKeyType="done" />
        <Text variant="label" color="textMuted" style={styles.sheetLabel}>
          Muscle it works most
        </Text>
        <View style={styles.muscleChips}>
          {MUSCLES.map((m) => (
            <Chip key={m} label={muscleLabel(m)} selected={muscle === m} onPress={() => setMuscle(m)} />
          ))}
        </View>
        <ListRow
          style={styles.bodyweightRow}
          label="Bodyweight exercise"
          trailing={
            <Switch accessibilityLabel="Bodyweight exercise" value={bodyweight} onValueChange={setBodyweight} />
          }
        />
        {error ? <Notice message={error} /> : null}
        <View style={styles.sheetActions}>
          <Button title="Create exercise" size="medium" onPress={create} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

export type PickerProps = {
  title: string;
  /** Exercises already in the list, shown with `takenLabel` instead of a pick button. */
  taken: ReadonlySet<string>;
  takenLabel: string;
  /** Pick exactly one (swap) instead of several. */
  single?: boolean;
  initial?: { query?: string; group?: string | null; selected?: string[] };
  /** The button label for the current picks. */
  confirmTitle: (picked: Exercise[]) => string;
  onConfirm: (exerciseIds: string[]) => void;
};

/** Search the library and pick exercises (06): several for a split day or for today, or
 * one to swap in. */
export function ExercisePicker({ title, taken, takenLabel, single = false, initial, confirmTitle, onConfirm }: PickerProps) {
  const { top, bottom } = useFrameInsets();
  const exercises = useExercises();
  const [query, setQuery] = useState(initial?.query ?? '');
  const [group, setGroup] = useState<string | null>(initial?.group ?? null);
  const [selected, setSelected] = useState<string[]>(initial?.selected ?? []);
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);

  const results = useMemo(
    () => searchExercises(exercises.data ?? [], query, group),
    [exercises.data, query, group],
  );

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : single ? [id] : [...current, id],
    );
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const picked = selected.map((id) => byId.get(id)).filter((e): e is Exercise => !!e);

  return (
    <View style={[styles.screen, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Close" onPress={() => router.back()}>
          <CloseIcon color={colors.text} />
        </IconButton>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>

      <View style={styles.search}>
        <View style={styles.searchIcon} pointerEvents="none">
          <SearchIcon color={colors.textFaint} />
        </View>
        <TextInput
          accessibilityLabel="Search exercises"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[styles.searchInput, (focused || !!query) && styles.searchActive]}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}>
            <CloseIcon color={colors.textMuted} size={18} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroller}
        contentContainerStyle={styles.chips}
      >
        {GROUPS.map((g) => (
          <Chip key={g.label} label={g.label} selected={group === g.value} onPress={() => setGroup(g.value)} />
        ))}
      </ScrollView>

      <Text variant="small" color="textFaint" style={styles.count}>
        {exercises.isPending && !exercises.data ? 'Loading exercises…' : countLine(results.length, query)}
      </Text>

      <View style={styles.listArea}>
        <View style={styles.card}>
          <FlatList
            data={results}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <ResultRow
                exercise={item}
                taken={taken.has(item.id)}
                takenLabel={takenLabel}
                single={single}
                selected={selected.includes(item.id)}
                onToggle={() => toggle(item.id)}
              />
            )}
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.custom}>
          <PlusIcon color={colors.accent} size={20} />
          <Text style={styles.customLabel}>Can&apos;t find it? Create a custom exercise</Text>
        </Pressable>
      </View>

      <Button
        title={confirmTitle(picked)}
        size="medium"
        disabled={!picked.length}
        onPress={() => onConfirm(picked.map((e) => e.id))}
      />

      {creating ? (
        <CustomExerciseSheet
          visible={creating}
          initialName={query.trim()}
          onClose={() => setCreating(false)}
          onCreated={(exercise) => {
            setCreating(false);
            setQuery(exercise.name);
            setGroup(null);
            setSelected((current) => (single ? [exercise.id] : [...current, exercise.id]));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...type.h1Small, color: colors.text },
  search: { marginTop: 18, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, top: 15, zIndex: 1 },
  searchInput: {
    ...type.search,
    height: 52,
    paddingLeft: 46,
    paddingRight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  searchActive: { borderColor: colors.text },
  clear: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsScroller: { marginTop: 14, marginHorizontal: -20, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20 },
  count: { marginTop: 16, marginBottom: 8, marginHorizontal: 4 },
  listArea: { flex: 1 },
  card: { flexShrink: 1, paddingVertical: 2, borderRadius: 20, backgroundColor: colors.surface, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56, paddingLeft: 16, paddingRight: 4 },
  resultText: { flex: 1 },
  resultName: { ...type.rowTitle, color: colors.text },
  inDay: { paddingRight: 12 },
  pick: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { backgroundColor: colors.text, borderColor: colors.text },
  separator: { height: 1, marginLeft: 16, backgroundColor: colors.line },
  custom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 4 },
  customLabel: { ...type.buttonSecondary, color: colors.text },
  customSheet: { maxHeight: 560, paddingHorizontal: 6 },
  sheetLabel: { marginTop: 18, marginBottom: 8 },
  muscleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bodyweightRow: { marginTop: 12, paddingHorizontal: 0 },
  sheetActions: { marginTop: 16, marginBottom: 6 },
});
