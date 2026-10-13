import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/AppProviders';
import { useSaveSplit } from '@/api/splits';
import {
  Button,
  DashedButton,
  IconButton,
  Notice,
  ReorderableList,
  SegmentedControl,
  Text,
  TextField,
  useFrameInsets,
} from '@/components';
import { BackIcon, SplitsIcon } from '@/components/icons';
import { colors, figure, figures, type } from '@/theme';

import {
  addDay,
  type DraftDay,
  moveDay,
  type RepeatMode,
  renameSplit,
  setRepeatMode,
  validateDraft,
  WEEKDAYS_SHORT,
} from './draft';
import { draftStore, useDraft } from './draftStore';
import { newId } from '@/lib/ids';

const REPEAT_OPTIONS = [
  { value: 'in_order', label: 'In order' },
  { value: 'weekdays', label: 'Set weekdays' },
] as const;

const REPEAT_NOTES: Record<RepeatMode, string> = {
  in_order: "Train the next day whenever you're ready. Rest days never shift your split.",
  weekdays: 'Each day has its own weekday. Any other day is a rest day.',
};

export type EditSplitMode = 'onboarding' | 'app' | 'tab';

const exerciseCount = (n: number) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`;

/** Edit split (04). `tab` is the Splits tab: no back button, a way to pick another split. */
export function EditSplitScreen({ mode }: { mode: EditSplitMode }) {
  const { top, bottom } = useFrameInsets();
  const { signedIn } = useAuth();
  const saveSplit = useSaveSplit();
  const state = useDraft();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!state) return <View style={styles.screen} />;
  const { draft, original } = state;
  const inOrder = draft.repeatMode === 'in_order';

  const save = async () => {
    const problem = validateDraft(draft);
    if (problem) return setError(problem);
    setError(null);
    setSaving(true);
    await saveSplit(original, draft);
    draftStore.saved();
    setSaving(false);
    if (!signedIn) {
      // Onboarding ends by creating the account; the split goes out right after.
      router.push('/sign-up');
      return;
    }
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  };

  const dayRow = (day: DraftDay, index: number, handle: ReactNode) => {
    const detail = exerciseCount(day.exercises.length);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Day ${index + 1}, ${day.name}, ${detail}`}
        onPress={() => router.push({ pathname: '/edit-day/[dayId]', params: { dayId: day.id } })}
        style={({ pressed }) => [styles.dayRow, pressed && styles.dayPressed]}
      >
        <View style={styles.step}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
        </View>
        <View style={styles.dayText}>
          <Text style={styles.dayName}>{day.name || 'Untitled day'}</Text>
          <Text variant="smallInBody" color="textMuted">
            {!inOrder && day.weekday !== null ? `${WEEKDAYS_SHORT[day.weekday]} · ${detail}` : detail}
          </Text>
        </View>
        {handle}
      </Pressable>
    );
  };

  const first = draft.days[0];
  const last = draft.days[draft.days.length - 1];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}
      >
        <View style={styles.header}>
          {mode !== 'tab' ? (
            <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
              <BackIcon color={colors.text} />
            </IconButton>
          ) : null}
          <Text style={styles.title} accessibilityRole="header">
            Edit split
          </Text>
          {mode === 'tab' ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push({ pathname: '/pick-split', params: { mode: 'app' } })}
            >
              <Text style={styles.switchLink}>Pick another</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.nameField}>
          <TextField
            label="Split name"
            value={draft.name}
            onChangeText={(name) => draftStore.update((d) => renameSplit(d, name))}
            returnKeyType="done"
          />
        </View>

        <View style={styles.repeat}>
          <Text variant="label" color="textMuted" style={styles.label}>
            How days repeat
          </Text>
          <SegmentedControl
            accessibilityLabel="How days repeat"
            options={REPEAT_OPTIONS}
            value={draft.repeatMode}
            onChange={(value) => draftStore.update((d) => setRepeatMode(d, value))}
            tone="light"
            height={44}
          />
          <Text variant="note" color="textMuted" style={styles.repeatNote}>
            {REPEAT_NOTES[draft.repeatMode]}
          </Text>
        </View>

        <View style={styles.daysHeader}>
          <Text variant="label" color="textMuted">
            Days
          </Text>
          <Text variant="small" color="textFaint">
            Drag to reorder
          </Text>
        </View>
        <View style={styles.days}>
          <ReorderableList
            items={draft.days}
            keyOf={(day) => day.id}
            handleLabel={(day) => `Reorder ${day.name}`}
            separator={<View style={styles.separator} />}
            onReorder={(from, to) => draftStore.update((d) => moveDay(d, from, to))}
            renderItem={dayRow}
          />
        </View>

        {inOrder && draft.days.length > 1 ? (
          <View style={styles.rotation}>
            <SplitsIcon color={colors.ghost} size={18} />
            <Text variant="small" color="textMuted" style={styles.rotationText}>
              After {last.name}, you start again at {first.name}.
            </Text>
          </View>
        ) : null}

        <View style={styles.addDay}>
          <DashedButton label="Add a day" onPress={() => draftStore.update((d) => addDay(d, newId))} />
        </View>

        {error ? (
          <View style={styles.error}>
            <Notice message={error} />
          </View>
        ) : null}

        <View style={styles.spacer} />
        <Button title="Save split" size="medium" onPress={save} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  title: { ...type.h1Small, color: colors.text, flex: 1 },
  switchLink: { ...type.buttonSecondary, color: colors.textSecondary },
  nameField: { marginTop: 26 },
  repeat: { marginTop: 22 },
  label: { marginBottom: 8 },
  repeatNote: { marginTop: 10, marginHorizontal: 2 },
  daysHeader: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  days: {
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  dayPressed: { backgroundColor: colors.surfaceHover },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { ...figure(figures.dayStep), color: colors.text },
  dayText: { flex: 1 },
  dayName: { ...type.cardTitle, color: colors.text },
  separator: { height: 1, marginLeft: 60, backgroundColor: colors.line },
  rotation: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginHorizontal: 4 },
  rotationText: { flex: 1 },
  addDay: { marginTop: 16 },
  error: { marginTop: 16 },
  spacer: { flexGrow: 1, minHeight: 12 },
});
