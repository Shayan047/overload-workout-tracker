import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components';
import { ArrowDownIcon, CheckIcon, InfoIcon, PlusIcon, SkipIcon, SwapIcon } from '@/components/icons';
import { colors, radius } from '@/theme';

export type ChangeTarget = {
  rowId: string;
  name: string;
  /** "Up next. Last time 25 × 9, 8, 7" (ice: it's about last time). */
  subtitle: string;
  /** Sets are logged: swap and skip give way to "Done for today". */
  hasSets: boolean;
  /** The planned exercise it would go after, or null when it's already last. */
  after: string | null;
};

type Props = {
  target: ChangeTarget | null;
  onSwap: () => void;
  onMove: () => void;
  onSkip: () => void;
  onDone: () => void;
  onAdd: () => void;
  onClose: () => void;
};

function Action({
  icon,
  title,
  detail,
  primary = false,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={[styles.badge, primary && styles.badgePrimary]}>{icon}</View>
      <View style={styles.actionText}>
        <Text variant="h2">{title}</Text>
        <Text variant="small" color="textMuted">
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

/** Change an exercise for today (10). Every action changes this workout only (rule 6). */
export function ChangeExerciseSheet({ target, onSwap, onMove, onSkip, onDone, onAdd, onClose }: Props) {
  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      accessibilityLabel={target ? `Change ${target.name.toLowerCase()} for today` : 'Change exercise'}
    >
      {target ? (
        <View style={styles.content}>
          <View style={styles.header}>
            <Text variant="exerciseTitle" accessibilityRole="header">
              {target.name}
            </Text>
            <Text variant="small" color="ghost" style={styles.subtitle}>
              {target.subtitle}
            </Text>
          </View>

          <View style={styles.note}>
            <View style={styles.noteIcon}>
              <InfoIcon color={colors.textMuted} size={18} />
            </View>
            <Text variant="small" color="textMuted" style={styles.noteText}>
              Changes here apply to today's workout only. Your split stays the same.
            </Text>
          </View>

          {target.hasSets ? null : (
            <Action
              icon={<SwapIcon color={colors.text} />}
              title="Swap for another exercise"
              detail="Search the library or pick a similar one"
              onPress={onSwap}
            />
          )}
          {target.after ? (
            <Action
              icon={<ArrowDownIcon color={colors.text} />}
              title="Move to the end"
              detail={`Do it after ${target.after}`}
              onPress={onMove}
            />
          ) : null}
          {target.hasSets ? (
            <Action
              icon={<CheckIcon color={colors.text} />}
              title="Done for today"
              detail="Stop here with the sets you've logged"
              onPress={onDone}
            />
          ) : (
            <Action
              icon={<SkipIcon color={colors.text} />}
              title="Skip today"
              detail="It's still in your split next time"
              onPress={onSkip}
            />
          )}
          <View style={styles.separator} />
          <Action
            icon={<PlusIcon color={colors.onAccent} strokeWidth={2.2} />}
            title="Add an exercise to today"
            detail="Goes to the end of today's list"
            primary
            onPress={onAdd}
          />

          <View style={styles.cancel}>
            <Button title="Cancel" variant="secondary" size="sheet" onPress={onClose} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // The handle's gap below is 16 here (12 in BottomSheet).
  content: { marginTop: 4 },
  header: { paddingHorizontal: 6 },
  subtitle: { marginTop: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.inset,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  badge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.setRow,
    backgroundColor: colors.surfaceRaised,
  },
  badgePrimary: { backgroundColor: colors.accent },
  actionText: { flex: 1 },
  separator: { height: 1, marginVertical: 6, marginHorizontal: 10, backgroundColor: colors.line },
  cancel: { marginTop: 14 },
});
