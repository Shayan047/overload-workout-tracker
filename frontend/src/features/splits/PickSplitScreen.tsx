import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { usePresets } from '@/api/splits';
import { IconButton, Notice, Tag, Text, useFrameInsets } from '@/components';
import { BackIcon, ChevronRightIcon, PlusIcon } from '@/components/icons';
import { newId } from '@/lib/ids';
import { colors, type } from '@/theme';

import { draftFromPreset, newDraft, type Preset, WEEKDAYS_SHORT } from './draft';
import { draftStore } from './draftStore';

type Props = {
  /** Onboarding shows "Step 2 of 2"; the app version (switching splits) doesn't. */
  mode: 'onboarding' | 'app';
};

function PresetCard({ preset, onPress }: { preset: Preset; onPress: () => void }) {
  const dayLabels = preset.days.map((day) =>
    preset.repeat_mode === 'weekdays' && day.weekday !== null ? WEEKDAYS_SHORT[day.weekday] : day.name,
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${preset.name}, ${preset.summary}: ${dayLabels.join(', ')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{preset.name}</Text>
          <Text variant="small" color="textFaint">
            {preset.summary}
          </Text>
        </View>
        <View style={styles.dayRow}>
          {dayLabels.map((label, i) => (
            <Tag key={`${label}-${i}`} label={label} size="day" />
          ))}
        </View>
      </View>
      <ChevronRightIcon color={colors.textFaint} />
    </Pressable>
  );
}

/** Pick a split (03): a preset or "Build my own", then Edit split (04). */
export function PickSplitScreen({ mode }: Props) {
  const { top, bottom } = useFrameInsets();
  const presets = usePresets();

  const open = (draftOf: () => Parameters<typeof draftStore.start>[0]) => {
    draftStore.start(draftOf(), null);
    router.push({ pathname: '/edit-split', params: { mode } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}
    >
      <View style={styles.header}>
        {mode === 'onboarding' || router.canGoBack() ? (
          <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
            <BackIcon color={colors.text} />
          </IconButton>
        ) : (
          <View />
        )}
        {mode === 'onboarding' ? (
          <Text variant="small" color="textFaint">
            Step 2 of 2
          </Text>
        ) : null}
      </View>

      <View style={styles.intro}>
        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          Pick a split
        </Text>
        <Text variant="lead" color="textMuted" style={styles.subtitle}>
          Start from a common split or build your own. You can rename days and change exercises after.
        </Text>
      </View>

      <View style={styles.list}>
        {presets.data?.map((preset) => (
          <PresetCard key={preset.key} preset={preset} onPress={() => open(() => draftFromPreset(preset, newId()))} />
        ))}
        {presets.isError && !presets.data ? (
          <Notice message="Can’t load the common splits right now. Check your connection, or build your own." />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Build my own. Name your days and pick exercises"
          onPress={() => open(() => newDraft(newId))}
          style={({ pressed }) => [styles.card, styles.buildOwn, pressed && styles.cardPressed]}
        >
          <View style={styles.plus}>
            <PlusIcon color={colors.onAccent} size={20} strokeWidth={2.2} />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Build my own</Text>
            <Text variant="small" color="textMuted" style={styles.buildOwnNote}>
              Name your days and pick exercises
            </Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    minHeight: 44,
  },
  intro: { paddingHorizontal: 4 },
  title: { marginTop: 24 },
  subtitle: { marginTop: 10, marginBottom: 22, maxWidth: 330 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 18,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  cardPressed: { backgroundColor: colors.surfaceHover },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { ...type.cardTitle, color: colors.text },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  buildOwn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    paddingVertical: 16,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  buildOwnNote: { marginTop: 2 },
});
