import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, space } from '@/theme';

import { Text } from './Text';

type Props = {
  label: ReactNode;
  /** Shown on the right: text, a number, a switch… */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** A row inside a card (.lrow): 44 px tall, 18 px side padding. */
export function ListRow({ label, trailing, onPress, accessibilityLabel, style }: Props) {
  const content = (
    <>
      {typeof label === 'string' ? <Text>{label}</Text> : label}
      {trailing}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

/** A 1 px rule between rows. `inset` is the side margin (16 or 18 in the designs). */
export function Separator({ inset = 18 }: { inset?: number }) {
  return <View style={[styles.separator, { marginHorizontal: inset }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space.minTouchTarget,
    paddingHorizontal: 18,
  },
  pressed: { backgroundColor: colors.surfaceHover },
  separator: { height: 1, backgroundColor: colors.line },
});
