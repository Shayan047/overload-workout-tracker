import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { type ExerciseStats, useExerciseStats, useOneWeightStats } from '@/api/stats';
import { BottomSheet, Button, Chip, IconButton, ListRow, Separator, Text, useFrameInsets } from '@/components';
import { ArrowUpIcon, BackIcon, ChevronRightIcon, MoreIcon } from '@/components/icons';
import { exerciseSubtitle } from '@/lib/exercises';
import { formatWeight, fromKg, type Unit } from '@/lib/units';
import { now } from '@/review/reviewMode';
import { colors, figure, figures, radius } from '@/theme';

import { estMaxChart } from './chart';
import { EstMaxChart } from './EstMaxChart';
import { movedUpTo, progressHero, stackedBars } from './oneWeight';
import { StackedBarsChart } from './OneWeightCharts';
import { estMaxText, sessionSets, sessionTitle, sinceFirstText, weightLabel, whenText } from './progressText';
import { LINES, sessionLines } from './sessionLines';
import { LineKey, SessionLinesChart } from './SessionLinesChart';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => `${MONTHS[new Date(iso).getMonth()]} ${new Date(iso).getDate()}`;
const RECENT = 3;
const sameWeight = (a: number, b: number) => Math.abs(a - b) < 0.0005;

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

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <>
      <Text variant="sectionTitle" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="sectionNote" color="textMuted" style={styles.sectionNote}>
        {note}
      </Text>
    </>
  );
}

/** Exercise detail (14), in sections: est. max over time at any weight; the last 3 workouts
 * set by set; reps at one weight; records. From the stats API, cached for offline use.
 * `weightKg` picks the weight shown under "Reps at one weight" (the latest one used by
 * default). */
export function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ exerciseId: string; weightKg?: string }>();
  const exerciseId = params.exerciseId;
  const { top, bottom } = useFrameInsets();
  const today = now();
  const stats = useExerciseStats(exerciseId);
  const exercises = useExercises();
  const settings = useSettings();
  const [options, setOptions] = useState(false);
  const [pickedWeight, setPickedWeight] = useState<number | null>(params.weightKg ? Number(params.weightKg) : null);

  const unit = settings.data?.unit ?? 'lb';
  const exercise = exercises.data?.find((e) => e.id === exerciseId);
  const name = exercise?.name ?? 'Exercise';
  const data = stats.data;
  const bodyweight = data?.includes_bodyweight ?? exercise?.kind === 'bodyweight';
  const latestWeight = data?.series.at(-1)?.best_set.weight_kg ?? null;
  const weightKg = pickedWeight ?? latestWeight;
  const oneWeight = useOneWeightStats(exerciseId, weightKg ?? undefined);
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
    return (
      <>
        <EstMaxSection data={data} unit={unit} today={today} />
        <RecentSection data={data} unit={unit} today={today} bodyweight={bodyweight} exerciseId={exerciseId} />
        {weightKg !== null ? (
          <View style={styles.section}>
            <SectionHead
              title="Reps at one weight"
              note="Only sets done at the weight you pick. More reps at the same weight means you're getting stronger at it."
            />
            {data.weights.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroller}
                contentContainerStyle={styles.chips}
                accessibilityLabel="Weight"
              >
                {[...data.weights]
                  .sort((a, b) => a.weight_kg - b.weight_kg)
                  .map((w) => (
                    <Chip
                      key={w.weight_kg}
                      label={weightLabel(w.weight_kg, unit, bodyweight)}
                      selected={sameWeight(w.weight_kg, weightKg)}
                      onPress={() => setPickedWeight(w.weight_kg)}
                    />
                  ))}
              </ScrollView>
            ) : null}
            <OneWeightSection
              stats={oneWeight}
              series={data.series}
              weightKg={weightKg}
              label={(kg) => weightLabel(kg, unit, bodyweight)}
              today={today}
            />
          </View>
        ) : null}
        <RecordsSection data={data} unit={unit} today={today} bodyweight={bodyweight} onFrontier={openFrontier} />
      </>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back to progress" onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="h1Small" accessibilityRole="header" numberOfLines={2} style={styles.flex}>
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

type SectionProps = { data: ExerciseStats; unit: Unit; today: Date };

/** Estimated max: the big number, how far it's come, and the chart over every weight. */
function EstMaxSection({ data, unit, today }: SectionProps) {
  const estMax = data.est_max_kg!;
  const chart = estMaxChart({ series: data.series, projection: data.projection, unit, now: today });
  const since = data.first && data.series.length > 1 ? sinceFirstText(estMax, data.first, unit) : null;
  const description =
    `Estimated max went from ${estMaxText(data.series[0].est_max_kg, unit)} ${unit} on ${shortDate(data.series[0].at)} ` +
    `to ${estMaxText(estMax, unit)} ${unit} on ${shortDate(data.series[data.series.length - 1].at)}.` +
    (data.projection ? ` Projected about ${Math.round(fromKg(data.projection.est_max_kg, unit))} ${unit} by ${shortDate(data.projection.at)}.` : '');
  return (
    <>
      <View style={styles.hero}>
        <Text variant="label" color="textMuted">
          Estimated max
        </Text>
        <View style={styles.big}>
          <Text style={styles.bigValue}>{estMaxText(estMax, unit)}</Text>
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
        <Text variant="sectionNote" color="textMuted" style={styles.heroNote}>
          From your best set in each workout, at whatever weight you used.
        </Text>
      </View>

      <View style={styles.chartCard}>
        <EstMaxChart chart={chart} description={description} />
      </View>

      <Text color="textMuted" style={styles.pace}>
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
    </>
  );
}

/** Your last 3 workouts: est. max for every set, and the way to all of them (23). */
function RecentSection({ data, unit, today, bodyweight, exerciseId }: SectionProps & { bodyweight: boolean; exerciseId: string }) {
  const recent = data.series.slice(-RECENT);
  const chart = sessionLines(recent, unit, LINES, bodyweight);
  const newest = [...recent].reverse();
  const count = recent.length;
  const description =
    `Estimated max per set for your last ${count === 1 ? 'workout' : `${count} workouts`}. ` +
    newest.map((s) => `${sessionTitle(s.at, today)}: ${sessionSets(s.sets, unit, bodyweight)}`).join('. ') +
    '.';
  return (
    <View style={styles.section}>
      <SectionHead
        title={count === 1 ? 'Your last workout' : `Your last ${count} workouts`}
        note="Estimated max for every set, so you can see how each workout held up from the first set to the last."
      />
      <View style={styles.recentCard}>
        <SessionLinesChart chart={chart} frame={LINES} mode="recent" description={description} />
        <View style={styles.recentList}>
          {newest.map((s, age) => (
            <View key={s.workout_id}>
              {age > 0 ? <Separator inset={16} /> : null}
              <View style={styles.sessionRow}>
                <LineKey age={age} mode="recent" />
                <View style={styles.flex}>
                  <Text variant="rowTitle">{sessionTitle(s.at, today)}</Text>
                  <Text variant="small" color="textMuted">
                    {sessionSets(s.sets, unit, bodyweight)}
                  </Text>
                </View>
                <Text style={[styles.sessionValue, whenText(s.at, today) === 'today' && styles.today]}>
                  {estMaxText(s.est_max_kg, unit)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      {data.series.length > RECENT ? (
        <View style={styles.seeAll}>
          <Button
            title={`See all ${data.series.length} workouts`}
            variant="secondary"
            onPress={() => router.push({ pathname: '/all-workouts', params: { exerciseId } })}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Reps at one weight: reps gained there, and each session's reps per set, stacked (15's
 * chart, now part of 14). */
function OneWeightSection({
  stats,
  series,
  weightKg,
  label,
  today,
}: {
  stats: ReturnType<typeof useOneWeightStats>;
  series: ExerciseStats['series'];
  weightKg: number;
  label: (kg: number) => string;
  today: Date;
}) {
  const data = stats.data;
  if (!data) {
    return (
      <Text color="textMuted" style={styles.message}>
        {stats.isError ? 'This needs a connection the first time. It’s saved on this phone after that.' : 'Loading…'}
      </Text>
    );
  }
  if (!data.sessions.length) {
    return (
      <Text color="textMuted" style={styles.message}>
        No sets at {label(weightKg)} yet.
      </Text>
    );
  }
  const weight = label(weightKg);
  const chart = stackedBars(data.sessions, today);
  const hero = progressHero(data.sessions, weight, today);
  const to = movedUpTo(series, weightKg, data.moved_up_on);
  const description = `Stacked bars of reps per set at ${weight}. Totals: ${chart.bars.map((b) => `${b.label}, ${b.total}`).join('; ')}.`;
  return (
    <>
      {hero ? (
        <View style={styles.heroRow}>
          <Text style={styles.heroValue}>{hero.value}</Text>
          <Text style={styles.heroText}>
            {hero.text}
            {hero.muted ? <Text color="textMuted">{` ${hero.muted}`}</Text> : null}
          </Text>
        </View>
      ) : null}
      <View style={styles.barsCard}>
        <StackedBarsChart chart={chart} description={description} />
      </View>
      {data.moved_up_on ? (
        <Text variant="small" color="textFaint" style={styles.note}>
          You moved up{to !== null ? ` to ${label(to)}` : ''} on {shortDate(data.moved_up_on)}.
        </Text>
      ) : null}
    </>
  );
}

/** Records: best set, most reps and heaviest, and the frontier. */
function RecordsSection({ data, unit, today, bodyweight, onFrontier }: SectionProps & { bodyweight: boolean; onFrontier: () => void }) {
  const setValue = (s: { weight_kg: number; reps: number }) =>
    bodyweight
      ? `${s.weight_kg > 0 ? `BW+${formatWeight(fromKg(s.weight_kg, unit))}` : 'BW'} × ${s.reps}`
      : `${formatWeight(fromKg(s.weight_kg, unit))} × ${s.reps}`;
  const latestToday = (iso: string) => whenText(iso, today) === 'today';
  return (
    <View style={styles.section}>
      <Text variant="sectionTitle" accessibilityRole="header">
        Records
      </Text>
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
                <Text style={styles.recordValue}>{weightLabel(data.heaviest.weight_kg, unit, bodyweight)}</Text>{' '}
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
        onPress={onFrontier}
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
  heroNote: { marginTop: 12, marginHorizontal: 2 },
  chartCard: {
    marginTop: 18,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  pace: { marginTop: 12, marginHorizontal: 4 },
  paceValue: { ...figure(figures.pace), color: colors.text },
  section: { marginTop: 40 },
  sectionNote: { marginTop: 6, marginHorizontal: 2 },
  recentCard: {
    marginTop: 14,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  recentList: { marginTop: 6, marginHorizontal: -12 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 6, paddingHorizontal: 16 },
  sessionValue: { ...figure(figures.sessionEstMax), color: colors.text },
  seeAll: { marginTop: 12 },
  chipsScroller: { marginTop: 14, marginHorizontal: -20, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 20 },
  heroValue: { ...figure(figures.oneWeightHero), color: colors.accent },
  heroText: { flex: 1, minWidth: 0, marginTop: 2 },
  barsCard: {
    marginTop: 16,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  note: { marginTop: 10, marginHorizontal: 4 },
  card: { marginTop: 14, paddingVertical: 4, borderRadius: radius.card, backgroundColor: colors.surface },
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
  sheet: { gap: 4, paddingHorizontal: 6 },
  sheetList: { marginTop: 14, marginBottom: 12, borderRadius: radius.card, backgroundColor: colors.surfaceRaised },
});
