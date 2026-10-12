import { Pressable, StyleSheet, View } from 'react-native';

import { colors, font } from '@/theme';

import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** light: selected segment is light on dark (02). raised: a lifted dark segment (04). */
  tone?: 'light' | 'raised';
  /** Segment height: 40, 44 or 52 in the designs. */
  height?: 40 | 44 | 52;
  accessibilityLabel?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'raised',
  height = 44,
  accessibilityLabel,
}: Props<T>) {
  const large = height === 52;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              { height, borderRadius: large ? 11 : 10 },
              selected && (tone === 'light' ? styles.selectedLight : styles.selectedRaised),
            ]}
          >
            <Text
              style={[
                large ? styles.labelLarge : styles.label,
                selected && { color: tone === 'light' ? colors.bg : colors.text },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selectedLight: { backgroundColor: colors.text },
  selectedRaised: { backgroundColor: colors.surfaceRaised },
  label: { ...font(600), fontSize: 15, lineHeight: 20, color: colors.textMuted },
  labelLarge: { ...font(650), fontSize: 17, lineHeight: 22, color: colors.textMuted },
});
