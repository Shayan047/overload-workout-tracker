import { Link, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/AppProviders';
import { Button, IconButton, Text, useFrameInsets } from '@/components';
import { BackIcon } from '@/components/icons';
import { colors } from '@/theme';

// Placeholder until roadmap chunk 20 builds Profile (19).
export default function Profile() {
  const { top, bottom } = useFrameInsets();
  const { user, signOut } = useAuth();
  return (
    <View style={[styles.screen, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}>
      <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
        <BackIcon color={colors.text} />
      </IconButton>
      <Text variant="h1" style={styles.title}>
        Profile
      </Text>
      <Text color="textMuted" style={styles.note}>
        {user?.email}. Settings arrive in roadmap chunk 20.
      </Text>
      {__DEV__ ? (
        <Link href="/dev-sync" style={styles.devLink}>
          <Text color="textMuted">Sync check (development only)</Text>
        </Link>
      ) : null}
      <View style={styles.spacer} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, backgroundColor: colors.bg },
  title: { marginTop: 22 },
  note: { marginTop: 8 },
  devLink: { marginTop: 24, paddingVertical: 12 },
  spacer: { flex: 1 },
});
