import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { TimerIcon } from './icons';
import { Text } from './Text';

/** A small filled tag: day names on preset cards (03, `size="day"`) and muscle/equipment
 * on exercises (05). */
export function Tag({ label, size = 'tag' }: { label: string; size?: 'tag' | 'day' }) {
  return (
    <View style={[styles.tag, size === 'day' && styles.day]}>
      <Text variant="tag" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

/** The outlined rest length on an exercise (05): "Rest 1:30". */
export function RestPill({ text }: { text: string }) {
  return (
    <View style={styles.rest}>
      <TimerIcon color={colors.textMuted} />
      <Text variant="tag" color="textMuted">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.surfaceRaised,
  },
  day: { paddingVertical: 3, paddingHorizontal: 8 },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
