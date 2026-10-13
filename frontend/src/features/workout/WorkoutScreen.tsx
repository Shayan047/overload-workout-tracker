import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useSync } from '@/api/AppProviders';
import { useSettings } from '@/api/settings';
import { useExercises } from '@/api/splits';
import { type LastSession, useLastSessions } from '@/api/workouts';
import { BottomSheet, Button, IconButton, Separator, Text, useFrameInsets } from '@/components';
import { CheckIcon, ChevronDownIcon, CloudOffIcon, GhostIcon, MoreIcon, PlusIcon } from '@/components/icons';
import { bestSetText } from '@/features/today/today';
import { equipmentLabel, type Exercise } from '@/lib/exercises';
import { formatWeight, fromKg, type Unit } from '@/lib/units';
import { isReviewMode, now } from '@/review/reviewMode';
import { colors, figure, figures, radius } from '@/theme';

import { aheadText, elapsedText, exerciseDelta, ghost, ghostDate, lastTimeText, setText } from './ghost';
import { ChangeExerciseSheet, type ChangeTarget } from './ChangeExerciseSheet';
import { LogSetSheet, type SetTarget } from './LogSetSheet';
import { useWorkoutActions } from './useWorkoutActions';
import {
  afterName,
  currentExercise,
  defaultWeightKg,
  lastPlanned,
  type LoggedSet,
  plannedRows,
  setsFor,
  type WorkoutRow,
} from './workout';
import { inProgress, useActiveWorkout } from './workoutStore';

const sum = (sets: readonly { reps: number }[]) => sets.reduce((total, s) => total + s.reps, 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The weight cell: "20", or for bodyweight exercises "+10" / "BW". */
function weightCell(kg: number | null, unit: Unit, bodyweight: boolean): string {
  if (kg === null) return '–';
  const value = formatWeight(fromKg(kg, unit));
  if (!bodyweight) return value;
  return kg > 0 ? `+${value}` : 'BW';
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Elapsed time from the start timestamp, so it's right after the app was in the background. */
function useElapsed(startedAt: string | undefined): string {
  const [clock, setClock] = useState(now);
  useEffect(() => {
    if (isReviewMode) return;
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return startedAt ? elapsedText(new Date(startedAt), clock) : '0:00';
}

function GhostPanel({ today, last }: { today: LoggedSet[]; last: LastSession }) {
  const result = ghost(today, last.sets);
  const scale = Math.max(result.lastTotal, result.you, 1);
  const bar = (reps: number, color: string) => (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${(reps / scale) * 100}%`, backgroundColor: color }]} />
    </View>
  );
  const note =
    result.sets === 0
      ? `Last time you finished with ${result.lastTotal}.`
      : `Reps through set ${result.sets}. Last time you finished with ${result.lastTotal}.`;
  return (
    <View style={styles.ghost} accessibilityLabel="Ghost: you against last time">
      <View style={styles.ghostHeader}>
        <View style={styles.inline}>
          <GhostIcon color={colors.ghost} size={16} />
          <Text variant="label" color="ghost">
            Ghost: {ghostDate(new Date(last.started_at))}
          </Text>
        </View>
        {result.sets > 0 ? (
          <Text variant="labelHeavy" color={result.delta > 0 ? 'accent' : 'textSecondary'}>
            {aheadText(result.delta, 'reps')}
          </Text>
        ) : null}
      </View>
      <View style={styles.ghostGrid}>
        <View style={styles.ghostRow}>
          <Text variant="label" style={styles.ghostLabel}>
            You
          </Text>
          {bar(result.you, colors.accent)}
          <Text style={[styles.ghostReps, { color: colors.accent }]}>{result.you}</Text>
        </View>
        <View style={styles.ghostRow}>
          <Text variant="label" color="ghost" style={styles.ghostLabel}>
            Last time
          </Text>
          {bar(result.last, colors.ghost)}
          <Text style={[styles.ghostReps, { color: colors.ghost }]}>{result.last}</Text>
        </View>
      </View>
      <Text variant="small" color="textFaint" style={styles.ghostNote}>
        {note}
      </Text>
    </View>
  );
}

/** Active workout (08): finished exercises, the current one with its sets and the ghost,
 * and what's up next. Everything is on the phone, so it works offline. */
export function WorkoutScreen() {
  const { top, bottom } = useFrameInsets();
  const params = useLocalSearchParams<{ sheet?: string }>();
  const saved = inProgress(useActiveWorkout());
  const actions = useWorkoutActions();
  const settings = useSettings();
  const exercises = useExercises();
  const { status } = useSync();
  const elapsed = useElapsed(saved?.state.workout.started_at);
  const [discarding, setDiscarding] = useState(false);

  const rows = saved ? [...saved.state.exercises].filter((e) => e.status !== 'skipped').sort((a, b) => a.position - b.position) : [];
  const lastSessions = useLastSessions(rows.map((r) => r.exercise_id));

  // Nothing to show (finished, or opened without a workout): back to Today.
  useEffect(() => {
    if (!saved) router.replace('/');
  }, [saved]);

  const unit = settings.data?.unit ?? 'lb';
  const ghostMode = settings.data?.ghost_mode ?? true;
  const byId = new Map((exercises.data ?? []).map((e) => [e.id, e]));
  const lastById = new Map((lastSessions.data ?? []).map((s) => [s.exercise_id, s]));
  const state = saved?.state;
  const current = state ? currentExercise(state, { focusId: saved.focusId }) : null;

  const info = (row: WorkoutRow) => {
    const exercise: Exercise | undefined = byId.get(row.exercise_id);
    const last = lastById.get(row.exercise_id);
    return {
      name: exercise?.name ?? 'Exercise',
      bodyweight: exercise?.kind === 'bodyweight',
      equipment: equipmentLabel(exercise?.equipment ?? null),
      last,
      today: state ? setsFor(state, row.id) : [],
    };
  };

  const currentInfo = current ? info(current) : null;
  const planned = current && state ? plannedRows(state, current.id, currentInfo?.last?.sets.length ?? 0) : 0;
  const nextWeightKg = current && state ? defaultWeightKg(state, current.id, currentInfo?.last?.sets ?? []) : null;
  const nextSetNumber = (currentInfo?.today.length ?? 0) + 1;

  const openNext = (field: 'weight' | 'reps') => {
    if (!current) return;
    setTarget({ rowId: current.id, setNumber: nextSetNumber, plannedSets: planned, weightKg: nextWeightKg, reps: null, field });
  };

  // Review: 10 is this screen with Change exercise open on the first exercise up next.
  const [changing, setChanging] = useState<string | null>(() =>
    isReviewMode && params.sheet === 'change'
      ? (rows.find((r) => r.status === 'planned' && r.id !== current?.id)?.id ?? null)
      : null,
  );

  // Review: 09 is this screen with the sheet open on set 3, "6" typed.
  const [target, setTarget] = useState<SetTarget | null>(() =>
    isReviewMode && params.sheet === 'log' && current
      ? { rowId: current.id, setNumber: nextSetNumber, plannedSets: planned, weightKg: nextWeightKg, reps: null, field: 'reps', typedReps: '6' }
      : null,
  );

  if (!saved || !state) return <View style={styles.screen} />;

  const done = rows.filter((r) => r.status === 'done' && r.id !== current?.id);
  const upNext = rows.filter((r) => r.status === 'planned' && r.id !== current?.id);
  const skipped = [...state.exercises].filter((r) => r.status === 'skipped').sort((a, b) => a.position - b.position);
  const anySets = state.sets.length > 0;
  const savingLocally = status.pending > 0 && status.state !== 'sending';

  const finish = async () => {
    if (!anySets) return setDiscarding(true);
    goBack();
    await actions.finish();
  };

  const targetRow = target ? state.exercises.find((e) => e.id === target.rowId) : undefined;
  const targetInfo = targetRow ? info(targetRow) : null;
  const targetLastSet =
    ghostMode && target && targetInfo?.last ? (targetInfo.last.sets.find((s) => s.set_number === target.setNumber) ?? null) : null;

  const changeRow = changing ? state.exercises.find((e) => e.id === changing) : undefined;
  const changeTarget: ChangeTarget | null = (() => {
    if (!changeRow) return null;
    const { name, bodyweight, last, today } = info(changeRow);
    const end = lastPlanned(state);
    const place = changeRow.id === current?.id ? 'Doing now' : 'Up next';
    return {
      rowId: changeRow.id,
      name,
      subtitle: ghostMode && last ? `${place}. Last time ${lastTimeText(last.sets, unit, bodyweight)}` : place,
      hasSets: today.length > 0,
      after: end && end.id !== changeRow.id ? afterName(info(end).name) : null,
    };
  })();
  const pick = (mode: 'swap' | 'add', rowId?: string) => {
    setChanging(null);
    router.push({ pathname: '/pick-exercise', params: rowId ? { mode, rowId } : { mode } });
  };
  const change = (action: (rowId: string) => Promise<void>) => {
    if (!changing) return;
    setChanging(null);
    void action(changing);
  };

  const currentCard = () => {
    if (!current || !currentInfo) return null;
    const { name, bodyweight, equipment, last, today } = currentInfo;
    const lastCount = last?.sets.length ?? 0;
    const subtitle = [equipment, last ? `${plural(lastCount, 'set')} last time` : 'First time'].filter(Boolean).join(', ');
    const lastFor = (n: number) => (ghostMode ? last?.sets.find((s) => s.set_number === n) : undefined);

    return (
      <View style={styles.current} accessibilityLabel="Current exercise">
        <View style={styles.currentHeader}>
          <View style={styles.flex}>
            <Text variant="exerciseTitle" accessibilityRole="header">
              {name}
            </Text>
            <Text variant="small" color="textMuted" style={styles.currentSubtitle}>
              {subtitle}
            </Text>
          </View>
          <MoreButton label={`Change ${name.toLowerCase()} for today`} onPress={() => setChanging(current.id)} />
        </View>

        {ghostMode && last ? <GhostPanel today={today} last={last} /> : null}

        <View style={[styles.grid, styles.gridHeader]}>
          <Text variant="label" color="textFaint" style={styles.colSet}>
            Set
          </Text>
          <Text variant="label" color="textFaint" style={styles.colValue}>
            {bodyweight ? `+${unit}` : unit}
          </Text>
          <Text variant="label" color="textFaint" style={styles.colValue}>
            Reps
          </Text>
          <Text variant="label" color="textFaint" style={styles.colLast}>
            {ghostMode ? 'Last time' : ''}
          </Text>
          <View style={styles.colCheck} />
        </View>

        {Array.from({ length: planned }, (_, i) => {
          const n = i + 1;
          const logged = today[i];
          const lastSet = lastFor(n);
          const lastText = lastSet ? setText(lastSet, unit, bodyweight) : '';
          if (logged) {
            return (
              <Pressable
                key={logged.id}
                accessibilityRole="button"
                accessibilityLabel={`Set ${n}, ${setText(logged, unit, bodyweight)}. Edit`}
                onPress={() =>
                  setTarget({
                    rowId: current.id,
                    setId: logged.id,
                    setNumber: n,
                    plannedSets: planned,
                    weightKg: logged.weight_kg,
                    reps: logged.reps,
                    field: 'reps',
                  })
                }
                style={[styles.grid, styles.setRow]}
              >
                <Text style={[styles.setNumber, styles.colSet, { color: colors.textFaint }]}>{n}</Text>
                <Text style={[styles.setValue, styles.colValue]}>{weightCell(logged.weight_kg, unit, bodyweight)}</Text>
                <Text style={[styles.setValue, styles.colValue]}>{logged.reps}</Text>
                <Text style={[styles.setLast, styles.colLast]} numberOfLines={1}>
                  {lastText}
                </Text>
                <View style={styles.colCheck}>
                  <View style={[styles.check, styles.checkDone]}>
                    <CheckIcon color={colors.onAccent} size={17} strokeWidth={2.6} />
                  </View>
                </View>
              </Pressable>
            );
          }
          if (n === nextSetNumber) {
            return (
              <View key={`next-${n}`} style={[styles.grid, styles.setRow, styles.setRowCurrent]}>
                <Text style={[styles.setNumber, styles.colSet, { color: colors.accent }]}>{n}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Weight for set ${n}, ${weightCell(nextWeightKg, unit, bodyweight)} ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
                  onPress={() => openNext('weight')}
                  style={styles.colValue}
                >
                  <Text style={styles.setValue}>{weightCell(nextWeightKg, unit, bodyweight)}</Text>
                </Pressable>
                <View style={styles.colValue}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Enter reps for set ${n}`}
                    onPress={() => openNext('reps')}
                    style={styles.repsBox}
                  >
                    <Text variant="emptyValue" color="textFaint">
                      –
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.setLast, styles.colLast]} numberOfLines={1}>
                  {lastText}
                </Text>
                <View style={styles.colCheck}>
                  <View style={[styles.check, { borderColor: colors.ring }]} />
                </View>
              </View>
            );
          }
          return (
            <View key={`future-${n}`} style={[styles.grid, styles.setRow]}>
              <Text style={[styles.setNumber, styles.colSet, { color: colors.textFaint }]}>{n}</Text>
              <Text style={[styles.setValue, styles.colValue, { color: colors.textFaint }]}>
                {weightCell(nextWeightKg, unit, bodyweight)}
              </Text>
              <Text variant="emptyValue" color="textFaint" style={styles.colValue}>
                –
              </Text>
              <Text style={[styles.setLast, styles.colLast]} numberOfLines={1}>
                {lastText}
              </Text>
              <View style={styles.colCheck}>
                <View style={[styles.check, { borderColor: colors.borderStrong }]} />
              </View>
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
          onPress={() => void actions.addRow(current.id)}
          style={({ pressed }) => [styles.addSet, pressed && styles.pressed]}
        >
          <PlusIcon color={colors.textSecondary} size={18} />
          <Text variant="smallButton" color="textSecondary">
            Add set
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: 130 + bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Minimize workout" onPress={goBack}>
            <ChevronDownIcon color={colors.text} />
          </IconButton>
          <View style={styles.flex}>
            <Text variant="label" color="textMuted" numberOfLines={1}>
              {state.workout.title}
            </Text>
            <Text style={styles.elapsed} accessibilityLabel={`Elapsed ${elapsed}`}>
              {elapsed}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void finish()}
            style={({ pressed }) => [styles.finish, pressed && styles.finishPressed]}
          >
            <Text variant="bodyHeavy" color="accent">
              Finish
            </Text>
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {rows.map((row) => (
              <View
                key={row.id}
                style={[
                  styles.progressBar,
                  {
                    backgroundColor:
                      row.id === current?.id ? colors.accent : row.status === 'done' ? colors.textSecondary : colors.gridline,
                  },
                ]}
              />
            ))}
          </View>
          {savingLocally ? (
            <View style={styles.inline}>
              <CloudOffIcon color={colors.textFaint} size={15} />
              <Text variant="small" color="textFaint">
                Saving on this phone
              </Text>
            </View>
          ) : null}
        </View>

        {done.length ? (
          <View style={styles.doneList}>
            {done.map((row) => {
              const { name, bodyweight, last, today } = info(row);
              const best = bestSetText(today, { unit, bodyweightKg: state.workout.bodyweight_kg ?? 0, bodyweight });
              const summary = [plural(today.length, 'set'), best ? `best ${best}` : null].filter(Boolean).join(', ');
              const delta = ghostMode && last && today.length ? exerciseDelta(sum(today), sum(last.sets)) : null;
              return (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}, done, ${summary}${delta ? `, ${delta}` : ''}. Open`}
                  onPress={() => void actions.focus(row.id)}
                  style={styles.done}
                >
                  <View style={styles.tick}>
                    <CheckIcon color={colors.text} size={15} strokeWidth={2.6} />
                  </View>
                  <View style={styles.flex}>
                    <Text variant="rowTitle">{name}</Text>
                    <Text variant="small" color="textFaint">
                      {summary}
                    </Text>
                  </View>
                  {delta ? (
                    <Text style={[styles.delta, { color: delta.startsWith('+') ? colors.accent : colors.textMuted }]}>{delta}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {currentCard()}

        {upNext.length ? (
          <>
            <Text variant="label" color="textFaint" style={styles.upNextLabel}>
              Up next
            </Text>
            <View style={styles.upNext}>
              {upNext.map((row, i) => {
                const { name, bodyweight, last } = info(row);
                return (
                  <View key={row.id}>
                    {i > 0 ? <Separator inset={16} /> : null}
                    <View style={styles.upNextRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${name}. Do it now`}
                        onPress={() => void actions.focus(row.id)}
                        style={styles.flex}
                      >
                        <Text variant="rowTitle">{name}</Text>
                        {ghostMode && last ? (
                          <Text variant="small" color="ghost">
                            Last time {lastTimeText(last.sets, unit, bodyweight)}
                          </Text>
                        ) : null}
                      </Pressable>
                      <MoreButton label={`Change ${name.toLowerCase()} for today`} onPress={() => setChanging(row.id)} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {skipped.length ? (
          <>
            <Text variant="label" color="textFaint" style={styles.upNextLabel}>
              Skipped today
            </Text>
            <View style={styles.upNext}>
              {skipped.map((row, i) => (
                <View key={row.id}>
                  {i > 0 ? <Separator inset={16} /> : null}
                  <View style={styles.upNextRow}>
                    <Text variant="rowTitle" color="textFaint" style={styles.flex}>
                      {info(row).name}
                    </Text>
                    <Button title="Undo" variant="text" onPress={() => void actions.restore(row.id)} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {current ? null : (
          <View style={styles.allDone}>
            <Text variant="h2">Every exercise is done</Text>
            <Button title="Add an exercise to today" variant="secondary" onPress={() => pick('add')} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottom - 4 }]}>
        {current ? (
          <Button title={`Log set ${nextSetNumber}`} onPress={() => openNext('reps')} />
        ) : (
          <Button title="Finish workout" onPress={() => void finish()} />
        )}
      </View>

      <LogSetSheet
        target={target}
        exerciseName={targetInfo?.name ?? ''}
        bodyweight={targetInfo?.bodyweight ?? false}
        unit={unit}
        lastSet={targetLastSet}
        onClose={() => setTarget(null)}
        onSave={(weightKg, reps) => {
          if (!target) return;
          setTarget(null);
          void actions.logSet({ rowId: target.rowId, setId: target.setId, weightKg, reps, plannedSets: target.plannedSets });
        }}
        onDelete={() => {
          if (!target?.setId) return;
          setTarget(null);
          void actions.deleteSet(target.setId);
        }}
      />

      <ChangeExerciseSheet
        target={changeTarget}
        onClose={() => setChanging(null)}
        onSwap={() => changing && pick('swap', changing)}
        onAdd={() => pick('add')}
        onMove={() => change(actions.moveToEnd)}
        onSkip={() => change(actions.skip)}
        onDone={() => change(actions.markDone)}
      />

      <BottomSheet visible={discarding} onClose={() => setDiscarding(false)} accessibilityLabel="Discard workout">
        <View style={styles.discard}>
          <Text variant="h2">No sets logged yet</Text>
          <Text variant="small" color="textMuted" style={styles.discardNote}>
            Finishing now throws this workout away. Today’s day stays up next.
          </Text>
          <View style={styles.discardActions}>
            <Button
              title="Discard workout"
              onPress={() => {
                setDiscarding(false);
                goBack();
                void actions.discard();
              }}
            />
            <Button title="Keep logging" variant="text" onPress={() => setDiscarding(false)} />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

/** The "…" button that opens Change exercise (10). */
function MoreButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
      <MoreIcon color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pressed: { backgroundColor: colors.surfaceRaised },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  elapsed: { ...figure(figures.elapsed), color: colors.text, marginTop: 2 },
  finish: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceRaised,
  },
  finishPressed: { backgroundColor: colors.surfaceRaisedHover },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginHorizontal: 4,
  },
  progress: { flexDirection: 'row', gap: 4, flex: 1, maxWidth: 220 },
  progressBar: { flex: 1, height: 5, borderRadius: 4 },
  doneList: { gap: 8, marginTop: 18 },
  done: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceQuiet,
  },
  tick: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.gridline,
  },
  delta: { ...figure(figures.exerciseDelta) },
  current: {
    marginTop: 12,
    paddingTop: 16,
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.accentDark,
    backgroundColor: colors.currentCard,
  },
  currentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8 },
  currentSubtitle: { marginTop: 2 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.chip },
  ghost: { marginTop: 14, marginHorizontal: 8, padding: 14, borderRadius: 14, backgroundColor: colors.inset },
  ghostHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ghostGrid: { gap: 6, marginTop: 12 },
  ghostRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ghostLabel: { width: 62 },
  track: { flex: 1, height: 10, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.track },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  ghostReps: { ...figure(figures.ghostReps), width: 28, textAlign: 'right' },
  ghostNote: { marginTop: 10 },
  grid: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gridHeader: { paddingTop: 14, paddingRight: 6, paddingBottom: 6, paddingLeft: 10 },
  colSet: { width: 34 },
  colValue: { flex: 1, flexBasis: 0, minWidth: 0, alignItems: 'flex-start' },
  colLast: { flex: 1.3, flexBasis: 0, minWidth: 0 },
  colCheck: { width: 44, alignItems: 'flex-end' },
  setRow: { height: 56, paddingRight: 6, paddingLeft: 10, borderRadius: radius.setRow },
  setRowCurrent: { backgroundColor: colors.surfaceRaised },
  setNumber: { ...figure(figures.setNumber) },
  setValue: { ...figure(figures.setValue), color: colors.text },
  setLast: { ...figure(figures.setLastTime), color: colors.ghost },
  repsBox: {
    width: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.inset,
  },
  check: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: 1.5,
  },
  checkDone: { borderWidth: 0, backgroundColor: colors.accent },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    height: 44,
    marginTop: 6,
    marginLeft: 4,
    paddingHorizontal: 6,
    borderRadius: radius.setRow,
  },
  upNextLabel: { marginTop: 20, marginHorizontal: 6, marginBottom: 8 },
  upNext: { paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  upNextRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingRight: 4, paddingLeft: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.barBorder,
    backgroundColor: colors.bg,
  },
  allDone: { gap: 14, marginTop: 20, paddingHorizontal: 4 },
  discard: { paddingHorizontal: 6 },
  discardNote: { marginTop: 4 },
  discardActions: { marginTop: 18, gap: 4 },
});
