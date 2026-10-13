import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Text } from '@/components';
import { colors } from '@/theme';

// Placeholder until roadmap chunk 17 builds Exercise detail (14).
export default function ExerciseDetail() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 16, padding: 20, backgroundColor: colors.bg }}>
      <Text variant="h1">Exercise detail</Text>
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}
