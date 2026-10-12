import { StyleSheet, View } from 'react-native';

import { useSync } from '@/api/AppProviders';
import { syncStatusText } from '@/api/network';
import { colors, font, radius } from '@/theme';

import { CloudOffIcon } from './icons';
import { Text } from './Text';

/** "Saved on this phone" / "1 waiting for Wi-Fi" (07). Hidden when nothing is waiting. */
export function SyncStatusPill() {
  const { status } = useSync();
  const text = syncStatusText(status);
  if (!text) return null;
  return (
    <View style={styles.pill} accessibilityRole="text" accessibilityLabel={text}>
      <CloudOffIcon color={colors.textSecondary} size={16} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
  },
  text: { ...font(600), fontSize: 12, lineHeight: 16, color: colors.textSecondary },
});
