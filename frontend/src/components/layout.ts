import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The designs are drawn in a 390 × 844 phone frame whose top padding includes a 44 px status
// bar and whose bottom padding includes a 34 px home indicator. On phones the real safe area
// is used; on the web build (review screenshots), which has none, the frame's is.
const STATUS_BAR = 44;
const HOME_INDICATOR = 34;

/** Top and bottom space to reserve. Add the rest of a design's padding on top of these:
 * e.g. 07's `padding-top: 52px` is `top + 8`, 02's `padding-bottom: 36px` is `bottom + 2`. */
export function useFrameInsets(): { top: number; bottom: number } {
  const insets = useSafeAreaInsets();
  return {
    top: Math.max(insets.top, STATUS_BAR),
    bottom: Math.max(insets.bottom, HOME_INDICATOR),
  };
}
