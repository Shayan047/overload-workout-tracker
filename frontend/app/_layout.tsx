import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProviders, useAuth } from '@/api/AppProviders';
import { isReviewMode, markReviewReady } from '@/review/reviewMode';
import { colors, fontFiles } from '@/theme';

const blank = <View style={{ flex: 1, backgroundColor: colors.bg }} />;

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontFiles);

  // Plain background until Archivo and the saved session are loaded, so text never flashes
  // in a system font and signed-in users never see the sign-in screen.
  if (!fontsLoaded) return blank;

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <AppProviders fallback={blank}>
        <Routes />
      </AppProviders>
    </SafeAreaProvider>
  );
}

function Routes() {
  const { signedIn } = useAuth();

  useEffect(() => {
    markReviewReady();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Review mode opens every screen, so each can be screenshotted. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="dev-sync" />
      </Stack.Protected>
      <Stack.Protected guard={isReviewMode || !signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
