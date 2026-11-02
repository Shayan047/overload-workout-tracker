import { type ComponentRef, createContext, type RefObject, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Keyboard,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type ScrollView,
  TextInput,
  type View,
} from 'react-native';

/** Room kept under a focused field: its hint line ("At least 8 characters."). */
const BELOW = 40;
/** Let the keyboard's resize settle before measuring. */
const SETTLE_MS = 150;

/** Set by a screen that keeps focused fields in view; TextField calls it on focus. */
export const RevealFocusedContext = createContext<(() => void) | null>(null);

/** Keeps the focused field and the line under it above the keyboard. Android's scroll view
 * only brings the field itself into view, so a hint under it stays hidden. Pass `scroll`
 * and `content` (a view wrapping the scroll view's content); spread the returned handlers
 * on the scroll view and provide `reveal` through RevealFocusedContext. */
export function useRevealFocused(
  scroll: RefObject<ComponentRef<typeof ScrollView> | null>,
  content: RefObject<ComponentRef<typeof View> | null>,
) {
  const viewport = useRef({ y: 0, height: 0 });

  const reveal = useCallback(() => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input || !content.current) return;
      input.measureLayout(
        content.current,
        (_x, y, _width, height) => {
          const { y: top, height: visible } = viewport.current;
          const bottom = y + height + BELOW;
          if (visible && bottom > top + visible) scroll.current?.scrollTo({ y: bottom - visible, animated: true });
        },
        () => {},
      );
    }, SETTLE_MS);
  }, [scroll, content]);

  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', reveal);
    return () => sub.remove();
  }, [reveal]);

  return useMemo(
    () => ({
      reveal,
      scrollProps: {
        onLayout: (event: LayoutChangeEvent) => {
          viewport.current.height = event.nativeEvent.layout.height;
        },
        onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          viewport.current.y = event.nativeEvent.contentOffset.y;
        },
        scrollEventThrottle: 32,
      },
    }),
    [reveal],
  );
}
