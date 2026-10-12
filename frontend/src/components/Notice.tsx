import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { AlertIcon } from './icons';
import { Text } from './Text';

/** A quiet message box (the info box on 02). Used for errors: the theme has no red, and
 * amber and ice keep their fixed meanings, so errors are plain text with an icon. */
export function Notice({ message }: { message: string }) {
  return (
    <View style={styles.box} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AlertIcon color={colors.text} />
      <Text color="textSecondary" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceQuiet,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
});
