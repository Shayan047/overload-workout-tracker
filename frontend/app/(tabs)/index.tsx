import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen, SyncStatusPill, Text } from '@/components';
import { isReviewMode } from '@/review/reviewMode';

// Placeholder until roadmap chunk 12 builds this screen. The sync status pill sits where
// 07 puts it.
export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1">Today</Text>
        <SyncStatusPill />
      </View>
      {__DEV__ && !isReviewMode ? (
        <Link href="/dev-sync" style={styles.devLink}>
          <Text color="textMuted">Sync check (development only)</Text>
        </Link>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  devLink: { marginTop: 24, paddingVertical: 12 },
});
