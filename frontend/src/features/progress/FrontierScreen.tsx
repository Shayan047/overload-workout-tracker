import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Text as SvgText } from 'react-native-svg';

import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { useExerciseStats, useFrontierAsOf } from '@/api/stats';
import { Chip, IconButton, Separator, Text, useFrameInsets } from '@/components';
import { BackIcon } from '@/components/icons';
import { chart as chartColors, colors, figure, figures, radius, type } from '@/theme';

import { compareOptions, FRONTIER, type FrontierChart, frontierChart } from './frontier';

const axis = { fontFamily: type.chartLabel.fontFamily, fontSize: type.chartLabel.fontSize };
const pointLabel = { fontFamily: type.chartTotal.fontFamily, fontSize: type.chartTotal.fontSize };

/** Rep-weight frontier (17): the most reps at every weight, today's line in amber against an
 * earlier date's in ice, and the next targets that push it. From the stats API, and from the
 * cache when offline. */
export function FrontierScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { top, bottom } = useFrameInsets();
  const stats = useExerciseStats(exerciseId);
  const exercises = useExercises();
  const settings = useSettings();
  const [choice, setChoice] = useState(0);

  const unit = settings.data?.unit ?? 'lb';
  const name = exercises.data?.find((e) => e.id === exerciseId)?.name ?? 'Exercise';
  const options = compareOptions(stats.data?.series ?? []);
  const selected = options[Math.min(choice, options.length - 1)];
  const earlier = useFrontierAsOf(exerciseId, selected?.at);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/exercise/[exerciseId]', params: { exerciseId } });
  };

  const content = () => {
    const data = stats.data;
    if (!data) {
      return (
        <Text color="textMuted" style={styles.message}>
          {stats.isError ? 'This needs a connection the first time. It’s saved on this phone after that.' : 'Loading…'}
        </Text>
      );
    }
    if (!data.frontier.length) {
      return (
        <Text color="textMuted" style={styles.message}>
          Finish a workout with {name.toLowerCase()} to see its frontier.
        </Text>
      );
    }
    const compare = selected && earlier.data ? earlier.data.points : null;
    const chart = frontierChart({ today: data.frontier, compare, unit });
    const description =
      `Frontier of most reps at each weight. Today: ${chart.today.points.map((p) => p.label).join(', ')}.` +
      (chart.compare && selected
        ? ` On ${selected.label}: ${frontierChart({ today: compare!, compare: null, unit }).today.points.map((p) => p.label).join(', ')}.`
        : '');

    return (
      <>
        {options.length ? (
          <View style={styles.compare}>
            <Text variant="label" color="textMuted" style={styles.compareLabel}>
              Compare with
            </Text>
            {options.map((o, i) => (
              <Chip key={o.at} label={o.label} selected={o === selected} onPress={() => setChoice(i)} />
            ))}
          </View>
        ) : null}

        <View style={styles.chartCard}>
          <FrontierPlot chart={chart} unit={unit} description={description} />
          <View style={styles.legend}>
            <View style={styles.key}>
              <View style={styles.todayKey} />
              <Text variant="small" color="textMuted">
                Today
              </Text>
            </View>
            {chart.compare && selected ? (
              <View style={styles.key}>
                <Svg width={16} height={2}>
                  <Line x1={0} y1={1} x2={16} y2={1} stroke={colors.ghost} strokeWidth={2} strokeDasharray="6 4" />
                </Svg>
                <Text variant="small" color="textMuted">
                  {selected.label}
                </Text>
              </View>
            ) : null}
            <View style={styles.key}>
              <View style={styles.areaKey} />
              <Text variant="small" color="textMuted">
                You can already do this
              </Text>
            </View>
            <View style={styles.key}>
              <Svg width={12} height={12}>
                <Circle cx={6} cy={6} r={5.25} fill="none" stroke={colors.textSecondary} strokeWidth={1.5} strokeDasharray="2.5 2.5" />
              </Svg>
              <Text variant="small" color="textMuted">
                Next targets
              </Text>
            </View>
          </View>
        </View>

        <Text variant="note" color="textMuted" style={styles.explain}>
          Each point is the most reps you've done at that weight. When the line moves up or to the right, you got stronger.
        </Text>

        <Text variant="label" color="textFaint" style={styles.targetsLabel}>
          Push the line
        </Text>
        <View style={styles.targets}>
          {chart.targets.map((t, i) => (
            <View key={t.text}>
              {i > 0 ? <Separator inset={16} /> : null}
              <View style={styles.target}>
                <Text style={styles.targetValue}>{t.text}</Text>
                <Text variant="small" color="textMuted" style={styles.flex}>
                  {t.note}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel={`Back to ${name.toLowerCase()}`} onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <View style={styles.flex}>
            <Text variant="h1Compact" accessibilityRole="header" numberOfLines={1}>
              Rep-weight frontier
            </Text>
            <Text variant="small" color="textMuted" numberOfLines={1}>
              {name}
            </Text>
          </View>
        </View>
        {content()}
      </ScrollView>
    </View>
  );
}

/** The chart: amber for today's frontier (you), dashed ice for the earlier one (your past
 * self), dashed outlines for the next targets. */
function FrontierPlot({ chart, unit, description }: { chart: FrontierChart; unit: string; description: string }) {
  return (
    <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={description}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${FRONTIER.width} ${FRONTIER.height}`}>
        <G stroke={colors.gridline} strokeWidth={1}>
          {chart.yTicks.map((t) => (
            <Line key={`grid-${t.label}`} x1={FRONTIER.left} y1={t.y} x2={FRONTIER.right} y2={t.y} />
          ))}
          <Line x1={FRONTIER.left} y1={FRONTIER.bottom} x2={FRONTIER.right} y2={FRONTIER.bottom} stroke={colors.borderStrong} />
          <Line x1={FRONTIER.left} y1={FRONTIER.top} x2={FRONTIER.left} y2={FRONTIER.bottom} stroke={colors.borderStrong} />
        </G>
        {chart.yTicks.map((t) => (
          <SvgText key={`y-${t.label}`} x={32} y={t.y + 4} textAnchor="end" fill={colors.textFaint} {...axis}>
            {t.label}
          </SvgText>
        ))}
        {chart.xTicks.map((t) => (
          <SvgText key={`x-${t.label}`} x={t.x} y={238} textAnchor={t.anchor} fill={colors.textFaint} {...axis}>
            {t.label}
          </SvgText>
        ))}
        <SvgText x={4} y={10} fill={colors.textFaint} {...axis}>
          {unit}
        </SvgText>

        <Polygon points={chart.today.area} fill={colors.accent} opacity={0.1} />
        {chart.compare ? (
          <Path
            d={chart.compare.path}
            fill="none"
            stroke={colors.ghost}
            strokeWidth={2}
            strokeDasharray={chartColors.pastDash.join(' ')}
            strokeLinejoin="round"
          />
        ) : null}
        <Path d={chart.today.path} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {chart.compare?.points.map((p) => (
          <G key={`then-${p.label}`}>
            <Circle cx={p.x} cy={p.y} r={5} fill={colors.bg} stroke={colors.ghost} strokeWidth={2} />
            <SvgText x={p.labelX} y={p.labelY} textAnchor={p.anchor} fill={colors.ghost} {...pointLabel}>
              {p.label}
            </SvgText>
          </G>
        ))}
        {chart.targets.map((t) => (
          <Circle
            key={`target-${t.text}`}
            cx={t.x}
            cy={t.y}
            r={6}
            fill="none"
            stroke={colors.textSecondary}
            strokeWidth={1.5}
            strokeDasharray="2.5 2.5"
          />
        ))}
        <G fill={colors.accent} stroke={colors.surface} strokeWidth={2.5}>
          {chart.today.points.map((p) => (
            <Circle key={`now-${p.label}`} cx={p.x} cy={p.y} r={6} />
          ))}
        </G>
        {chart.today.points.map((p) => (
          <SvgText key={`now-label-${p.label}`} x={p.labelX} y={p.labelY} textAnchor={p.anchor} fill={colors.accent} {...pointLabel}>
            {p.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  message: { marginTop: 24 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  compareLabel: { marginRight: 2 },
  chartCard: {
    marginTop: 14,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  frame: { width: '100%', aspectRatio: FRONTIER.width / FRONTIER.height },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8, marginTop: 10, marginHorizontal: 4 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 6, flexBasis: '40%', flexGrow: 1 },
  todayKey: { width: 16, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  areaKey: { width: 14, height: 12, borderRadius: 3, backgroundColor: chartColors.gainFill },
  explain: { marginTop: 14, marginHorizontal: 4 },
  targetsLabel: { marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  targets: { paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  target: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16 },
  targetValue: { ...figure(figures.frontierTarget), width: 78, color: colors.text },
});
