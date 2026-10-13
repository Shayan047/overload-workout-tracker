import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components';
import { TimerIcon } from '@/components/icons';
import { formatRest } from '@/lib/exercises';
import { isReviewMode, now } from '@/review/reviewMode';
import { colors, figure, figures, radius, type } from '@/theme';

import { remainingSeconds, type Rest, restProgress } from './rest';

type Props = {
  rest: Rest;
  /** "Rest, then set 3". */
  label: string;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
};

function TimerButton({ title, label, onPress }: { title: string; label?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

/** The rest timer above "Log set" (08). Counts down from the stored end time; hidden once
 * it's over. */
export function RestTimerCard({ rest, label, onAdjust, onSkip }: Props) {
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (isReviewMode) return;
    const timer = setInterval(() => setClock(new Date()), 250);
    return () => clearInterval(timer);
  }, []);

  const left = remainingSeconds(rest, clock);
  if (left === 0) return null;

  return (
    <View style={styles.card} accessibilityLabel="Rest timer">
      <View style={styles.row}>
        <View style={styles.text}>
          <View style={styles.title}>
            <TimerIcon color={colors.textMuted} size={15} strokeWidth={1.8} />
            <Text variant="label" color="textMuted">
              {label}
            </Text>
          </View>
          <View style={styles.time}>
            <Text style={styles.countdown} accessibilityRole="timer">
              {formatRest(left)}
            </Text>
            <Text variant="small" color="textFaint">
              of {formatRest(rest.totalSeconds)}
            </Text>
          </View>
        </View>
        <TimerButton title="−15" label="Take 15 seconds off" onPress={() => onAdjust(-15)} />
        <TimerButton title="+15" label="Add 15 seconds" onPress={() => onAdjust(15)} />
        <TimerButton title="Skip" label="Skip rest" onPress={onSkip} />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${restProgress(rest, clock) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, minWidth: 0 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  countdown: { ...figure(figures.restCountdown), color: colors.accent },
  button: {
    height: 44,
    minWidth: 48,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.setRow,
    backgroundColor: colors.surfaceRaised,
  },
  buttonPressed: { backgroundColor: colors.surfaceRaisedHover },
  buttonText: { ...type.stepper, color: colors.text },
  track: { height: 6, marginTop: 12, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.track },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4, backgroundColor: colors.accent },
});
