import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useBodyweightEntries, useLogBodyweight } from '@/api/bodyweight';
import { useSettings } from '@/api/settings';
import { BottomSheet, Button, Chip, IconButton, Separator, Text, TextField, useFrameInsets } from '@/components';
import { BackIcon } from '@/components/icons';
import { formatWeight, fromKg, parseBodyweight } from '@/lib/units';
import { now } from '@/review/reviewMode';
import { colors, figure, figures, radius, type } from '@/theme';

import { BW_CHART, bodyweightChart, byDay, changeText, entryDate, inRange, RANGES, type RangeKey } from './bodyweight';

const RECENT = 4;
const axis = { fontFamily: type.chartLabel.fontFamily, fontSize: type.chartLabel.fontSize };

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
}

/** Bodyweight (20): the latest weight, its trend over a range, recent entries, and logging
 * today's. Each workout keeps its own copy (rule 3), so logging never changes old ones. */
export function BodyweightScreen() {
  const { top, bottom } = useFrameInsets();
  const today = now();
  const entries = useBodyweightEntries();
  const settings = useSettings();
  const log = useLogBodyweight();
  const [range, setRange] = useState<RangeKey>('3m');
  const [logging, setLogging] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const unit = settings.data?.unit ?? 'lb';
  const all = byDay(entries.data ?? []);
  const latest = all[all.length - 1];
  const shown = inRange(all, range, today);
  const value = (kg: number) => fromKg(kg, unit).toFixed(1);

  const open = () => {
    setText(latest ? formatWeight(fromKg(latest.weight_kg, unit)) : '');
    setError(null);
    setLogging(true);
  };
  const save = async () => {
    const parsed = parseBodyweight(text, unit);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setLogging(false);
    await log(parsed.value, unit);
  };

  const content = () => {
    if (!latest) {
      return (
        <Text color="textMuted" style={styles.message}>
          {entries.isPending && !entries.data ? 'Loading…' : 'Log your bodyweight to see it here.'}
        </Text>
      );
    }
    const chart = shown.length ? bodyweightChart(shown, unit, today) : null;
    const when = (iso: string) => (entryDate(iso, today) === 'Today' ? 'today' : `on ${entryDate(iso, today)}`);
    const description = shown.length
      ? `Bodyweight went from ${value(shown[0].weight_kg)} ${unit} ${when(shown[0].measured_on)} to ${value(latest.weight_kg)} ${unit} ${when(latest.measured_on)}.`
      : '';
    return (
      <>
        <View style={styles.big}>
          <Text style={styles.bigValue}>{value(latest.weight_kg)}</Text>
          <Text variant="unitSuffix" color="textMuted">
            {unit}
          </Text>
        </View>
        {shown.length ? (
          <Text color="textMuted" style={styles.change}>
            {changeText(shown[0], latest, unit)}
          </Text>
        ) : null}

        <View style={styles.chips}>
          {RANGES.map((r) => (
            <Chip key={r.key} label={r.label} selected={r.key === range} onPress={() => setRange(r.key)} />
          ))}
        </View>

        {chart ? (
          <View style={styles.chartCard}>
            <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={description}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${BW_CHART.width} ${BW_CHART.height}`}>
                <G stroke={colors.gridline} strokeWidth={1}>
                  {chart.ticks.map((t, i) => (
                    <Line
                      key={`grid-${t.label}`}
                      x1={BW_CHART.left}
                      y1={t.y}
                      x2={BW_CHART.gridRight}
                      y2={t.y}
                      stroke={i === chart.ticks.length - 1 ? colors.borderStrong : undefined}
                    />
                  ))}
                </G>
                {chart.ticks.map((t) => (
                  <SvgText key={`tick-${t.label}`} x={24} y={t.y + 4} textAnchor="end" fill={colors.textFaint} {...axis}>
                    {t.label}
                  </SvgText>
                ))}
                {chart.points.length > 1 ? (
                  <Path
                    d={chart.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}
                    fill="none"
                    stroke={colors.textSecondary}
                    strokeWidth={2.2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                <G fill={colors.textSecondary}>
                  {chart.points.slice(0, -1).map((p, i) => (
                    <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={2.5} />
                  ))}
                </G>
                {(() => {
                  const last = chart.points[chart.points.length - 1];
                  return <Circle cx={last.x} cy={last.y} r={5.5} fill={colors.accent} stroke={colors.surface} strokeWidth={2.5} />;
                })()}
                {chart.xLabels.map((l) => (
                  <SvgText
                    key={`x-${l.text}`}
                    x={l.x}
                    y={148}
                    textAnchor={l.anchor}
                    fill={l.current ? colors.text : colors.textFaint}
                    {...axis}
                  >
                    {l.text}
                  </SvgText>
                ))}
              </Svg>
            </View>
          </View>
        ) : null}

        <View style={styles.list}>
          {[...all]
            .reverse()
            .slice(0, RECENT)
            .map((e, i) => {
              const date = entryDate(e.measured_on, today);
              return (
                <View key={e.id}>
                  {i > 0 ? <Separator inset={16} /> : null}
                  <View style={styles.row}>
                    <Text color={date === 'Today' ? 'text' : 'textMuted'}>{date}</Text>
                    <Text style={styles.rowValue}>{value(e.weight_kg)}</Text>
                  </View>
                </View>
              );
            })}
        </View>

        <Text variant="small" color="textFaint" style={styles.note}>
          Each workout keeps your bodyweight from that day, so chin-ups and dips you logged before never change.
        </Text>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom - 2 }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back to profile" onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="h1Small" accessibilityRole="header">
            Bodyweight
          </Text>
        </View>
        {content()}
        <View style={styles.spacer} />
        <Button title="Log bodyweight" onPress={open} />
      </ScrollView>

      <BottomSheet visible={logging} onClose={() => setLogging(false)} accessibilityLabel="Log bodyweight">
        <View style={styles.sheet}>
          <Text variant="h2">Log bodyweight</Text>
          <Text variant="small" color="textMuted">
            Today's weight. Logging again today replaces it.
          </Text>
          <View style={styles.field}>
            <TextField
              label={`Bodyweight (${unit})`}
              value={text}
              onChangeText={(t) => {
                setText(t);
                setError(null);
              }}
              keyboardType="decimal-pad"
              autoFocus
              hint={error ?? undefined}
              onSubmitEditing={() => void save()}
            />
          </View>
          <Button title="Save" onPress={() => void save()} />
          <Button title="Cancel" variant="text" onPress={() => setLogging(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  message: { marginTop: 24 },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 20 },
  bigValue: { ...figure(figures.bodyweightNow), color: colors.text },
  change: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chartCard: { marginTop: 14, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface },
  frame: { width: '100%', aspectRatio: BW_CHART.width / BW_CHART.height },
  list: { marginTop: 12, paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, paddingHorizontal: 16 },
  rowValue: { ...figure(figures.bodyweightRow), color: colors.text },
  note: { marginTop: 12, marginHorizontal: 4 },
  spacer: { flex: 1, minHeight: 24 },
  sheet: { gap: 8, paddingHorizontal: 6 },
  field: { marginTop: 10, marginBottom: 6 },
});
