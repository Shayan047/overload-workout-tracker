import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { colors, radius } from '@/theme';
import { isReviewMode } from '@/review/reviewMode';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

const WIDTH = 52;
const HEIGHT = 32;
const PADDING = 3;
const KNOB = HEIGHT - PADDING * 2;
const TRAVEL = WIDTH - KNOB - PADDING * 2;

/** The settings switch (19): amber when on. Drawn 52 × 32, touchable over 44 px. */
export function Switch({ value, onValueChange, accessibilityLabel, disabled }: Props) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (isReviewMode) {
      position.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(position, { toValue: value ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [position, value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? colors.accent : colors.track }]}
    >
      <Animated.View
        style={[
          styles.knob,
          { backgroundColor: value ? colors.onAccent : colors.textFaint },
          { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }] },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: WIDTH, height: HEIGHT, padding: PADDING, borderRadius: radius.chip },
  knob: { width: KNOB, height: KNOB, borderRadius: radius.chip },
});
