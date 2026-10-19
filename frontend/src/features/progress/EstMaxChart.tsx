import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components';
import { chart as chartColors, colors, type } from '@/theme';

import { type Chart, CHART } from './chart';

const label = { fontFamily: type.chartLabel.fontFamily, fontSize: type.chartLabel.fontSize };
const MIN_BAND_LABEL_WIDTH = 30;

/** The est. max chart on 14: weight bands, gridlines, the line with a dot per session, the
 * latest one large, and the dashed projection. Amber: it's you. */
export function EstMaxChart({ chart, description }: { chart: Chart; description: string }) {
  const last = chart.points[chart.points.length - 1];
  const line = chart.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');
  return (
    <View>
      <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={description}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${CHART.width} ${CHART.height}`}>
          {chart.bands.map((b) => (
            <Rect
              key={`band-${b.x0}`}
              x={b.x0}
              y={CHART.top}
              width={b.x1 - b.x0}
              height={CHART.bottom - CHART.top}
              fill={chartColors.weightBands[b.shade]}
            />
          ))}
          {chart.bands
            .filter((b) => b.x1 - b.x0 >= MIN_BAND_LABEL_WIDTH)
            .map((b) => (
              <SvgText key={`band-label-${b.x0}`} x={b.x0 + 5} y={34} fill={colors.textMuted} {...label}>
                {b.label}
              </SvgText>
            ))}
          <G stroke={colors.gridline} strokeWidth={1}>
            {chart.ticks.map((t) => (
              <Line key={`grid-${t.label}`} x1={CHART.left} y1={t.y} x2={CHART.gridRight} y2={t.y} />
            ))}
          </G>
          {chart.ticks.map((t) => (
            <SvgText key={`tick-${t.label}`} x={24} y={t.y + 4} textAnchor="end" fill={colors.textFaint} {...label}>
              {t.label}
            </SvgText>
          ))}
          {chart.projection ? (
            <>
              <Path
                d={`M${last.x} ${last.y}L${chart.projection.x} ${chart.projection.y}`}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeDasharray={chartColors.projectionDash.join(' ')}
                strokeLinecap="round"
                opacity={0.75}
              />
              <SvgText x={CHART.right} y={chart.projection.y - 9} textAnchor="end" fill={colors.accent} {...label}>
                {chart.projection.label}
              </SvgText>
            </>
          ) : null}
          <Path d={line} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <G fill={colors.accent}>
            {chart.points.slice(0, -1).map((p, i) => (
              <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={2.5} />
            ))}
          </G>
          <Circle cx={last.x} cy={last.y} r={6} fill={colors.accent} stroke={colors.surface} strokeWidth={3} />
          {chart.xLabels.map((l) => (
            <SvgText
              key={`x-${l.text}`}
              x={l.x}
              y={182}
              textAnchor={l.anchor}
              fill={l.current ? colors.text : colors.textFaint}
              {...label}
            >
              {l.text}
            </SvgText>
          ))}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={styles.keyLine} />
          <Text variant="small" color="textMuted">
            Est. max
          </Text>
        </View>
        {chart.projection ? (
          <View style={styles.key}>
            <Svg width={16} height={2}>
              <Line x1={0} y1={1} x2={16} y2={1} stroke={colors.accent} strokeWidth={2} strokeDasharray="6 4" />
            </Svg>
            <Text variant="small" color="textMuted">
              If the trend holds
            </Text>
          </View>
        ) : null}
        {chart.bands.length ? (
          <View style={styles.key}>
            <View style={styles.keyBand} />
            <Text variant="small" color="textMuted">
              Weight used
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: CHART.width / CHART.height },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 10, marginHorizontal: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyLine: { width: 16, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  keyBand: {
    width: 14,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: chartColors.weightBands[1],
  },
});
