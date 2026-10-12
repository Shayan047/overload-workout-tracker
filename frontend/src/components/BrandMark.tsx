import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { colors, font } from '@/theme';

import { Text } from './Text';

/** The Overload mark and wordmark (01): last time's bars in ice, today's in amber. */
export function BrandMark() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Overload">
      <Svg width={28} height={28} viewBox="0 0 28 28">
        <Rect x={2} y={9} width={4.5} height={10} rx={1.5} fill={colors.ghostDeep} />
        <Rect x={8.5} y={4} width={4.5} height={20} rx={1.5} fill={colors.accent} />
        <Rect x={15} y={4} width={4.5} height={20} rx={1.5} fill={colors.accent} />
        <Rect x={21.5} y={9} width={4.5} height={10} rx={1.5} fill={colors.ghostDeep} />
      </Svg>
      <Text style={styles.word}>Overload</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { ...font(750, 80), fontSize: 20, lineHeight: 28, letterSpacing: 0.2 },
});
