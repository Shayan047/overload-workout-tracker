import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

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

const styles = StyleSheet.create({
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.surfaceRaised,
  },
  day: { paddingVertical: 3, paddingHorizontal: 8 },
});
