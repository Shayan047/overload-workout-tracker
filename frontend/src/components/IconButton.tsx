import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/theme';

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
  /** `raised` on a sheet, which is already `surface` (09's Close); `clear` inside a card
   * (18's month arrows). */
  tone?: 'surface' | 'raised' | 'clear';
  disabled?: boolean;
  children: ReactNode;
};

/** The round 44 px icon button (.icon in the designs), e.g. Back on 02. */
export function IconButton({ accessibilityLabel, onPress, tone = 'surface', disabled, children }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'raised' && styles.raised,
        tone === 'clear' && styles.clear,
        pressed && (tone === 'raised' ? styles.raisedPressed : tone === 'clear' ? styles.clearPressed : styles.pressed),
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  raised: { backgroundColor: colors.surfaceRaised },
  raisedPressed: { backgroundColor: colors.surfaceRaisedHover },
  clear: { backgroundColor: 'transparent' },
  clearPressed: { backgroundColor: colors.surfaceHover },
});
