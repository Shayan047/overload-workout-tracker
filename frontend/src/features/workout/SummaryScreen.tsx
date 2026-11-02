import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSync } from '@/api/AppProviders';
import type { OutboxStatus } from '@/api/outbox';
import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { Button, IconButton, Separator, Text, useFrameInsets } from '@/components';
import { CheckIcon, CloseIcon, CloudOffIcon, GhostIcon, StarIcon } from '@/components/icons';
import { formatWeight, fromKg } from '@/lib/units';
import { colors, figure, figures, radius } from '@/theme';

import { useFinishedWorkout } from './finishedStore';
import { changeText, ghostDate, isAhead, setText } from './ghost';
import { type ExerciseResult, timeRange } from './summary';

/** Where the workout's writes are, in the words of 11's note; null once they're sent. */
function syncNote(status: OutboxStatus): string | null {
  if (status.pending === 0 || status.state === 'sending' || status.state === 'idle') return null;
  if (status.state === 'waiting-for-wifi') {
    return "Saved on this phone. It syncs to your account the next time you're on Wi-Fi.";
  }
  if (status.state === 'signed-out') return 'Saved on this phone. It syncs to your account after you sign in again.';
  return "Saved on this phone. It syncs to your account when you're back online.";
}

function goToday() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

/** Workout summary (11): duration, sets and volume, each exercise against last time, and
 * new bests. Worked out on the phone when the workout finished, so it works offline. */
export function SummaryScreen() {
  const { top, bottom } = useFrameInsets();
  const summary = useFinishedWorkout();
  const settings = useSettings();
  const exercises = useExercises();
  const { status } = useSync();

  useEffect(() => {
    if (!summary) router.replace('/');
  }, [summary]);
  if (!summary) return <View style={styles.screen} />;

  const unit = settings.data?.unit ?? 'lb';
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const name = (id: string) => byId.get(id)?.name ?? 'Exercise';
  const isBodyweight = (id: string) => byId.get(id)?.kind === 'bodyweight';
  const oneDecimal = (kg: number) => fromKg(kg, unit).toFixed(1);
  const note = syncNote(status);

  // "See … progress": the biggest new best, else the first exercise ahead, else the first.
  const featured =
    summary.bests[0]?.exerciseId ??
    (summary.exercises.find((e) => e.comparison && isAhead(e.comparison)) ?? summary.exercises[0])?.exerciseId;

  /** Today / last in what was compared (24): reps at the same weight, the top weight when
   * heavier, est. max when lighter. */
  const compared = (e: ExerciseResult): { today: string; last: string | null; tag: string } => {
    const c = e.comparison;
    if (!c) return { today: String(e.reps), last: null, tag: 'reps' };
    if (c.kind === 'reps') return { today: String(c.you), last: String(c.last), tag: 'reps' };
    if (c.kind === 'heavier') {
      return { today: formatWeight(fromKg(c.todayKg, unit)), last: formatWeight(fromKg(c.lastKg, unit)), tag: unit };
    }
    return { today: oneDecimal(c.youKg), last: oneDecimal(c.lastKg), tag: 'est.' };
  };

  return (
    <View style={[styles.screen, { paddingTop: top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <View style={styles.done} accessibilityLabel="Workout done">
            <CheckIcon color={colors.accent} strokeWidth={2.4} />
          </View>
          <IconButton accessibilityLabel="Close" onPress={goToday}>
            <CloseIcon color={colors.text} />
          </IconButton>
        </View>

        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          {summary.title} done
        </Text>
        <Text color="textMuted" style={styles.when}>
          {timeRange(new Date(summary.startedAt), new Date(summary.endedAt))}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.minutes}</Text>
            <Text variant="small" color="textMuted">
              minutes
            </Text>
          </View>
          <View style={styles.statRule} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.sets}</Text>
            <Text variant="small" color="textMuted">
              sets
            </Text>
          </View>
          <View style={styles.statRule} />
          <View style={[styles.stat, styles.statWide]}>
            <Text style={styles.statValue}>{Math.round(fromKg(summary.volumeKg, unit)).toLocaleString('en-US')}</Text>
            <Text variant="small" color="textMuted">
              {unit} lifted
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.inline}>
              <GhostIcon color={colors.ghost} size={18} />
              <Text variant="bodyStrong" color="ghost">
                {summary.lastDate ? `vs. ${ghostDate(new Date(summary.lastDate))}` : 'First time for all of these'}
              </Text>
            </View>
            {summary.compared ? (
              <Text variant="bodyHeavy" color={summary.ahead ? 'accent' : 'textMuted'}>
                Ahead on {summary.ahead} of {summary.compared}
              </Text>
            ) : null}
          </View>
          <View style={[styles.row, styles.tableHeader]}>
            <Text variant="label" color="textFaint" style={styles.colName}>
              Exercise
            </Text>
            <Text variant="label" color="textFaint" style={styles.colReps}>
              Today / last
            </Text>
            <Text variant="label" color="textFaint" style={styles.colChange}>
              Change
            </Text>
          </View>
          {summary.exercises.map((e) => {
            const values = compared(e);
            const change = e.comparison ? changeText(e.comparison, unit, 'summary') : 'New';
            return (
              <View key={e.rowId}>
                <Separator inset={16} />
                <View style={styles.row}>
                  <Text numberOfLines={1} style={styles.colName}>
                    {name(e.exerciseId)}
                  </Text>
                  <Text style={[styles.reps, styles.colReps]}>
                    {values.today}
                    {values.last !== null ? <Text style={[styles.reps, styles.last]}> / {values.last}</Text> : null}
                    <Text variant="unitTag" color="textFaint">
                      {' '}
                      {values.tag}
                    </Text>
                  </Text>
                  {change === 'New' || change === 'Even' ? (
                    <Text variant="note" color="textFaint" style={styles.colChange}>
                      {change}
                    </Text>
                  ) : (
                    <Text
                      style={[styles.reps, styles.colChange, { color: isAhead(e.comparison!) ? colors.accent : colors.ghost }]}
                    >
                      {change}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {summary.bests.length ? (
          <View style={styles.bests}>
            <View style={styles.inline}>
              <StarIcon color={colors.accent} size={18} />
              <Text variant="bodyHeavy" color="accent">
                {summary.bests.length} new {summary.bests.length === 1 ? 'best' : 'bests'}
              </Text>
            </View>
            {summary.bests.map((b, i) => (
              <View key={b.exerciseId} style={[styles.best, i < summary.bests.length - 1 && styles.bestRule]}>
                <View style={styles.flex}>
                  <Text variant="h2">{name(b.exerciseId)}</Text>
                  <Text variant="small" color="textMuted">
                    Est. max {oneDecimal(b.estMaxKg)} {unit}, up from {oneDecimal(b.previousKg)}
                  </Text>
                </View>
                <Text style={styles.bestSet}>
                  {setText({ ...b.set, set_number: 1 }, unit, isBodyweight(b.exerciseId))}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {note ? (
          <View style={styles.note}>
            <View style={styles.noteIcon}>
              <CloudOffIcon color={colors.textMuted} size={18} />
            </View>
            <Text variant="small" color="textMuted" style={styles.flex}>
              {note}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button title="Done" onPress={goToday} />
          {featured ? (
            <Button
              title={`See ${name(featured).toLowerCase()} progress`}
              variant="secondary"
              onPress={() => {
                goToday();
                router.push({ pathname: '/exercise/[exerciseId]', params: { exerciseId: featured } });
              }}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  done: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  title: { marginTop: 16 },
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
  card: { marginTop: 12, paddingTop: 8, paddingBottom: 6, borderRadius: radius.card, backgroundColor: colors.surface },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16 },
  tableHeader: { height: 28 },
  colName: { flex: 1, minWidth: 0 },
  colReps: { width: 104, textAlign: 'right' },
  colChange: { width: 64, textAlign: 'right' },
  reps: { ...figure(figures.summaryReps), color: colors.text },
  last: { color: colors.ghost },
  bests: {
    marginTop: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  best: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  bestRule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  bestSet: { ...figure(figures.summaryBest), color: colors.accent },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceQuiet,
  },
  noteIcon: { marginTop: 1 },
  actions: { gap: 8, marginTop: 14 },
});
