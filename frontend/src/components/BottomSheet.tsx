import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/theme';
import { isReviewMode } from '@/review/reviewMode';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Read by screen readers when the sheet opens, e.g. "Log set 3 of bicep curl". */
  accessibilityLabel: string;
  /** The sheet has a text field, so it must stay above the keyboard. Such a sheet is drawn
   * inside the screen instead of in a Modal: Android doesn't move a Modal's content for the
   * keyboard, and only the screen's window reports it. Render it as the last child of the
   * screen's root view. */
  avoidKeyboard?: boolean;
  children: ReactNode;
};

const CLOSED = 600; // off-screen offset; the sheet is never taller than this from its top
const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

function useKeyboardOpen(enabled: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const subs = [
      Keyboard.addListener(SHOW, () => setOpen(true)),
      Keyboard.addListener(HIDE, () => setOpen(false)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [enabled]);
  return enabled && open;
}

/** Bottom sheet for logging a set (09) and changing an exercise (10). Tap the scrim or drag
 * the handle down to close. Built on React Native's Modal and Animated, so it needs no extra library. */
export function BottomSheet({ visible, onClose, accessibilityLabel, avoidKeyboard = false, children }: Props) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const offset = useRef(new Animated.Value(visible ? 0 : CLOSED)).current;
  const scrim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const keyboardOpen = useKeyboardOpen(avoidKeyboard && mounted);

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

  // A Modal closes on Android's back button by itself (onRequestClose); the in-screen sheet
  // has to listen for it.
  useEffect(() => {
    if (!avoidKeyboard || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [avoidKeyboard, visible, onClose]);

  // Only the handle strip at the top drags the sheet. On the whole sheet, a tap whose finger
  // drifted a few points down (common on a keypad) became a drag and the tap was lost.
  const drag = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1) onClose();
        else Animated.spring(offset, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  const layers = (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrim }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </Animated.View>
      <KeyboardAvoidingView
        behavior="padding"
        enabled={avoidKeyboard}
        pointerEvents="box-none"
        style={[styles.frame, { paddingTop: insets.top }]}
      >
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            {
              // Above the keyboard, the navigation bar space isn't needed.
              paddingBottom: keyboardOpen ? 16 : Math.max(30, insets.bottom + 16),
              transform: [{ translateY: offset }],
            },
          ]}
        >
          <View style={styles.grab} {...drag.panHandlers}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );

  if (avoidKeyboard) return mounted ? <View style={styles.layer}>{layers}</View> : null;
  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {layers}
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 10, elevation: 10 },
  scrim: { backgroundColor: colors.scrim },
  frame: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  sheet: {
    flexShrink: 1,
    paddingHorizontal: 16,
    borderTopLeftRadius: radius.sheetTop,
    borderTopRightRadius: radius.sheetTop,
    backgroundColor: colors.surface,
  },
  // The drag strip: the sheet's 10 px top padding, the handle and the 12 px under it, full width.
  grab: { marginHorizontal: -16, paddingTop: 10, paddingBottom: 12, alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 4, backgroundColor: colors.borderStrong },
});
