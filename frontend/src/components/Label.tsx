import { StyleSheet, type TextProps } from 'react-native';

import { colors, type } from '@/theme';

import { Text } from './Text';

/** A field or section label (.label): 13 px, 600, muted. `gap` is the space below it: 10 in
 * 02, 8 in 04. */
export function Label({ gap = 8, style, ...rest }: TextProps & { gap?: 8 | 10 }) {
  return <Text style={[styles.label, { marginBottom: gap }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  label: { ...type.label, color: colors.textMuted },
});
