import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { useExerciseStats } from '@/api/stats';
import { BottomSheet, Button, Chip, IconButton, ListRow, Separator, Text, useFrameInsets } from '@/components';
import { ArrowUpIcon, BackIcon, ChevronRightIcon, MoreIcon, TrendIcon } from '@/components/icons';
import { exerciseSubtitle } from '@/lib/exercises';
import { formatWeight, fromKg } from '@/lib/units';
import { now } from '@/review/reviewMode';
import { colors, figure, figures, radius } from '@/theme';

import { estMaxChart } from './chart';
import { EstMaxChart } from './EstMaxChart';
import { estMaxText, sessionSets, sessionTitle, sinceFirstText, weightLabel, whenText } from './progressText';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => `${MONTHS[new Date(iso).getMonth()]} ${new Date(iso).getDate()}`;
const RECENT = 4;

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/progress');
}

/** Rep-weight frontier's thumbnail (14): ice for the past frontier, amber for today's. */
function FrontierThumb() {
  return (
    <Svg width={48} height={40} viewBox="0 0 48 40">
      <Path d="M4 36V4M4 36h40" stroke={colors.borderStrong} strokeWidth={1.5} fill="none" />
      <Path d="M10 26L30 20L40 12" stroke={colors.ghost} strokeWidth={1.5} strokeDasharray="3 3" fill="none" />
      <Path d="M14 10L32 16L42 26" stroke={colors.accent} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Exercise detail (14): est. max now and since the first session, the chart with weight
 * bands and the projection, records, and recent sessions. From the stats API, and from the
 * cache when offline. */
export function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { top, bottom } = useFrameInsets();
  const today = now();
  const stats = useExerciseStats(exerciseId);
  const exercises = useExercises();
  const settings = useSettings();
  const [options, setOptions] = useState(false);

  const unit = settings.data?.unit ?? 'lb';
  const exercise = exercises.data?.find((e) => e.id === exerciseId);
  const name = exercise?.name ?? 'Exercise';
  const data = stats.data;
  const bodyweight = data?.includes_bodyweight ?? exercise?.kind === 'bodyweight';
  const weight = (kg: number) => weightLabel(kg, unit, bodyweight);
  const setValue = (s: { weight_kg: number; reps: number }) =>
    bodyweight ? `${s.weight_kg > 0 ? `BW+${formatWeight(fromKg(s.weight_kg, unit))}` : 'BW'} × ${s.reps}` : `${formatWeight(fromKg(s.weight_kg, unit))} × ${s.reps}`;
  const openFrontier = () => router.push({ pathname: '/frontier', params: { exerciseId } });

  const content = () => {
    if (!data) {
      return (
        <Text color="textMuted" style={styles.message}>
          {stats.isError ? 'This needs a connection the first time. It’s saved on this phone after that.' : 'Loading…'}
        </Text>
      );
    }
    if (!data.series.length || data.est_max_kg === null) {
      return (
        <Text color="textMuted" style={styles.message}>
          Finish a workout with {name.toLowerCase()} to see its progress.
        </Text>
      );
    }
    const chart = estMaxChart({ series: data.series, projection: data.projection, unit, now: today });
    const since = data.first && data.series.length > 1 ? sinceFirstText(data.est_max_kg, data.first, unit) : null;
    const recent = [...data.series].reverse().slice(0, RECENT);
    const latestToday = (iso: string) => whenText(iso, today) === 'today';
    const description =
      `Estimated max went from ${estMaxText(data.series[0].est_max_kg, unit)} ${unit} on ${shortDate(data.series[0].at)} ` +
      `to ${estMaxText(data.est_max_kg, unit)} ${unit} on ${shortDate(data.series[data.series.length - 1].at)}.` +
      (data.projection ? ` Projected about ${Math.round(fromKg(data.projection.est_max_kg, unit))} ${unit} by ${shortDate(data.projection.at)}.` : '');

    return (
      <>
        <View style={styles.hero}>
          <Text variant="label" color="textMuted">
            Estimated max
          </Text>
          <View style={styles.big}>
            <Text style={styles.bigValue}>{estMaxText(data.est_max_kg, unit)}</Text>
            <Text variant="estMaxUnit" color="textMuted">
              {unit}
            </Text>
          </View>
          {since ? (
            <View style={styles.since}>
              {since.up ? <ArrowUpIcon color={colors.accent} size={18} /> : null}
              <Text variant="bodyStrong" color={since.up ? 'accent' : 'textMuted'}>
                {since.text}
              </Text>
            </View>
          ) : null}
        </View>

        {data.weights.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroller}
            contentContainerStyle={styles.chips}
            accessibilityLabel="Weight filter"
          >
            <Chip label="All weights" selected />
            {[...data.weights]
              .sort((a, b) => a.weight_kg - b.weight_kg)
              .map((w) => (
                <Chip
                  key={w.weight_kg}
                  label={weight(w.weight_kg)}
                  onPress={() => router.push({ pathname: '/one-weight', params: { exerciseId, weightKg: String(w.weight_kg) } })}
                />
              ))}
          </ScrollView>
        ) : null}

        <View style={styles.chartCard}>
          <EstMaxChart chart={chart} description={description} />
        </View>

        <View style={styles.pace}>
          <TrendIcon color={colors.accent} />
          <Text style={styles.flex}>
            {data.projection ? (
              <>
                On pace for about{' '}
                <Text style={styles.paceValue}>
                  {Math.round(fromKg(data.projection.est_max_kg, unit))} {unit}
                </Text>{' '}
                by {shortDate(data.projection.at)}.{' '}
              </>
            ) : (
              'A few more sessions and this shows where it’s heading. '
            )}
            {data.plateau ? `Flat for ${data.plateau.weeks_flat} weeks.` : 'No plateau yet.'}
          </Text>
        </View>

        <View style={styles.card}>
          {data.best_set ? (
            <View style={styles.record}>
              <Text color="textMuted">Best set</Text>
              <Text>
                <Text style={[styles.recordValue, latestToday(data.best_set.at) && styles.today]}>{setValue(data.best_set)}</Text>{' '}
                <Text variant="small" color="textFaint">
                  {whenText(data.best_set.at, today)}
                </Text>
              </Text>
            </View>
          ) : null}
          {data.most_reps ? (
            <>
              <Separator inset={16} />
              <View style={styles.record}>
                <Text color="textMuted">Most reps</Text>
                <Text>
                  <Text style={styles.recordValue}>{setValue(data.most_reps)}</Text>{' '}
                  <Text variant="small" color="textFaint">
                    {whenText(data.most_reps.at, today)}
                  </Text>
                </Text>
              </View>
            </>
          ) : null}
          {data.heaviest ? (
            <>
              <Separator inset={16} />
              <View style={styles.record}>
                <Text color="textMuted">Heaviest</Text>
                <Text>
                  <Text style={styles.recordValue}>{weight(data.heaviest.weight_kg)}</Text>{' '}
                  <Text variant="small" color="textFaint">
                    since {whenText(data.heaviest.first_at, today)}
                  </Text>
                </Text>
              </View>
            </>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rep-weight frontier"
          onPress={openFrontier}
          style={({ pressed }) => [styles.frontier, pressed && styles.pressed]}
        >
          <FrontierThumb />
          <View style={styles.flex}>
            <Text variant="rowTitle">Rep-weight frontier</Text>
            <Text variant="smallInBody" color="textMuted">
              Your most reps at every weight you've used
            </Text>
          </View>
          <ChevronRightIcon color={colors.textFaint} />
        </Pressable>

        <Text variant="label" color="textFaint" style={styles.recentLabel}>
          Recent sessions
        </Text>
        <View style={styles.recent}>
          {recent.map((s, i) => {
            const isToday = latestToday(s.at);
            return (
              <View key={s.workout_id}>
                {i > 0 ? <Separator inset={16} /> : null}
                <View style={[styles.record, styles.session]}>
                  <View style={styles.flex}>
                    <Text variant="rowTitle">{sessionTitle(s.at, today)}</Text>
                    <Text variant="smallInBody" color="textMuted">
                      {sessionSets(s.sets, unit, bodyweight)}
                    </Text>
                  </View>
                  <Text style={[styles.recordValue, isToday && styles.today]}>{estMaxText(s.est_max_kg, unit)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back to progress" onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="h1Small" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
            {name}
          </Text>
          <IconButton accessibilityLabel="Exercise options" onPress={() => setOptions(true)}>
            <MoreIcon color={colors.text} />
          </IconButton>
        </View>
        {content()}
      </ScrollView>

      <BottomSheet visible={options} onClose={() => setOptions(false)} accessibilityLabel={`${name} options`}>
        <View style={styles.sheet}>
          <Text variant="h2">{name}</Text>
          {exercise ? (
            <Text variant="small" color="textMuted">
              {exerciseSubtitle(exercise)}
              {bodyweight ? '. Est. max includes your bodyweight.' : ''}
            </Text>
          ) : null}
          <View style={styles.sheetList}>
            <ListRow
              label="Rep-weight frontier"
              accessibilityLabel="Rep-weight frontier"
              onPress={() => {
                setOptions(false);
                openFrontier();
              }}
              trailing={<ChevronRightIcon color={colors.textFaint} />}
            />
          </View>
          <Button title="Close" variant="secondary" onPress={() => setOptions(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  message: { marginTop: 24 },
  hero: { marginTop: 20 },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  bigValue: { ...figure(figures.estMax), color: colors.text },
  since: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  chipsScroller: { marginTop: 18, marginHorizontal: -20, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chartCard: {
    marginTop: 14,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceQuiet,
  },
  paceValue: { ...figure(figures.pace), color: colors.text },
  card: { marginTop: 12, paddingVertical: 4, borderRadius: radius.card, backgroundColor: colors.surface },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  recordValue: { ...figure(figures.record), color: colors.text },
  today: { color: colors.accent },
  frontier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
    paddingVertical: 14,
    paddingRight: 12,
    paddingLeft: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceHover },
  recentLabel: { marginTop: 20, marginHorizontal: 4, marginBottom: 8 },
  recent: { paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  session: { minHeight: 60 },
  sheet: { gap: 4, paddingHorizontal: 6 },
  sheetList: { marginTop: 14, marginBottom: 12, borderRadius: radius.card, backgroundColor: colors.surfaceRaised },
});
