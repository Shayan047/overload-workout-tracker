import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { useLastSessions } from '@/api/workouts';
import { BrandMark, Button, Text, useFrameInsets } from '@/components';
import { GhostIcon, TimerIcon } from '@/components/icons';
import { formatRest } from '@/lib/exercises';
import { now } from '@/review/reviewMode';
import { colors, figure, figures, radius } from '@/theme';

import { RestAlarm } from '../../../modules/rest-alarm';
import { setText } from './ghost';
import { nextUp } from './RestAlerts';
import { useWorkoutActions } from './useWorkoutActions';
import { currentExercise, plannedRows } from './workout';
import { inProgress, useActiveWorkout } from './workoutStore';

const EXTRA_REST_SECONDS = 15;

/** "6:58 PM". */
function clockText(date: Date): string {
  const hours = date.getHours() % 12 || 12;
  return `${hours}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** Rest's over (26): opened by the rest alarm, over the lock screen if the phone is locked,
 * like the Clock app's alarm. "Start set N" goes to the workout (asking to unlock);
 * "+15 sec" rests a little longer and goes back to what was on screen. */
export function RestOverScreen() {
  const { top, bottom } = useFrameInsets();
  const saved = inProgress(useActiveWorkout());
  const exercises = useExercises();
  const settings = useSettings();
  const actions = useWorkoutActions();
  const row = saved ? currentExercise(saved.state, { focusId: saved.focusId }) : null;
  const lastSessions = useLastSessions(row ? [row.exercise_id] : []);

  // Over the lock screen and with the screen on only while this screen is up.
  useEffect(() => {
    RestAlarm?.dismissAlert?.(); // optional: builds before it lack it
    RestAlarm?.setShowOverLockScreen(true);
    return () => RestAlarm?.setShowOverLockScreen(false);
  }, []);

  useEffect(() => {
    if (saved === null) router.replace('/');
  }, [saved]);
  if (!saved) return <View style={styles.screen} />;

  const unit = settings.data?.unit ?? 'lb';
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const names = new Map([...byId].map(([id, e]) => [id, e.name]));
  const last = (exerciseId: string) => lastSessions.data?.find((l) => l.exercise_id === exerciseId);
  const next = nextUp(saved, names, (exerciseId, setNumber) => {
    const set = last(exerciseId)?.sets.find((s) => s.set_number === setNumber);
    return set ? setText(set, unit, byId.get(exerciseId)?.kind === 'bodyweight') : null;
  });
  const planned = row ? plannedRows(saved.state, row.id, last(row.exercise_id)?.sets.length ?? 0) : 0;

  const start = () => {
    RestAlarm?.dismissKeyguard();
    router.replace('/workout');
  };
  const moreRest = async () => {
    await actions.restAgain(EXTRA_REST_SECONDS);
    router.replace('/workout');
    RestAlarm?.sendToBack();
  };

  return (
    <View style={[styles.screen, { paddingTop: top + 12, paddingBottom: bottom + 2 }]}>
      <View style={styles.header}>
        <BrandMark />
        <Text variant="bodyStrong" color="textMuted">
          {clockText(now())}
        </Text>
      </View>

      <View style={styles.middle}>
        {saved.rest ? (
          <View style={styles.rested}>
            <TimerIcon color={colors.textMuted} size={15} strokeWidth={1.8} />
            <Text variant="label" color="textMuted">
              Rested {formatRest(saved.rest.totalSeconds)}
            </Text>
          </View>
        ) : null}
        <Text variant="restOverTitle" accessibilityRole="header" style={styles.title}>
          Rest’s over
        </Text>
        <View style={styles.track} />

        {next ? (
          <>
            <Text variant="restOverName" style={styles.name}>
              {next.name}
            </Text>
            <Text color="textMuted" style={styles.setLine}>
              Set {next.setNumber}
              {planned >= next.setNumber ? ` of ${planned}` : ''} next
            </Text>
            {next.lastTime ? (
              <View style={styles.ghost}>
                <View style={styles.ghostIcon}>
                  <GhostIcon color={colors.ghost} size={16} />
                </View>
                <Text variant="label" color="ghost">
                  Last time
                </Text>
                <Text style={styles.ghostSet}>{next.lastTime}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text color="textMuted" style={styles.setLine}>
            That was the last set. Time to finish your workout.
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        <Button title={next ? `Start set ${next.setNumber}` : 'Open workout'} onPress={start} />
        {next ? <Button title={`+${EXTRA_REST_SECONDS} sec`} variant="secondary" onPress={() => void moreRest()} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  middle: { flex: 1, justifyContent: 'center' },
  rested: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { marginTop: 10 },
  // The whole rest, done: a full track.
  track: { height: 6, marginTop: 22, borderRadius: 4, backgroundColor: colors.accent },
  name: { marginTop: 34 },
  setLine: { marginTop: 6 },
  // "Last time" sits on the number's baseline; only the icon is centred (26).
  ghost: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    backgroundColor: colors.inset,
  },
  ghostIcon: { alignSelf: 'center' },
  ghostSet: { ...figure(figures.restOverLast), color: colors.ghost },
  actions: { gap: 12 },
});
