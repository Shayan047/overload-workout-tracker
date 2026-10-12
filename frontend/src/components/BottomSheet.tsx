import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/theme';
import { isReviewMode } from '@/review/reviewMode';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Read by screen readers when the sheet opens, e.g. "Log set 3 of bicep curl". */
  accessibilityLabel: string;
  children: ReactNode;
};

const CLOSED = 600; // off-screen offset; the sheet is never taller than this from its top

/** Bottom sheet for logging a set (09) and changing an exercise (10). Tap the scrim or drag
 * down to close. Built on React Native's Modal and Animated, so it needs no extra library. */
export function BottomSheet({ visible, onClose, accessibilityLabel, children }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const offset = useRef(new Animated.Value(visible ? 0 : CLOSED)).current;
  const scrim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    if (isReviewMode) {
      offset.setValue(visible ? 0 : CLOSED);
      scrim.setValue(visible ? 1 : 0);
      if (!visible) setMounted(false);
      return;
    }
    Animated.parallel([
      Animated.spring(offset, {
        toValue: visible ? 0 : CLOSED,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }),
      Animated.timing(scrim, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [offset, scrim, visible]);

  const drag = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1) onClose();
        else Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrim }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.sheet,
          { paddingBottom: Math.max(30, insets.bottom), transform: [{ translateY: offset }] },
        ]}
        {...drag.panHandlers}
      >
        <View style={styles.handle} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    backgroundColor: colors.surface,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 4,
    marginBottom: 12,
    alignSelf: 'center',
    backgroundColor: colors.borderStrong,
  },
});
