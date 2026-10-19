import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useSettings } from '@/api/settings';
import { treeFromDraft, useExercises, useSplitTree } from '@/api/splits';
import { type ProgressItem, PROGRESS_WEEKS, useProgress } from '@/api/stats';
import { Chip, Separator, Text, useFrameInsets } from '@/components';
import { ArrowRightIcon } from '@/components/icons';
import { equipmentLabel } from '@/lib/exercises';
import { isReviewMode, now } from '@/review/reviewMode';
import { sampleSplitDraft } from '@/review/sampleData';
import { colors, figure, figures, radius } from '@/theme';

import { sparkline } from './chart';
import { changeText, estMaxText, orderProgress, progressSubtitle, statusOf } from './progressText';

function Sparkline({ item }: { item: ProgressItem }) {
  const { path, end } = sparkline(item.sparkline);
  return (
    <Svg width={84} height={32} viewBox="0 0 84 32">
      {path ? (
        <Path d={path} fill="none" stroke={colors.ghost} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      <Circle cx={end.x} cy={end.y} r={3} fill={colors.accent} />
    </Svg>
  );
}

/** Progress (13): every lift's est. max over the last 8 weeks, new bests and plateaus first.
 * From the stats API, and from the cache when offline. */
export function ProgressScreen() {
  const { top } = useFrameInsets();
  const today = now();
  const progress = useProgress();
  const exercises = useExercises();
  const settings = useSettings();
  const tree = useSplitTree(settings.data?.active_split_id);
  const split = isReviewMode ? treeFromDraft(sampleSplitDraft) : tree.data;
  const [dayId, setDayId] = useState<string | null>(null);

  const unit = settings.data?.unit ?? 'lb';
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const items = progress.data ?? [];
  const day = split?.days.find((d) => d.id === dayId);
  const inDay = day ? new Set(day.exercises.map((e) => e.exercise_id)) : null;
  const shown = orderProgress(inDay ? items.filter((i) => inDay.has(i.exercise_id)) : items, today);

  const body = () => {
    if (progress.isPending && !progress.data) {
      return (
        <Text color="textMuted" style={styles.empty}>
          Loading your progress…
        </Text>
      );
    }
    if (progress.isError && !progress.data) {
      return (
        <Text color="textMuted" style={styles.empty}>
          Progress needs a connection the first time. It's saved on this phone after that.
        </Text>
      );
    }
    if (!shown.length) {
      return (
        <Text color="textMuted" style={styles.empty}>
          {day ? `Nothing from ${day.name} yet.` : 'Your lifts show up here after your first workout.'}
        </Text>
      );
    }
    return (
      <View style={styles.list}>
        {shown.map((item, i) => {
          const exercise = byId.get(item.exercise_id);
          const name = exercise?.name ?? 'Exercise';
          const status = statusOf(item, today);
          return (
            <View key={item.exercise_id}>
              {i > 0 ? <Separator inset={16} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${name}, est. max ${estMaxText(item.est_max_kg, unit)} ${unit}, ${changeText(item.change)}`}
                onPress={() => router.push({ pathname: '/exercise/[exerciseId]', params: { exerciseId: item.exercise_id } })}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.name}>
                  <Text variant="rowTitle" numberOfLines={1}>
                    {name}
                  </Text>
                  {status.kind === 'best' ? (
                    <Text variant="labelInBody" color="accent">
                      {status.text}
                    </Text>
                  ) : status.kind === 'plateau' ? (
                    <View style={styles.flat}>
                      <ArrowRightIcon color={colors.ghost} size={14} />
                      <Text variant="labelInBody" color="ghost">
                        {status.text}
                      </Text>
                    </View>
                  ) : (
                    <Text variant="smallInBody" color="textMuted" numberOfLines={1}>
                      {item.includes_bodyweight ? 'Includes bodyweight' : (equipmentLabel(exercise?.equipment ?? null) ?? ' ')}
                    </Text>
                  )}
                </View>
                <Sparkline item={item} />
                <View style={styles.value}>
                  <Text style={styles.estMax}>{estMaxText(item.est_max_kg, unit)}</Text>
                  <Text variant="small" color="textFaint">
                    {changeText(item.change)}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top + 8 }]}>
      <Text variant="pageTitle" accessibilityRole="header" style={styles.title}>
        Progress
      </Text>
      <Text color="textMuted" style={styles.subtitle}>
        {progress.data ? progressSubtitle(items, today) : ' '}
      </Text>

      {split?.days.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroller} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={!dayId} onPress={() => setDayId(null)} />
          {split.days.map((d) => (
            <Chip key={d.id} label={d.name} selected={d.id === dayId} onPress={() => setDayId(d.id)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.headings}>
        <Text variant="label" color="textFaint">
          Last {PROGRESS_WEEKS} weeks
        </Text>
        <Text variant="label" color="textFaint">
          Est. max, {unit}
        </Text>
      </View>

      {body()}

      <Text variant="small" color="textFaint" style={styles.footnote}>
        Est. max is the most you could lift once, estimated from your best set: weight × (1 + reps ÷ 30).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { marginTop: 4 },
  subtitle: { marginTop: 8 },
  chipsScroller: { marginTop: 18, marginHorizontal: -20, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20 },
  headings: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginHorizontal: 4, marginBottom: 8 },
  list: { paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 64, paddingHorizontal: 16 },
  pressed: { backgroundColor: colors.surfaceHover },
  name: { flex: 1, minWidth: 0 },
  flat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { width: 64, alignItems: 'flex-end' },
  estMax: { ...figure(figures.progressValue), color: colors.text },
  empty: { marginTop: 8, marginHorizontal: 4 },
  footnote: { marginTop: 14, marginHorizontal: 4 },
});
