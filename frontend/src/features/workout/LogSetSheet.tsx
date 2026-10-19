import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, IconButton, Text } from '@/components';
import { BackspaceIcon, CloseIcon, GhostIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { formatRest } from '@/lib/exercises';
import { formatWeight, fromKg, toKg, type Unit } from '@/lib/units';
import { colors, figure, figures, radius } from '@/theme';

import { aheadText, applyKey, type KeyField, setText } from './ghost';

/** The set being logged or edited. */
export type SetTarget = {
  rowId: string;
  /** Set when editing a logged set. */
  setId?: string;
  setNumber: number;
  plannedSets: number;
  /** What the fields start at. */
  weightKg: number | null;
  reps: number | null;
  field: 'weight' | 'reps';
  /** Review mode: reps already typed. */
  typedReps?: string;
};

type Props = {
  target: SetTarget | null;
  exerciseName: string;
  bodyweight: boolean;
  unit: Unit;
  /** Last time's set with the same number; null without one or with ghost mode off. */
  lastSet: { set_number: number; weight_kg: number; reps: number } | null;
  /** The rest that saving starts; 0 when it starts none (editing a set). */
  restSeconds: number;
  onSave: (weightKg: number, reps: number) => void;
  onDelete: () => void;
  onClose: () => void;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];

/** Weight steppers move by 2.5 lb or 1 kg. */
const STEP: Record<Unit, number> = { lb: 2.5, kg: 1 };

const weightField = (kg: number | null, unit: Unit): KeyField => ({
  text: kg === null ? '' : formatWeight(fromKg(kg, unit)),
  fresh: true,
});

/** Log a set (09): weight and reps on a keypad, with last time's set beside them. */
export function LogSetSheet(props: Props) {
  const { target, exerciseName, onClose } = props;
  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      accessibilityLabel={target ? `Log set ${target.setNumber} of ${exerciseName.toLowerCase()}` : 'Log a set'}
    >
      {/* Keyed by the set, so each opening starts from that set's values. */}
      {target ? <SetForm key={`${target.rowId}:${target.setId ?? target.setNumber}`} {...props} target={target} /> : null}
    </BottomSheet>
  );
}

function SetForm({
  target,
  exerciseName,
  bodyweight,
  unit,
  lastSet,
  restSeconds,
  onSave,
  onDelete,
  onClose,
}: Props & { target: SetTarget }) {
  const [weight, setWeight] = useState<KeyField>(() => weightField(target.weightKg, unit));
  const [reps, setReps] = useState<KeyField>(() =>
    target.typedReps !== undefined
      ? { text: target.typedReps, fresh: false }
      : { text: target.reps === null ? '' : String(target.reps), fresh: true },
  );
  const [active, setActive] = useState<'weight' | 'reps'>(target.field);

  const press = (key: string) => {
    if (active === 'weight') setWeight((field) => applyKey(field, key, 'weight'));
    else setReps((field) => applyKey(field, key, 'reps'));
  };

  const step = (direction: 1 | -1) => {
    const value = Math.max(0, (Number(weight.text) || 0) + direction * STEP[unit]);
    setWeight({ text: formatWeight(value), fresh: true });
  };

  const weightValue = Number(weight.text || '0');
  const repsValue = reps.text === '' ? null : Number(reps.text);
  const canSave = repsValue !== null && Number.isFinite(weightValue);
  const delta = lastSet && repsValue !== null ? repsValue - lastSet.reps : null;
  const unitLabel = `${bodyweight ? 'Added weight' : 'Weight'}, ${unit}`;

  const caret = <View style={styles.caret} />;
  const title = `Set ${target.setNumber} of ${Math.max(target.plannedSets, target.setNumber)}`;

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="exerciseTitle" accessibilityRole="header">
            {exerciseName}
          </Text>
          <Text variant="small" color="textMuted">
            {title}
          </Text>
        </View>
        <IconButton accessibilityLabel="Close" tone="raised" onPress={onClose}>
          <CloseIcon color={colors.text} />
        </IconButton>
      </View>

      {lastSet ? (
        <View style={styles.lastTime}>
          <View style={styles.lastTimeText}>
            <GhostIcon color={colors.ghost} size={18} />
            <Text variant="label" color="ghost">
              Last time
            </Text>
            <Text style={styles.lastTimeSet}>{setText(lastSet, unit, bodyweight)}</Text>
          </View>
          {delta !== null ? (
            <View style={styles.pill}>
              <Text variant="labelHeavy" color="accentLight">
                {aheadText(delta, 'short')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.fields}>
        <View style={[styles.field, active === 'weight' && styles.fieldActive]}>
          {/* The whole card selects the field; the steppers sit on top as their own buttons. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unitLabel}: ${weight.text || '0'}`}
            accessibilityState={{ selected: active === 'weight' }}
            onPress={() => setActive('weight')}
            style={StyleSheet.absoluteFill}
          />
          <Text variant="label" color={active === 'weight' ? 'accent' : 'textMuted'} pointerEvents="none">
            {unitLabel}
          </Text>
          <View style={styles.stepRow} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Decrease weight by ${STEP[unit]} ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
              onPress={() => step(-1)}
              style={({ pressed }) => [styles.step, pressed && styles.keyPressed]}
            >
              <MinusIcon color={colors.text} size={18} />
            </Pressable>
            <View style={styles.value} pointerEvents="none">
              <Text style={styles.entry} numberOfLines={1} adjustsFontSizeToFit>
                {weight.text || '0'}
              </Text>
              {active === 'weight' ? caret : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Increase weight by ${STEP[unit]} ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
              onPress={() => step(1)}
              style={({ pressed }) => [styles.step, pressed && styles.keyPressed]}
            >
              <PlusIcon color={colors.text} size={18} />
            </Pressable>
          </View>
          <Text variant="small" color="textFaint" style={styles.hint} pointerEvents="none">
            {active === 'weight' ? 'Typing' : `Steps of ${STEP[unit]}`}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reps: ${reps.text || 'none yet'}`}
          accessibilityState={{ selected: active === 'reps' }}
          onPress={() => setActive('reps')}
          style={[styles.field, active === 'reps' && styles.fieldActive]}
        >
          <Text variant="label" color={active === 'reps' ? 'accent' : 'textMuted'}>
            Reps
          </Text>
          <View style={[styles.stepRow, styles.value, styles.repsRow]}>
            {reps.text ? <Text style={styles.entry}>{reps.text}</Text> : null}
            {active === 'reps' ? caret : <Text style={[styles.entry, styles.entryEmpty]}>–</Text>}
          </View>
          <Text variant="small" color="textFaint" style={styles.hint}>
            {active === 'reps' ? 'Typing' : 'Tap to type'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.keypad}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === '.' ? 'Decimal point' : key === 'delete' ? 'Delete' : key}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            {key === 'delete' ? <BackspaceIcon color={colors.text} /> : <Text variant="key">{key}</Text>}
          </Pressable>
        ))}
      </View>

      <View style={styles.save}>
        <Button
          title={target.setId ? 'Save changes' : 'Save set'}
          disabled={!canSave}
          onPress={() => canSave && onSave(toKg(weightValue, unit), repsValue)}
        />
      </View>
      {target.setId ? <Button title="Delete set" variant="text" onPress={onDelete} /> : null}
      {restSeconds > 0 ? (
        <Text variant="small" color="textFaint" style={styles.restNote}>
          Saving starts your {formatRest(restSeconds)} rest timer.
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 4 },
  headerText: { flex: 1 },
  lastTime: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.inset,
  },
  lastTimeText: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastTimeSet: { ...figure(figures.sheetLastTime), color: colors.ghost },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.chip, backgroundColor: colors.accentSoftBg },
  fields: { flexDirection: 'row', gap: 10, marginTop: 12 },
  field: {
    flex: 1,
    minWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.gridline,
    backgroundColor: colors.inset,
  },
  fieldActive: { borderColor: colors.accent },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginTop: 8 },
  step: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceRaised,
  },
  value: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 1 },
  entry: { ...figure(figures.entry), color: colors.text },
  entryEmpty: { color: colors.textFaint },
  repsRow: { height: 40 },
  caret: { width: 2, height: 34, borderRadius: 2, backgroundColor: colors.accent },
  hint: { marginTop: 6, textAlign: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  key: {
    // Three to a row: (100% − two 8 px gaps) ÷ 3.
    flexBasis: '30%',
    flexGrow: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.setRow,
    backgroundColor: colors.surfaceRaised,
  },
  keyPressed: { backgroundColor: colors.surfaceRaisedHover },
  save: { marginTop: 14 },
  restNote: { marginTop: 10, textAlign: 'center' },
});
