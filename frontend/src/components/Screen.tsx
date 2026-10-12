import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, space } from '@/theme';

import { useFrameInsets } from './layout';

/** A tab screen: app background, 20 px side gutters, scrolls. Content starts 8 px below the
 * status bar, like 07's 52 px top padding. */
export function Screen({ children }: { children?: ReactNode }) {
  const { top } = useFrameInsets();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8 }]}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.gutter, paddingBottom: 24 },
});
