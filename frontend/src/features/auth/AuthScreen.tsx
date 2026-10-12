import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Notice, Text, useFrameInsets } from '@/components';
import { colors } from '@/theme';

type Props = {
  /** The top row: the brand mark, or a back button. */
  header: ReactNode;
  title: string;
  subtitle: string;
  fields: ReactNode;
  error: string | null;
  actions: ReactNode;
};

/** Shared layout for sign-in and sign-up, in the style of 01–02: 24 px sides, title and
 * subtitle, labelled fields (pass `labelGap={10}`, as 02), and the actions at the bottom
 * (the 54 px `size="medium"` primary button, as 01–02). */
export function AuthScreen({ header, title, subtitle, fields, error, actions }: Props) {
  const { top, bottom } = useFrameInsets();
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom + 2 }]}
      >
        <View style={styles.header}>{header}</View>
        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text color="textMuted" style={styles.subtitle}>
          {subtitle}
        </Text>
        <View style={styles.fields}>{fields}</View>
        {error ? (
          <View style={styles.error}>
            <Notice message={error} />
          </View>
        ) : null}
        <View style={styles.spacer} />
        <View style={styles.actions}>{actions}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 28 },
  subtitle: { marginTop: 10, maxWidth: 320, fontSize: 16, lineHeight: 22 },
  fields: { marginTop: 36, gap: 20 },
  error: { marginTop: 20 },
  spacer: { flexGrow: 1, minHeight: 32 },
  actions: { gap: 12 },
});
