import { useNetInfo } from '@react-native-community/netinfo';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth, useSync } from '@/api/AppProviders';
import { API_URL } from '@/api/config';
import { useSettings, useUpdateSettings } from '@/api/settings';
import {
  Button,
  Card,
  IconButton,
  ListRow,
  Screen,
  Separator,
  Switch,
  SyncStatusPill,
  Text,
} from '@/components';
import { BackIcon } from '@/components/icons';
import { colors } from '@/theme';

/**
 * Development only: checks the outbox by hand on a phone (chunk 9's "Done when").
 * Turn on airplane mode, tap "Toggle ghost mode", see "Saved on this phone", turn airplane
 * mode off on Wi-Fi, and watch "Waiting to send" drop to 0.
 */
export function SyncCheckScreen() {
  const { user, signOut } = useAuth();
  const { status, outbox } = useSync();
  const network = useNetInfo();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => router.back()}>
          <BackIcon color={colors.text} />
        </IconButton>
        <SyncStatusPill />
      </View>
      <Text variant="h1" style={styles.title}>
        Sync check
      </Text>
      <Text color="textMuted" style={styles.subtitle}>
        Signed in as {user?.email}. Writes here go through the outbox like every other write.
      </Text>

      <Card style={styles.card}>
        <ListRow label="API" trailing={<Text color="textMuted">{API_URL}</Text>} />
        <Separator />
        <ListRow
          label="Network"
          trailing={
            <Text color="textMuted">
              {network.type}, {network.isInternetReachable === false ? 'no internet' : 'internet'}
            </Text>
          }
        />
        <Separator />
        <ListRow label="Waiting to send" trailing={<Text variant="number" style={styles.count}>{status.pending}</Text>} />
        <Separator />
        <ListRow label="Outbox state" trailing={<Text color="textMuted">{status.state}</Text>} />
        <Separator />
        <ListRow
          label="Sync on Wi-Fi only"
          trailing={
            settings.data ? (
              <Switch
                accessibilityLabel="Sync on Wi-Fi only"
                value={settings.data.sync_wifi_only}
                onValueChange={(value) => void updateSettings({ sync_wifi_only: value })}
              />
            ) : (
              <Text color="textMuted">loading…</Text>
            )
          }
        />
      </Card>

      <View style={styles.actions}>
        <Button
          title={`Toggle ghost mode (now ${settings.data?.ghost_mode ? 'on' : 'off'})`}
          disabled={!settings.data}
          onPress={() => void updateSettings({ ghost_mode: !settings.data?.ghost_mode })}
        />
        <Button title="Try sending now" variant="secondary" onPress={() => void outbox.flush()} />
        <Button title="Sign out" variant="text" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 28 },
  subtitle: { marginTop: 10, fontSize: 16, lineHeight: 22 },
  card: { marginTop: 28, paddingVertical: 6 },
  count: { fontSize: 22, color: colors.text },
  actions: { marginTop: 28, gap: 12 },
});
