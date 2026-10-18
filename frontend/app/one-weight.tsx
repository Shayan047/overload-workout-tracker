import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Text } from '@/components';
import { colors } from '@/theme';

// Placeholder until roadmap chunk 18 builds this screen.
export default function Placeholder() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 16, padding: 20, backgroundColor: colors.bg }}>
      <Text variant="h1">One weight</Text>
      <Text color="textMuted">Coming in a later update.</Text>
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}
