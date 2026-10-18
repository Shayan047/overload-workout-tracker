import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePendingWorkoutIds, useWorkoutHistory, type WorkoutHistoryItem } from '@/api/history';
import { useSync } from '@/api/AppProviders';
import { IconButton, Screen, Separator, Text } from '@/components';
import { BackIcon, ChevronRightIcon } from '@/components/icons';
import { now } from '@/review/reviewMode';
import { colors, radius, type } from '@/theme';

import { calendar, type Cell, monthNote, onDay, workoutLine } from './history';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RECENT = 4;

/** History (18): the month calendar with a dot on every day trained, and the recent
 * workouts (or a picked day's), with how they went against last time and whether they've
 * synced. From the API, the cache when offline, and the phone for workouts not sent yet. */
export function HistoryScreen() {
  const today = now();
  const history = useWorkoutHistory();
  const pending = usePendingWorkoutIds();
  const { status } = useSync();
  const [month, setMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [picked, setPicked] = useState<number | null>(null);

  const workouts = history.data ?? [];
  const cal = calendar(month.year, month.month, workouts, today);
  const shown = picked !== null ? onDay(workouts, month.year, month.month, picked) : workouts.slice(0, RECENT);
  const note = history.data ? monthNote(month.year, month.month, workouts, today) : '';
  const waiting = status.state === 'waiting-for-wifi' ? 'Waiting for Wi-Fi' : 'Saved on this phone';

  const go = (delta: number) => {
    const next = new Date(month.year, month.month + delta, 1);
    setMonth({ year: next.getFullYear(), month: next.getMonth() });
    setPicked(null);
  };

  const list = () => {
    if (history.isPending && !history.data) return null;
    if (!shown.length) {
      return (
        <Text variant="small" color="textMuted" style={styles.empty}>
          {history.isError && !history.data
            ? 'History needs a connection the first time. It’s saved on this phone after that.'
            : picked !== null
              ? 'No workout that day.'
              : 'Finished workouts show up here.'}
        </Text>
      );
    }
    return (
      <View style={styles.list}>
        {shown.map((w, i) => (
          <View key={w.id}>
            {i > 0 ? <Separator inset={16} /> : null}
            <WorkoutRow workout={w} sync={pending.has(w.id) ? waiting : 'Synced'} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <Screen>
      <Text variant="pageTitle" accessibilityRole="header" style={styles.title}>
        History
      </Text>

      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <IconButton accessibilityLabel="Previous month" tone="clear" onPress={() => go(-1)}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="rowTitle">{cal.title}</Text>
          <IconButton accessibilityLabel="Next month" tone="clear" onPress={() => go(1)}>
            <ChevronRightIcon color={colors.text} />
          </IconButton>
        </View>
        <View style={[styles.week, styles.weekdays]}>
          {WEEKDAYS.map((d) => (
            <Text key={d} variant="label" color="textFaint" style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        <View style={styles.days}>
          {cal.weeks.map((week, w) => (
            <View key={`week-${w}`} style={styles.week}>
              {week.map((cell, d) => (
                <Day
                  key={`day-${w}-${d}`}
                  cell={cell}
                  picked={cell?.day === picked}
                  onPress={() => cell && setPicked(cell.day === picked ? null : cell.day)}
                  label={cell ? `${cal.title.split(' ')[0]} ${cell.day}` : ''}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {note ? (
        <Text variant="small" color="textMuted" style={styles.note}>
          {note}
        </Text>
      ) : null}

      {list()}
    </Screen>
  );
}

function Day({ cell, picked, onPress, label }: { cell: Cell; picked: boolean; onPress: () => void; label: string }) {
  if (!cell) return <View style={styles.day} />;
  const trained = cell.state === 'trained' || cell.state === 'today-trained';
  const isToday = cell.state === 'today' || cell.state === 'today-trained';
  const future = cell.state === 'future';
  const color = future ? colors.textDisabled : cell.state === 'rest' ? colors.textMuted : isToday && !trained ? colors.accent : colors.text;
  const description = `${isToday ? 'Today, ' : ''}${label}${trained ? ', trained' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description}
      accessibilityState={{ selected: picked, disabled: future }}
      disabled={future}
      onPress={onPress}
      style={styles.day}
    >
      {cell.state === 'today-trained' ? (
        <View style={styles.todayCircle}>
          <Text style={styles.todayNumber}>{cell.day}</Text>
        </View>
      ) : (
        <>
          <View style={[styles.dayNumber, picked && styles.picked]}>
            <Text variant="bodyStrong" style={{ color }}>
              {cell.day}
            </Text>
          </View>
          <View style={[styles.dot, trained && styles.dotOn]} />
        </>
      )}
    </Pressable>
  );
}

/** One workout: what and when, then how it went against last time (amber: you) and whether
 * it has synced. */
function WorkoutRow({ workout, sync }: { workout: WorkoutHistoryItem; sync: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="rowTitle" numberOfLines={1}>
          {workout.title}
        </Text>
        <Text variant="smallInBody" color="textMuted">
          {workoutLine(workout)}
        </Text>
      </View>
      <View style={styles.right}>
        {workout.compared > 0 ? (
          <Text variant="labelHeavy" color={workout.ahead > 0 ? 'accent' : 'textMuted'} style={styles.rightText}>
            Ahead on {workout.ahead} of {workout.compared}
          </Text>
        ) : null}
        <Text variant="smallInBody" color="textFaint" style={styles.rightText}>
          {sync}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4 },
  calendar: {
    marginTop: 16,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekdays: { marginTop: 4 },
  weekday: { flex: 1, textAlign: 'center' },
  days: { marginTop: 4, rowGap: 2 },
  week: { flexDirection: 'row' },
  day: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNumber: { minWidth: 30, alignItems: 'center', borderRadius: radius.chip },
  picked: { backgroundColor: colors.surfaceRaised },
  dot: { width: 5, height: 5, borderRadius: radius.chip },
  dotOn: { backgroundColor: colors.accent },
  todayCircle: {
    width: 34,
    height: 34,
    marginTop: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.accent,
  },
  todayNumber: { ...type.calendarToday, color: colors.onAccent },
  note: { marginTop: 10, marginHorizontal: 4 },
  empty: { marginTop: 16, marginHorizontal: 4 },
  list: { marginTop: 16, paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  rightText: { textAlign: 'right' },
});
