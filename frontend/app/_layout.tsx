import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { markReviewReady } from '@/review/reviewMode';
import { colors, fontFiles } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontFiles);

  useEffect(() => {
    if (fontsLoaded) markReviewReady();
  }, [fontsLoaded]);

  // Plain background until Archivo is loaded, so text never flashes in a system font.
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaProvider>
  );
}
