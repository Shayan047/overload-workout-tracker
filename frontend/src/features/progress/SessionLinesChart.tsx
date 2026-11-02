import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { chart as chartColors, colors, type } from '@/theme';

import type { LinesChart, LinesFrame, SessionLine } from './sessionLines';

const label = { fontFamily: type.chartLabel.fontFamily, fontSize: type.chartLabel.fontSize };
const path = (line: SessionLine) => line.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');

/** How a past session's line looks. On 14: the one before today in ice, the one before that
 * dashed in the deeper ice. On 23: ice that fades with age, the picked one in full. */
export function pastLineStyle(age: number, count: number, mode: 'recent' | 'all', picked: boolean) {
  if (mode === 'recent') {
    return age === 1
      ? { color: colors.ghost, width: 2, dash: undefined, dot: 3, opacity: 1 }
      : { color: colors.ghostDeep, width: 2, dash: chartColors.pastDash.join(' '), dot: 2.5, opacity: 1 };
  }
  if (picked) return { color: colors.ghost, width: 2.5, dash: undefined, dot: 3.5, opacity: 1 };
  // The oldest at 0.22, the one before today at 0.7.
  const opacity = count > 2 ? 0.22 + (0.48 * (count - 1 - age)) / (count - 2) : 0.7;
  return { color: colors.ghost, width: 1.5, dash: undefined, dot: 0, opacity };
}

/** Est. max per set, one line per session (14, 23). Today's session is amber, with a large
 * dot on its first set; past sessions are ice (rule 10). */
export function SessionLinesChart({
  chart,
  frame,
  mode,
  pickedId = null,
  description,
}: {
  chart: LinesChart;
  frame: LinesFrame;
  mode: 'recent' | 'all';
  pickedId?: string | null;
  description: string;
}) {
  const latest = chart.lines.find((l) => l.age === 0);
  const past = chart.lines.filter((l) => l.age > 0);
  // The picked line draws above the faded ones, under today's.
  const ordered = [...past.filter((l) => l.workoutId !== pickedId).reverse(), ...past.filter((l) => l.workoutId === pickedId)];
  return (
    <View
      style={{ width: '100%', aspectRatio: frame.width / frame.height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${frame.width} ${frame.height}`}>
        <G stroke={colors.gridline} strokeWidth={1}>
          {chart.ticks.map((t) => (
            <Line key={`grid-${t.label}`} x1={frame.gridLeft} y1={t.y} x2={frame.gridRight} y2={t.y} />
          ))}
        </G>
        {chart.ticks.map((t) => (
          <SvgText key={`tick-${t.label}`} x={26} y={t.y + 4} textAnchor="end" fill={colors.textFaint} {...label}>
            {t.label}
          </SvgText>
        ))}
        {ordered.map((line) => {
          const s = pastLineStyle(line.age, chart.lines.length, mode, line.workoutId === pickedId);
          return (
            <G key={line.workoutId} opacity={s.opacity}>
              <Path
                d={path(line)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.dot ? line.points.map((p, i) => <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={s.dot} fill={s.color} />) : null}
            </G>
          );
        })}
        {latest ? (
          <>
            <Path d={path(latest)} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {latest.points.map((p, i) => (
              <Circle key={`today-${i}`} cx={p.x} cy={p.y} r={3.5} fill={colors.accent} />
            ))}
            <Circle cx={latest.points[0].x} cy={latest.points[0].y} r={6} fill={colors.accent} stroke={colors.surface} strokeWidth={3} />
          </>
        ) : null}
        {chart.xLabels.map((l) => (
          <SvgText key={l.text} x={l.x} y={frame.bottom + 22} textAnchor="middle" fill={colors.textFaint} {...label}>
            {l.text}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

/** The line's key beside a session in the list: amber for the latest, ice for the rest
 * (dashed for the third on 14). */
export function LineKey({ age, mode, picked = false }: { age: number; mode: 'recent' | 'all'; picked?: boolean }) {
  let key;
  if (age === 0) key = <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: colors.accent }} />;
  else if (mode === 'recent' && age > 1) {
    key = (
      <Svg width={18} height={2}>
        <Line x1={0} y1={1} x2={18} y2={1} stroke={colors.ghostDeep} strokeWidth={2} strokeDasharray="5 5" />
      </Svg>
    );
  } else {
    key = (
      <View
        style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: colors.ghost, opacity: mode === 'all' && !picked ? 0.5 : 1 }}
      />
    );
  }
  // A 22 px column, as the designs' lists lay it out.
  return <View style={{ width: 22 }}>{key}</View>;
}
