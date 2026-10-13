import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, IconButton, Text, useFrameInsets } from '@/components';
import { BackIcon } from '@/components/icons';
import { colors } from '@/theme';

// Placeholder until roadmap chunk 13 builds the active workout (08).
export default function Workout() {
  const { top, bottom } = useFrameInsets();
  return (
    <View style={[styles.screen, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}>
      <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
        <BackIcon color={colors.text} />
      </IconButton>
      <Text variant="h1" style={styles.title}>
        Active workout
      </Text>
      <Text color="textMuted" style={styles.note}>
        Logging sets arrives in the next update (roadmap chunk 13).
      </Text>
      <View style={styles.spacer} />
      <Button title="Back to Today" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, backgroundColor: colors.bg },
  title: { marginTop: 22 },
  note: { marginTop: 8 },
  spacer: { flex: 1 },
});
