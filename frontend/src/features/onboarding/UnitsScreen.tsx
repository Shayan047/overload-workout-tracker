import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useLogBodyweight } from '@/api/bodyweight';
import { useUpdateSettings } from '@/api/settings';
import {
  Button,
  IconButton,
  Label,
  Notice,
  SegmentedControl,
  Text,
  useFrameInsets,
} from '@/components';
import { BackIcon, ClockIcon } from '@/components/icons';
import { convertInput, formatWeight, fromKg, parseBodyweight, type Unit } from '@/lib/units';
import { isReviewMode } from '@/review/reviewMode';
import { sampleUser } from '@/review/sampleData';
import { colors, figure, figures, NUMBER_TRACKING } from '@/theme';

const UNITS = [
  { value: 'lb', label: 'Pounds (lb)' },
  { value: 'kg', label: 'Kilograms (kg)' },
] as const;

/** Units and bodyweight (02), onboarding step 1. Saved through the outbox, so it works
 * before the account exists: the writes go out right after sign-up. */
export function UnitsScreen() {
  const { top, bottom } = useFrameInsets();
  const updateSettings = useUpdateSettings();
  const logBodyweight = useLogBodyweight();
  const [unit, setUnit] = useState<Unit>(isReviewMode ? sampleUser.unit : 'lb');
  const [weight, setWeight] = useState(
    isReviewMode ? formatWeight(fromKg(sampleUser.bodyweightKg, sampleUser.unit)) : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changeUnit = (next: Unit) => {
    setWeight(convertInput(weight, unit, next));
    setUnit(next);
    setError(null);
  };

  const save = async () => {
    const parsed = parseBodyweight(weight, unit);
    if (!parsed.ok) return setError(parsed.message);
    setSaving(true);
    await updateSettings({ unit });
    await logBodyweight(parsed.value, unit);
    router.push({ pathname: '/pick-split', params: { mode: 'onboarding' } });
    setSaving(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom + 2 }]}
      >
        <View style={styles.header}>
          <IconButton
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
          >
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="small" color="textFaint">
            Step 1 of 2
          </Text>
        </View>

        <Text variant="h1" accessibilityRole="header" style={styles.title}>
          Your units
        </Text>
        <Text variant="lead" color="textMuted" style={styles.subtitle}>
          You can change these any time in your profile.
        </Text>

        <View style={styles.unitSection}>
          <Label gap={10} nativeID="unit-label">
            Weight unit
          </Label>
          <SegmentedControl
            accessibilityLabel="Weight unit"
            options={UNITS}
            value={unit}
            onChange={changeUnit}
            tone="light"
            height={52}
          />
        </View>

        <View style={styles.weightSection}>
          <Label gap={10}>Your bodyweight</Label>
          <View style={styles.weightBox}>
            <TextInput
              accessibilityLabel={`Your bodyweight in ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
              value={weight}
              onChangeText={(text) => {
                setWeight(text);
                setError(null);
              }}
              keyboardType="decimal-pad"
              maxLength={5}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              returnKeyType="done"
              onSubmitEditing={save}
              style={styles.weightInput}
            />
            <Text variant="unitSuffix" color="textMuted">
              {unit}
            </Text>
          </View>
          <Text variant="note" color="textMuted" style={styles.weightNote}>
            Pull-ups, dips and other bodyweight exercises use this plus any weight you add, so the
            whole load counts toward your progress.
          </Text>
        </View>

        <View style={styles.info}>
          <View style={styles.infoIcon}>
            <ClockIcon color={colors.ghost} />
          </View>
          <Text variant="note" color="textMuted" style={styles.infoText}>
            Update it whenever it changes. Each workout keeps the bodyweight from that day, so older
            sets never shift.
          </Text>
        </View>

        {error ? (
          <View style={styles.error}>
            <Notice message={error} />
          </View>
        ) : null}

        <View style={styles.spacer} />
        <Button title="Continue" size="medium" onPress={save} disabled={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 28 },
  subtitle: { marginTop: 10, maxWidth: 320 },
  unitSection: { marginTop: 36 },
  weightSection: { marginTop: 32 },
  weightBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  weightInput: {
    ...figure(figures.bodyweight, NUMBER_TRACKING),
    width: 150,
    padding: 0,
    color: colors.text,
    includeFontPadding: false,
  },
  weightNote: { marginTop: 14 },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceQuiet,
  },
  infoIcon: { marginTop: 1 },
  infoText: { flex: 1 },
  error: { marginTop: 16 },
  spacer: { flexGrow: 1, minHeight: 24 },
});
