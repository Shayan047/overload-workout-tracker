import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius } from '@/theme';

type Props = ViewProps & {
  /** surface: default. current: the card for what's happening now. quiet: low emphasis. */
  tone?: 'surface' | 'current' | 'quiet';
};

export function Card({ tone = 'surface', style, ...rest }: Props) {
  return <View style={[styles.card, { backgroundColor: backgrounds[tone] }, style]} {...rest} />;
}

const backgrounds = {
  surface: colors.surface,
  current: colors.currentCard,
  quiet: colors.surfaceQuiet,
};

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
});
