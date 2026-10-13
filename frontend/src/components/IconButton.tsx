import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/theme';

type Props = {
  accessibilityLabel: string;
  onPress: () => void;
  /** `raised` on a sheet, which is already `surface` (09's Close). */
  tone?: 'surface' | 'raised';
  children: ReactNode;
};

/** The round 44 px icon button (.icon in the designs), e.g. Back on 02. */
export function IconButton({ accessibilityLabel, onPress, tone = 'surface', children }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.button, tone === 'raised' && styles.raised, pressed && (tone === 'raised' ? styles.raisedPressed : styles.pressed)]}
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
});
