import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { type OneWeightStats, useExerciseStats, useOneWeightStats, type WeightSession } from '@/api/stats';
import { Chip, IconButton, SegmentedControl, Separator, Text, useFrameInsets } from '@/components';
import { BackIcon } from '@/components/icons';
import { now } from '@/review/reviewMode';
import { colors, figure, figures, radius } from '@/theme';

import { FingerprintChart, StackedBarsChart } from './OneWeightCharts';
import { fingerprint, type Hero, movedUpTo, percentText, progressHero, retentionHero, stackedBars } from './oneWeight';
import { weightLabel } from './progressText';

const VIEWS = [
  { value: 'progress', label: 'Progress' },
  { value: 'fingerprint', label: 'Fingerprint' },
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => `${MONTHS[new Date(iso).getMonth()]} ${new Date(iso).getDate()}`;
const sameWeight = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/** One weight (15, 16): only sets done at exactly this weight. Progress stacks each
 * session's reps per set; Fingerprint draws reps by set number and retention. From the stats
 * API, and from the cache when offline. */
export function OneWeightScreen() {
  const params = useLocalSearchParams<{ exerciseId: string; weightKg: string; view?: string }>();
  const exerciseId = params.exerciseId;
  const weightKg = Number(params.weightKg);
  const view: 'progress' | 'fingerprint' = params.view === 'fingerprint' ? 'fingerprint' : 'progress';
  const { top, bottom } = useFrameInsets();
  const today = now();

  const stats = useOneWeightStats(exerciseId, weightKg);
  const detail = useExerciseStats(exerciseId);
  const exercises = useExercises();
  const settings = useSettings();

  const unit = settings.data?.unit ?? 'lb';
  const exercise = exercises.data?.find((e) => e.id === exerciseId);
  const name = exercise?.name ?? 'Exercise';
  const bodyweight = detail.data?.includes_bodyweight ?? exercise?.kind === 'bodyweight';
  const label = (kg: number) => weightLabel(kg, unit, bodyweight);
  const weights = [...(detail.data?.weights ?? [{ weight_kg: weightKg }])].sort((a, b) => a.weight_kg - b.weight_kg);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/exercise/[exerciseId]', params: { exerciseId } });
  };

  const content = () => {
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
    if (view === 'fingerprint') return <FingerprintView data={data} weight={label(weightKg)} today={today} />;
    const to = movedUpTo(detail.data?.series ?? [], weightKg, data.moved_up_on);
    const movedUp = data.moved_up_on
      ? ` You moved up${to !== null ? ` to ${label(to)}` : ''} on ${shortDate(data.moved_up_on)}.`
      : '';
    return <ProgressView data={data} weight={label(weightKg)} movedUp={movedUp} today={today} />;
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel={`Back to ${name.toLowerCase()}`} onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="h1Small" accessibilityRole="header" numberOfLines={1} style={styles.flex}>
            {name}
          </Text>
        </View>

        <View style={styles.views}>
          <SegmentedControl
            options={VIEWS}
            value={view}
            onChange={(next) => router.setParams({ view: next })}
            height={40}
            accessibilityLabel="View"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroller}
          contentContainerStyle={styles.chips}
          accessibilityLabel="Weight filter"
        >
          <Chip label="All weights" onPress={back} />
          {weights.map((w) => (
            <Chip
              key={w.weight_kg}
              label={label(w.weight_kg)}
              selected={sameWeight(w.weight_kg, weightKg)}
              onPress={() => router.setParams({ weightKg: String(w.weight_kg) })}
            />
          ))}
        </ScrollView>

        {content()}
      </ScrollView>
    </View>
  );
}

type ViewProps = { data: OneWeightStats; weight: string; today: Date };

/** 15: reps gained, stacked bars and totals per session. */
function ProgressView({ data, weight, movedUp, today }: ViewProps & { movedUp: string }) {
  const chart = stackedBars(data.sessions, today);
  const description =
    `Stacked bars of reps per set at ${weight}. Totals: ` +
    chart.bars.map((b) => `${b.label}, ${b.total}`).join('; ') +
    '.';
  return (
    <>
      <HeroLine hero={progressHero(data.sessions, weight, today)} />
      <View style={styles.chartCard}>
        <StackedBarsChart chart={chart} description={description} />
      </View>
      <Table
        head={['Date', 'Reps per set', 'Total', 'Avg / set']}
        columns={progressColumns}
        gap={8}
        sessions={data.sessions}
        row={(s, latest) => [
          <Text key="date">{dateText(s.at, today)}</Text>,
          <Text key="reps" color="textMuted" numberOfLines={1}>
            {s.reps.join(', ')}
          </Text>,
          <Text key="total" style={[styles.rowValue, latest && styles.latest]}>
            {s.total}
          </Text>,
          <Text key="avg" style={styles.rowValue}>
            {s.average.toFixed(1)}
          </Text>,
        ]}
      />
      <Text variant="small" color="textFaint" style={styles.note}>
        Only sets done at {weight} count here.{movedUp}
      </Text>
    </>
  );
}

/** 16: retention, reps by set number and retention per session. */
function FingerprintView({ data, weight, today }: ViewProps) {
  const chart = fingerprint(data.sessions);
  const oldest = data.sessions[Math.max(0, data.sessions.length - 1 - chart.earlier.length)];
  const latest = data.sessions[data.sessions.length - 1];
  const description =
    `Reps by set number for ${chart.earlier.length + 1} ${chart.earlier.length ? 'sessions' : 'session'} at ${weight}. ` +
    (chart.earlier.length ? `${shortDate(oldest.at)} went ${oldest.reps.join(', ')}. ` : '') +
    `${shortDate(latest.at)} went ${latest.reps.join(', ')}.`;
  const hero = retentionHero(data.sessions, today);
  return (
    <>
      {hero ? (
        <HeroLine hero={hero} />
      ) : (
        <Text style={styles.hero}>Retention needs at least two sets at {weight}.</Text>
      )}
      <View style={styles.chartCard}>
        <FingerprintChart chart={chart} description={description} />
      </View>
      <Table
        head={['Date', 'First to last', 'Retention', '']}
        columns={fingerprintColumns}
        gap={10}
        sessions={data.sessions}
        row={(s, isLatest) => [
          <Text key="date">{dateText(s.at, today)}</Text>,
          <Text key="reps" color="textMuted" numberOfLines={1}>
            {s.reps.length > 1 ? `${s.reps[0]} to ${s.reps[s.reps.length - 1]}` : String(s.reps[0])}
          </Text>,
          <View key="track" style={styles.track}>
            {s.retention !== null ? (
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, Math.round(s.retention * 100))}%` },
                  { backgroundColor: isLatest ? colors.accent : colors.ghost },
                ]}
              />
            ) : null}
          </View>,
          <Text key="pct" style={[styles.rowValue, isLatest && styles.latest]}>
            {s.retention !== null ? percentText(s.retention) : '–'}
          </Text>,
        ]}
      />
      <Text variant="small" color="textFaint" style={styles.note}>
        Retention is your last set's reps divided by your first set's. Higher means you hold your strength better from
        set to set.
      </Text>
    </>
  );
}

function dateText(iso: string, today: Date) {
  return new Date(iso).toDateString() === today.toDateString() ? 'Today' : shortDate(iso);
}

function HeroLine({ hero }: { hero: Hero | null }) {
  if (!hero) return null;
  return (
    <View style={styles.heroRow}>
      <Text style={styles.heroValue}>{hero.value}</Text>
      <Text style={styles.heroText}>
        {hero.text}
        {hero.muted ? <Text color="textMuted">{` ${hero.muted}`}</Text> : null}
      </Text>
    </View>
  );
}

type Columns = { flex?: number; width?: number; align?: 'right' }[];
// 15: minmax(0, 1fr) minmax(0, 1.3fr) 48px 64px, 8 px apart. 16: 62px 1fr 92px 40px, 10 apart.
const progressColumns: Columns = [{ flex: 1 }, { flex: 1.3 }, { width: 48, align: 'right' }, { width: 64, align: 'right' }];
const fingerprintColumns: Columns = [{ width: 62 }, { flex: 1 }, { width: 92 }, { width: 40, align: 'right' }];

/** Sessions newest first, the latest in amber. */
function Table({
  head,
  columns,
  gap,
  sessions,
  row,
}: {
  head: string[];
  columns: Columns;
  gap: number;
  sessions: WeightSession[];
  row: (session: WeightSession, latest: boolean) => ReactNode[];
}) {
  const cell = (i: number) => [
    columns[i].flex ? { flex: columns[i].flex, minWidth: 0 } : { width: columns[i].width },
    columns[i].align === 'right' && styles.right,
  ];
  const newest = [...sessions].reverse();
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHead, { gap }]}>
        {head.map((h, i) => (
          <View key={`head-${i}`} style={cell(i)}>
            <Text variant="label" color="textFaint" style={columns[i].align === 'right' && styles.rightText}>
              {h}
            </Text>
          </View>
        ))}
      </View>
      {newest.map((s, n) => (
        <View key={s.workout_id}>
          <Separator inset={16} />
          <View style={[styles.tableRow, { gap }]}>
            {row(s, n === 0).map((node, i) => (
              <View key={`cell-${i}`} style={cell(i)}>
                {node}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  views: { marginTop: 16 },
  chipsScroller: { marginTop: 14, marginHorizontal: -20, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 20 },
  message: { marginTop: 24 },
  hero: { marginTop: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 20 },
  heroValue: { ...figure(figures.oneWeightHero), color: colors.accent },
  heroText: { flex: 1, minWidth: 0, marginTop: 2 },
  chartCard: {
    marginTop: 16,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  table: { marginTop: 12, paddingVertical: 4, borderRadius: radius.card, backgroundColor: colors.surface },
  tableRow: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 16 },
  tableHead: { height: 32 },
  right: { alignItems: 'flex-end' },
  rightText: { textAlign: 'right' },
  rowValue: { ...figure(figures.oneWeightRow), color: colors.text, textAlign: 'right' },
  latest: { color: colors.accent },
  track: { height: 8, borderRadius: 6, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  note: { marginTop: 12, marginHorizontal: 4 },
});
