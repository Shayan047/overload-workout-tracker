import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components';
import { chart as chartColors, colors, type } from '@/theme';

import { BARS, type Bars, type Fingerprint, PRINT } from './oneWeight';

const svgFont = (style: { fontFamily: string; fontSize: number }) => ({
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
});
const axis = svgFont(type.chartLabel);
const inner = svgFont(type.chartInner);
const total = svgFont(type.chartTotal);
const path = (points: { x: number; y: number }[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');

/** 15: reps per set stacked into one bar per session, lightest shade for set 1. The latest
 * total is amber: it's you. */
export function StackedBarsChart({ chart, description }: { chart: Bars; description: string }) {
  const baseline = chart.ticks[chart.ticks.length - 1];
  return (
    <View>
      <View style={styles.bars} accessible accessibilityRole="image" accessibilityLabel={description}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${BARS.width} ${BARS.height}`}>
          <G stroke={colors.gridline} strokeWidth={1}>
            {chart.ticks.map((t) => (
              <Line
                key={`grid-${t.label}`}
                x1={BARS.left}
                y1={t.y}
                x2={BARS.gridRight}
                y2={t.y}
                stroke={t === baseline ? colors.borderStrong : undefined}
              />
            ))}
          </G>
          {chart.ticks.map((t) => (
            <SvgText key={`tick-${t.label}`} x={22} y={t.y + 4} textAnchor="end" fill={colors.textFaint} {...axis}>
              {t.label}
            </SvgText>
          ))}
          {chart.bars.map((bar) => (
            <G key={`bar-${bar.x}`}>
              {bar.segments.map((s, i) =>
                s.height > 0 ? (
                  <Rect
                    key={`seg-${i}`}
                    x={bar.x - chart.barWidth / 2}
                    y={s.y}
                    width={chart.barWidth}
                    height={s.height}
                    rx={3}
                    fill={chartColors.setShades[s.shade]}
                  />
                ) : null,
              )}
              {bar.segments.map((s, i) =>
                s.showLabel ? (
                  <SvgText key={`in-${i}`} x={bar.x} y={s.labelY} textAnchor="middle" fill={colors.onAccent} {...inner}>
                    {s.reps}
                  </SvgText>
                ) : null,
              )}
              <SvgText x={bar.x} y={bar.totalY} textAnchor="middle" fill={bar.current ? colors.accent : colors.text} {...total}>
                {bar.total}
              </SvgText>
              <SvgText x={bar.x} y={220} textAnchor="middle" fill={bar.current ? colors.text : colors.textFaint} {...axis}>
                {bar.label}
              </SvgText>
            </G>
          ))}
        </Svg>
      </View>
      <View style={styles.legend}>
        {chart.legend.map((label, i) => (
          <View key={label} style={styles.key}>
            <View style={[styles.swatch, { backgroundColor: chartColors.setShades[i] }]} />
            <Text variant="small" color="textMuted">
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** 16: reps by set number. The latest session in amber with dots; earlier ones in ice,
 * fading with age; the gain between the oldest and the latest lightly filled. */
export function FingerprintChart({ chart, description }: { chart: Fingerprint; description: string }) {
  const baseline = chart.ticks[chart.ticks.length - 1];
  return (
    <View>
      <View style={styles.print} accessible accessibilityRole="image" accessibilityLabel={description}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${PRINT.width} ${PRINT.height}`}>
          <G stroke={colors.gridline} strokeWidth={1}>
            {chart.ticks.map((t) => (
              <Line
                key={`grid-${t.label}`}
                x1={PRINT.left}
                y1={t.y}
                x2={PRINT.gridRight}
                y2={t.y}
                stroke={t === baseline ? colors.borderStrong : undefined}
              />
            ))}
          </G>
          {chart.ticks.map((t) => (
            <SvgText key={`tick-${t.label}`} x={28} y={t.y + 4} textAnchor="end" fill={colors.textFaint} {...axis}>
              {t.label}
            </SvgText>
          ))}
          {chart.gain ? (
            <Polygon points={chart.gain.map((p) => `${p.x},${p.y}`).join(' ')} fill={colors.accent} opacity={0.09} />
          ) : null}
          <G fill="none" stroke={colors.ghost} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
            {chart.earlier.map((line, i) => (
              <Path key={`earlier-${i}`} d={path(line.points)} opacity={line.opacity} />
            ))}
          </G>
          <Path
            d={path(chart.latest.points)}
            fill="none"
            stroke={colors.accent}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <G fill={colors.accent} stroke={colors.surface} strokeWidth={2}>
            {chart.latest.points.map((p, i) => (
              <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={5} />
            ))}
          </G>
          {chart.oldestLabel ? (
            <SvgText x={chart.oldestLabel.x} y={chart.oldestLabel.y} textAnchor="end" fill={colors.ghost} {...axis}>
              {chart.oldestLabel.text}
            </SvgText>
          ) : null}
          <SvgText x={chart.latestLabel.x} y={chart.latestLabel.y} textAnchor="end" fill={colors.accent} {...axis}>
            {chart.latestLabel.text}
          </SvgText>
          {chart.xLabels.map((l) => (
            <SvgText key={`x-${l.text}`} x={l.x} y={210} textAnchor={l.anchor} fill={colors.textFaint} {...axis}>
              {l.text}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={styles.latestKey} />
          <Text variant="small" color="textMuted">
            Latest
          </Text>
        </View>
        {chart.earlier.length ? (
          <View style={styles.key}>
            <View style={styles.earlierKey} />
            <Text variant="small" color="textMuted">
              Earlier, fading with age
            </Text>
          </View>
        ) : null}
        {chart.gain ? (
          <View style={styles.key}>
            <View style={styles.gainKey} />
            <Text variant="small" color="textMuted">
              Your gain
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { width: '100%', aspectRatio: BARS.width / BARS.height },
  print: { width: '100%', aspectRatio: PRINT.width / PRINT.height },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 8, marginHorizontal: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  latestKey: { width: 16, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  earlierKey: { width: 16, height: 2, borderRadius: 2, backgroundColor: colors.ghost },
  gainKey: { width: 14, height: 12, borderRadius: 3, backgroundColor: chartColors.gainFill },
});
