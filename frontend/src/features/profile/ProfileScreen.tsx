import { Link, router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth, useSync } from '@/api/AppProviders';
import { useBodyweightEntries } from '@/api/bodyweight';
import { usePendingWorkoutIds, useWorkoutHistory } from '@/api/history';
import { type Settings, useSettings, useUpdateSettings } from '@/api/settings';
import { treeFromDraft, useExercises, useSplitTree } from '@/api/splits';
import { BottomSheet, Button, IconButton, ListRow, Separator, Switch, Text, useFrameInsets } from '@/components';
import { BackIcon, CheckIcon, ChevronRightIcon, CloudOffIcon } from '@/components/icons';
import { exerciseSubtitle } from '@/lib/exercises';
import { formatWeight, fromKg } from '@/lib/units';
import { isReviewMode } from '@/review/reviewMode';
import { sampleSplitDraft } from '@/review/sampleData';
import { colors, radius, type } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const UNITS = [
  { value: 'lb', label: 'Pounds' },
  { value: 'kg', label: 'Kilograms' },
] as const;

type Sheet = 'units' | 'alerts' | 'custom' | null;

function back() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Profile (19): who you are, training settings, and sync. Every setting changes on the
 * phone at once and goes to the server through the outbox. */
export function ProfileScreen() {
  const { top, bottom } = useFrameInsets();
  const { user, signOut } = useAuth();
  const { status } = useSync();
  const settings = useSettings();
  const update = useUpdateSettings();
  const history = useWorkoutHistory();
  const bodyweight = useBodyweightEntries();
  const exercises = useExercises();
  const tree = useSplitTree(settings.data?.active_split_id);
  const pending = usePendingWorkoutIds();
  const [sheet, setSheet] = useState<Sheet>(null);

  const s = settings.data;
  const unit = s?.unit ?? 'lb';
  const set = (change: Partial<Settings>) => void update(change);

  const name = user?.display_name?.trim() || user?.email.split('@')[0] || 'You';
  const workouts = history.data ?? [];
  const first = workouts.length ? new Date(workouts[workouts.length - 1].started_at) : null;
  const since = first
    ? `Training since ${MONTHS[first.getMonth()]} ${first.getFullYear()}, ${workouts.length} ${workouts.length === 1 ? 'workout' : 'workouts'}`
    : 'No workouts yet';

  const latest = [...(bodyweight.data ?? [])].sort((a, b) => a.measured_on.localeCompare(b.measured_on)).pop();
  const split = isReviewMode ? treeFromDraft(sampleSplitDraft) : tree.data;
  const custom = (exercises.data ?? []).filter((e) => e.is_custom);

  const waitingWorkouts = pending.size;
  const syncTitle = waitingWorkouts
    ? `${waitingWorkouts} ${waitingWorkouts === 1 ? 'workout' : 'workouts'} waiting`
    : status.pending
      ? `${status.pending} ${status.pending === 1 ? 'change' : 'changes'} waiting`
      : 'Everything is synced';
  const syncNote = !status.pending
    ? 'Nothing waiting to send'
    : status.state === 'waiting-for-wifi'
      ? `${waitingWorkouts === 1 || (!waitingWorkouts && status.pending === 1) ? 'It syncs' : 'They sync'} next time you're on Wi-Fi`
      : status.state === 'signed-out'
        ? 'They sync once you sign in'
        : "They sync as soon as there's a connection";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: top + 8, paddingBottom: bottom }]}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back" onPress={back}>
            <BackIcon color={colors.text} />
          </IconButton>
          <Text variant="h1Small" accessibilityRole="header">
            Profile
          </Text>
        </View>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text variant="profileName" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="smallInBody" color="textMuted">
              {since}
            </Text>
          </View>
        </View>

        <Text variant="label" color="textFaint" style={styles.groupLabel}>
          Training
        </Text>
        <View style={styles.group}>
          <Row label="Units" value={UNITS.find((u) => u.value === unit)!.label} onPress={() => setSheet('units')} />
          <Separator inset={16} />
          <Row
            label="Bodyweight"
            value={latest ? `${formatWeight(fromKg(latest.weight_kg, unit))} ${unit}` : 'Not set'}
            onPress={() => router.push('/bodyweight')}
          />
          <Separator inset={16} />
          <Row
            label="Current split"
            value={split?.name ?? 'None'}
            onPress={() => router.push(split ? '/splits' : '/pick-split')}
          />
          <Separator inset={16} />
          <Row
            label="Ghost mode"
            note="Show last time's numbers while you log"
            trailing={<Switch value={s?.ghost_mode ?? true} onValueChange={(v) => set({ ghost_mode: v })} accessibilityLabel="Ghost mode" />}
          />
          <Separator inset={16} />
          <Row
            label="Rest timer alerts"
            note="Buzz at 10 seconds left and when rest ends"
            value={s?.rest_alert_sound === false ? 'Sound off' : 'Sound on'}
            onPress={() => setSheet('alerts')}
          />
        </View>

        <Text variant="label" color="textFaint" style={styles.groupLabel}>
          Sync and data
        </Text>
        <View style={styles.group}>
          <Row
            icon={status.pending ? <CloudOffIcon color={colors.textMuted} /> : <CheckIcon color={colors.textMuted} />}
            label={syncTitle}
            note={syncNote}
          />
          <Separator inset={16} />
          <Row
            label="Sync on Wi-Fi only"
            note="Workouts are always saved on this phone first"
            trailing={
              <Switch
                value={s?.sync_wifi_only ?? true}
                onValueChange={(v) => set({ sync_wifi_only: v })}
                accessibilityLabel="Sync on Wi-Fi only"
              />
            }
          />
          <Separator inset={16} />
          <Row label="Custom exercises" value={String(custom.length)} onPress={() => setSheet('custom')} />
        </View>

        <View style={styles.signOut}>
          <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
        </View>
        {__DEV__ ? (
          <Link href="/dev-sync" style={styles.devLink}>
            <Text variant="small" color="textMuted">
              Sync check (development only)
            </Text>
          </Link>
        ) : null}
      </ScrollView>

      <BottomSheet visible={sheet === 'units'} onClose={() => setSheet(null)} accessibilityLabel="Units">
        <View style={styles.sheet}>
          <Text variant="h2">Units</Text>
          <Text variant="small" color="textMuted">
            Weights are kept exactly, so switching never changes what you logged.
          </Text>
          <View style={styles.sheetList}>
            {UNITS.map((u, i) => (
              <View key={u.value}>
                {i > 0 ? <Separator inset={16} /> : null}
                <ListRow
                  label={u.label}
                  accessibilityLabel={u.label}
                  onPress={() => {
                    set({ unit: u.value });
                    setSheet(null);
                  }}
                  trailing={unit === u.value ? <CheckIcon color={colors.text} /> : null}
                />
              </View>
            ))}
          </View>
          <Button title="Close" variant="secondary" size="sheet" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'alerts'} onClose={() => setSheet(null)} accessibilityLabel="Rest timer alerts">
        <View style={styles.sheet}>
          <Text variant="h2">Rest timer alerts</Text>
          <Text variant="small" color="textMuted">
            The phone buzzes at 10 seconds left and when rest ends, even when it's locked.
          </Text>
          <View style={styles.sheetList}>
            <ListRow
              label="Sound"
              trailing={
                <Switch
                  value={s?.rest_alert_sound ?? true}
                  onValueChange={(v) => set({ rest_alert_sound: v })}
                  accessibilityLabel="Rest timer sound"
                />
              }
            />
          </View>
          <Button title="Close" variant="secondary" size="sheet" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'custom'} onClose={() => setSheet(null)} accessibilityLabel="Custom exercises">
        <View style={styles.sheet}>
          <Text variant="h2">Custom exercises</Text>
          <Text variant="small" color="textMuted">
            Only you see these. Make a new one from Add exercises, with "Can't find it?".
          </Text>
          {custom.length ? (
            <View style={styles.sheetList}>
              {custom.map((e, i) => (
                <View key={e.id}>
                  {i > 0 ? <Separator inset={16} /> : null}
                  <View style={styles.customRow}>
                    <Text>{e.name}</Text>
                    <Text variant="small" color="textMuted">
                      {exerciseSubtitle(e)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.sheetGap} />
          )}
          <Button title="Close" variant="secondary" size="sheet" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>
    </View>
  );
}

/** A settings row (.it): 56 px or taller; a value and chevron when it opens something. */
function Row({
  label,
  note,
  value,
  icon,
  trailing,
  onPress,
}: {
  label: string;
  note?: string;
  value?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <>
      {icon}
      <View style={styles.flex}>
        <Text>{label}</Text>
        {note ? (
          <Text variant="smallInBody" color="textMuted">
            {note}
          </Text>
        ) : null}
      </View>
      {value ? <Text color="textMuted">{value}</Text> : null}
      {trailing}
      {onPress ? <ChevronRightIcon color={colors.textFaint} size={18} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceRaised,
  },
  initial: { ...type.h1Compact, letterSpacing: 0, color: colors.text },
  groupLabel: { marginTop: 22, marginBottom: 8, marginHorizontal: 4 },
  group: { paddingVertical: 2, borderRadius: radius.card, backgroundColor: colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
  },
  pressed: { backgroundColor: colors.surfaceHover },
  signOut: { marginTop: 22 },
  devLink: { marginTop: 16, paddingVertical: 12, alignSelf: 'center' },
  sheet: { gap: 4, paddingHorizontal: 6 },
  sheetList: { marginTop: 14, marginBottom: 12, borderRadius: radius.card, backgroundColor: colors.surfaceRaised },
  sheetGap: { height: 12 },
  customRow: { paddingVertical: 10, paddingHorizontal: 18 },
});
