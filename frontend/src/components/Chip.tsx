import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet } from 'react-native';

import { colors, radius, type } from '@/theme';

import { Text } from './Text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
};

/** Filter and choice chips (06, 13, 14). Selected chips are light on dark. */
export function Chip({ label, selected = false, icon, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={[styles.chip, selected && styles.selected]}
      {...rest}
    >
      {icon}
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.chip,
  },
  selected: { backgroundColor: colors.text, borderColor: colors.text },
  label: { ...type.chip, color: colors.textSecondary },
  selectedLabel: { color: colors.bg },
});
