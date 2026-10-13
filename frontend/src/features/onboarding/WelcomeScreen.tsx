import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/api/AppProviders';
import { BrandMark, Button, Text, useFrameInsets } from '@/components';
import { GhostIcon } from '@/components/icons';
import { colors, figure, figures, figureTimes, NUMBER_TRACKING, type SetFigureSize } from '@/theme';

/** "20 × 6": a set as the designs write it, in the number face, with a light raised "×". */
function SetFigure({
  weight,
  reps,
  figureSize: { size, timesSize, timesGap, timesRaise },
  color,
}: {
  weight: number;
  reps: number;
  figureSize: SetFigureSize;
  color: string;
}) {
  const number = [figure(size, NUMBER_TRACKING), styles.figure, { color }];
  return (
    <View style={styles.setRow} accessible accessibilityLabel={`${weight} pounds times ${reps} reps`}>
      <Text style={number}>{weight}</Text>
      <Text
        style={[
          styles.times,
          { ...figureTimes(timesSize, size), marginHorizontal: timesGap, color },
          { transform: [{ translateY: -timesRaise }] },
        ]}
      >
        ×
      </Text>
      <Text style={number}>{reps}</Text>
    </View>
  );
}

/** Welcome (01): last time's set against today's, and the two ways in. */
export function WelcomeScreen() {
  const { top, bottom } = useFrameInsets();
  const { beginOnboarding } = useAuth();

  return (
    <View style={[styles.screen, { paddingTop: top + 16, paddingBottom: bottom + 2 }]}>
      <BrandMark />

      <View style={styles.hero}>
        <View style={styles.block}>
          <View style={styles.caption}>
            <GhostIcon color={colors.ghost} size={16} />
            <Text variant="small" color="textFaint">
              Last time
            </Text>
          </View>
          <SetFigure weight={20} reps={6} figureSize={figures.welcomeLastTime} color={colors.ghostDeep} />
        </View>
        <View style={styles.rule} />
        <View style={styles.block}>
          <Text variant="label" style={styles.today}>
            Today
          </Text>
          <SetFigure weight={20} reps={7} figureSize={figures.welcomeToday} color={colors.accent} />
        </View>
        <Text variant="small" color="textFaint" style={styles.note}>
          Bicep curl, set 1. Pounds × reps.
        </Text>
      </View>

      <Text variant="display" accessibilityRole="header">
        Beat your last set.
      </Text>
      <Text variant="lead" color="textMuted" style={styles.subtitle}>
        Log every set, see exactly what you did last time, and watch your strength climb at every weight.
      </Text>
      <View style={styles.actions}>
        <Button
          title="Get started"
          size="medium"
          onPress={async () => {
            await beginOnboarding();
            router.push('/units');
          }}
        />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, backgroundColor: colors.bg },
  hero: { flex: 1, justifyContent: 'center' },
  block: { gap: 6, paddingLeft: 2 },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'baseline' },
  figure: { includeFontPadding: false },
  times: { includeFontPadding: false },
  rule: { height: 2, width: 96, marginVertical: 22, marginLeft: 2, backgroundColor: colors.gridline },
  today: { color: colors.accent },
  note: { marginTop: 14, marginLeft: 2 },
  subtitle: { marginTop: 12, marginBottom: 28, maxWidth: 320 },
  actions: { gap: 12 },
});
