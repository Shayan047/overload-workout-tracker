import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { useExerciseStats } from '@/api/stats';
import { IconButton, Text, useFrameInsets } from '@/components';
import { BackIcon } from '@/components/icons';
import { now } from '@/review/reviewMode';
import { colors, figure, figures, radius } from '@/theme';

import { estMaxText, sessionSets, sessionTitle, whenText } from './progressText';
import { LINES, type LinesFrame, sessionLines } from './sessionLines';
import { LineKey, SessionLinesChart } from './SessionLinesChart';

/** 23's chart: as 14's, but taller. */
const TALL: LinesFrame = { ...LINES, height: 306, top: 16, bottom: 276 };

/** All workouts (23): every session's est. max per set, one line each. Today is amber; the
 * further back, the fainter. Tapping a session picks out its line. `pick` opens with one
 * picked. */
export function AllWorkoutsScreen() {
  const { exerciseId, pick } = useLocalSearchParams<{ exerciseId: string; pick?: string }>();
  const { top, bottom } = useFrameInsets();
  const today = now();
  const stats = useExerciseStats(exerciseId);
  const exercises = useExercises();
  const settings = useSettings();
  const [picked, setPicked] = useState<string | null>(pick ?? null);

  const unit = settings.data?.unit ?? 'lb';
  const exercise = exercises.data?.find((e) => e.id === exerciseId);
  const name = exercise?.name ?? 'Exercise';
  const data = stats.data;
  const bodyweight = data?.includes_bodyweight ?? exercise?.kind === 'bodyweight';
  const series = data?.series ?? [];

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/exercise/[exerciseId]', params: { exerciseId } });
  };

  const content = () => {
    if (!series.length) {
      return (
        <Text color="textMuted" style={styles.message}>
          {stats.isError ? 'This needs a connection the first time. It’s saved on this phone after that.' : data ? 'No workouts yet.' : 'Loading…'}
        </Text>
      );
    }
    const chart = sessionLines(series, unit, TALL, bodyweight);
    const newest = [...series].reverse();
    const pickedSession = series.find((s) => s.workout_id === picked);
    const description =
      `Estimated max per set for all ${series.length} ${name.toLowerCase()} workouts. Today's in amber.` +
      (pickedSession ? ` ${sessionTitle(pickedSession.at, today)} picked out: ${sessionSets(pickedSession.sets, unit, bodyweight)}.` : '');
    return (
      <>
        <Text color="textMuted" style={styles.intro}>
          Estimated max for every set. Today is amber; the further back a workout, the fainter its line.
        </Text>
        <View style={styles.chartCard}>
          <SessionLinesChart chart={chart} frame={TALL} mode="all" pickedId={picked} description={description} />
        </View>
        <Text variant="small" color="textFaint" style={styles.tip}>
          Tap a workout to pick out its line. Tap it again to let it go.
        </Text>
        <View style={styles.list}>
          {newest.map((s, age) => {
            const on = s.workout_id === picked;
            return (
              <Pressable
                key={s.workout_id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${sessionTitle(s.at, today)}, ${sessionSets(s.sets, unit, bodyweight)}, est. max ${estMaxText(s.est_max_kg, unit)}`}
                onPress={() => setPicked(on ? null : s.workout_id)}
                style={({ pressed }) => [styles.row, (on || pressed) && styles.rowOn]}
              >
                <LineKey age={age} mode="all" picked={on} />
                <View style={styles.flex}>
                  <Text variant="rowTitle">{sessionTitle(s.at, today)}</Text>
                  <Text variant="small" color="textMuted">
                    {sessionSets(s.sets, unit, bodyweight)}
                  </Text>
                </View>
                <Text style={[styles.value, age === 0 && whenText(s.at, today) === 'today' && styles.today]}>
                  {estMaxText(s.est_max_kg, unit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel={`Back to ${name.toLowerCase()}`} onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <View style={styles.flex}>
            <Text variant="label" color="textMuted" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="h1Small" accessibilityRole="header" style={styles.title}>
              {series.length ? `All ${series.length} workouts` : 'All workouts'}
            </Text>
          </View>
        </View>
        {content()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { marginTop: 2 },
  message: { marginTop: 24 },
  intro: { marginTop: 16, marginHorizontal: 2 },
  chartCard: { marginTop: 14, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface },
  tip: { marginTop: 10, marginHorizontal: 4 },
  list: { marginTop: 10, padding: 4, borderRadius: radius.card, backgroundColor: colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  rowOn: { backgroundColor: colors.surfaceRaised },
  value: { ...figure(figures.sessionEstMax), color: colors.text },
  today: { color: colors.accent },
});
