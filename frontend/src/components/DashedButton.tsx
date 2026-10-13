import { Pressable, StyleSheet } from 'react-native';

import { colors, type } from '@/theme';

import { PlusIcon } from './icons';
import { Text } from './Text';

/** "Add a day" (04): a dashed outline, a plus and a label. */
export function DashedButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <PlusIcon color={colors.text} size={20} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: 14,
  },
  pressed: { backgroundColor: colors.surface },
  label: { ...type.buttonSecondary, color: colors.text },
});
