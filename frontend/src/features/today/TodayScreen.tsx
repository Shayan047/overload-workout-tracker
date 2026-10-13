import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSettings } from '@/api/settings';
import { treeFromDraft, useExercises, useSplitTree } from '@/api/splits';
import { useLastSessions, useWorkouts } from '@/api/workouts';
import { BottomSheet, Button, IconButton, ListRow, Separator, SyncStatusPill, Text, useFrameInsets } from '@/components';
import { CheckIcon, GhostIcon, PersonIcon, PlayIcon } from '@/components/icons';
import type { SplitTree } from '@/features/splits/draft';
import { localDate } from '@/lib/dates';
import { isReviewMode, now } from '@/review/reviewMode';
import { sampleSplitDraft } from '@/review/sampleData';
import { colors, figure, figures } from '@/theme';

import { useTodayOverride, todayOverride } from './overrideStore';
import { bestSetText, dateHeading, relativeDay, type StripItem, todayPlan } from './today';

const exerciseCount = (n: number) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`;

function Strip({ items }: { items: StripItem[] }) {
  return (
    <View style={styles.strip} accessibilityRole="list" accessibilityLabel="Split rotation">
      {items.map((item) => (
        <View
          key={`${item.role}-${item.dayId}`}
          style={{ flex: item.role === 'today' ? 1.25 : 1 }}
          accessible
          accessibilityLabel={`${item.name}, ${item.label}${item.done ? ', done' : ''}`}
        >
          <View style={[styles.bar, { backgroundColor: barColors[item.role] }]} />
          <View style={styles.stripName}>
            {item.done ? <CheckIcon color={colors.text} size={14} strokeWidth={2.4} /> : null}
            <Text
              variant={item.role === 'today' ? 'labelHeavy' : 'label'}
              color={item.role === 'today' ? 'accent' : item.role === 'previous' ? 'text' : 'textMuted'}
              numberOfLines={1}
              style={styles.stripText}
            >
              {item.name}
            </Text>
          </View>
          <Text variant="small" color="textFaint">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const barColors = {
  previous: colors.textSecondary,
  today: colors.accent,
  next: colors.gridline,
};

/** Pick another day of the split for today only. */
function DaySheet({
  split,
  visible,
  currentId,
  onClose,
  onPick,
}: {
  split: SplitTree;
  visible: boolean;
  currentId: string | null;
  onClose: () => void;
  onPick: (dayId: string) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel="Do a different day">
      <View style={styles.sheet}>
        <Text variant="h2">Train a different day</Text>
        <Text variant="small" color="textMuted" style={styles.sheetNote}>
          Just for today. Your split stays as it is.
        </Text>
        <View style={styles.sheetList}>
          {split.days.map((day, i) => (
            <View key={day.id}>
              {i > 0 ? <Separator /> : null}
              <ListRow
                accessibilityLabel={`${day.name}, ${exerciseCount(day.exercises.length)}`}
                onPress={() => onPick(day.id)}
                label={
                  <View style={styles.sheetDay}>
                    <Text variant="rowTitle" color={day.id === currentId ? 'accent' : 'text'}>
                      {day.name}
                    </Text>
                    <Text variant="small" color="textMuted">
                      {exerciseCount(day.exercises.length)}
                    </Text>
                  </View>
                }
                trailing={day.id === currentId ? <CheckIcon color={colors.accent} size={18} /> : null}
              />
            </View>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

/** Today (07): the next day of the active split, its exercises with last time's best set,
 * and Start workout. Everything comes from the cache, so it works offline. */
export function TodayScreen() {
  const { top } = useFrameInsets();
  const today = now();
  const settings = useSettings();
  const tree = useSplitTree(settings.data?.active_split_id);
  const split: SplitTree | undefined = isReviewMode ? treeFromDraft(sampleSplitDraft) : tree.data;
  const workouts = useWorkouts();
  const exercises = useExercises();
  const override = useTodayOverride(localDate(today));
  const [picking, setPicking] = useState(false);

  const plan = split ? todayPlan(split, workouts.data ?? [], today, override) : null;
  const day = plan?.kind === 'train' ? plan.day : null;
  const lastSessions = useLastSessions(day?.exercises.map((e) => e.exercise_id) ?? []);

  const unit = settings.data?.unit ?? 'lb';
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const lastByExercise = new Map((lastSessions.data ?? []).map((s) => [s.exercise_id, s]));
  const latestLastTime = [...lastByExercise.values()]
    .map((s) => new Date(s.ended_at))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const header = (
    <View style={styles.header}>
      <Text variant="bodyStrong" color="textMuted">
        {dateHeading(today)}
      </Text>
      <View style={styles.headerRight}>
        <SyncStatusPill />
        <IconButton accessibilityLabel="Profile" onPress={() => router.push('/profile')}>
          <PersonIcon color={colors.text} />
        </IconButton>
      </View>
    </View>
  );

  const body = () => {
    if (!settings.data?.active_split_id && !isReviewMode) {
      return (
        <>
          <Text variant="dayTitle" accessibilityRole="header" style={styles.title}>
            No split yet
          </Text>
          <Text color="textMuted" style={styles.subtitle}>
            Pick a split to see what to train each day.
          </Text>
          <View style={styles.actions}>
            <Button title="Pick a split" onPress={() => router.push({ pathname: '/pick-split', params: { mode: 'app' } })} />
          </View>
        </>
      );
    }
    if (!split || !plan) return null; // first load, nothing cached yet
    if (plan.kind === 'empty') {
      return (
        <>
          <Text variant="dayTitle" accessibilityRole="header" style={styles.title}>
            No days yet
          </Text>
          <Text color="textMuted" style={styles.subtitle}>
            Add a day to your {split.name} on the Splits tab.
          </Text>
        </>
      );
    }
    if (plan.kind === 'rest') {
      return (
        <>
          <Text variant="dayTitle" accessibilityRole="header" style={styles.title}>
            Rest day
          </Text>
          <Text color="textMuted" style={styles.subtitle}>
            {plan.next ? `Next: ${plan.next.name}, ${plan.next.label === 'Tomorrow' ? 'tomorrow' : plan.next.label}.` : 'No days are set to a weekday yet.'}
          </Text>
          <View style={styles.actions}>
            <Button title="Train anyway" variant="secondary" onPress={() => setPicking(true)} />
          </View>
        </>
      );
    }

    const rows = plan.day.exercises;
    return (
      <>
        <Text variant="dayTitle" accessibilityRole="header" style={styles.title}>
          {plan.day.name}
        </Text>
        <Text color="textMuted" style={styles.subtitle}>
          Day {plan.position} of your {split.name}
        </Text>
        <Strip items={plan.strip} />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text variant="label" color="textMuted">
              {exerciseCount(rows.length)}
            </Text>
            {latestLastTime ? (
              <View style={styles.lastTime}>
                <GhostIcon color={colors.ghost} size={15} />
                <Text variant="small" color="ghost">
                  Best set last time, {relativeDay(latestLastTime, today)}
                </Text>
              </View>
            ) : null}
          </View>
          {rows.map((row) => {
            const exercise = byId.get(row.exercise_id);
            const last = lastByExercise.get(row.exercise_id);
            const best = last
              ? bestSetText(last.sets, {
                  unit,
                  bodyweightKg: last.bodyweight_kg,
                  bodyweight: exercise?.kind === 'bodyweight',
                })
              : null;
            return (
              <View key={row.id}>
                <Separator />
                <View style={styles.row}>
                  <Text numberOfLines={1} style={styles.rowName}>
                    {exercise?.name ?? 'Exercise'}
                  </Text>
                  {best ? <Text style={styles.best}>{best}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.start}>
          <Button
            title="Start workout"
            icon={<PlayIcon color={colors.onAccent} />}
            onPress={() => router.push({ pathname: '/workout', params: { dayId: plan.day.id } })}
          />
        </View>
        <Button title="Do a different day" variant="text" onPress={() => setPicking(true)} />
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8 }]}>
        {header}
        {body()}
      </ScrollView>
      {split ? (
        <DaySheet
          split={split}
          visible={picking}
          currentId={day?.id ?? null}
          onClose={() => setPicking(false)}
          onPick={(dayId) => {
            todayOverride.set(localDate(today), dayId);
            setPicking(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { marginTop: 22 },
  subtitle: { marginTop: 6 },
  strip: { flexDirection: 'row', gap: 6, marginTop: 20 },
  bar: { height: 4, borderRadius: 4 },
  stripName: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  stripText: { flexShrink: 1 },
  card: { marginTop: 22, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface },
  cardHeader: {
    height: 40,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastTime: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  row: {
    height: 44,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowName: { flexShrink: 1 },
  best: { ...figure(figures.lastTime), color: colors.ghost },
  start: { marginTop: 18, marginBottom: 4 },
  actions: { marginTop: 28 },
  sheet: { paddingHorizontal: 6 },
  sheetNote: { marginTop: 4 },
  sheetList: { marginTop: 14, borderRadius: 20, backgroundColor: colors.surfaceRaised },
  sheetDay: { paddingVertical: 10 },
});
