import type { ReactNode } from 'react';
import { Pressable, type PressableProps, StyleSheet, View } from 'react-native';

import { colors, radius, type } from '@/theme';

import { Text } from './Text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  /** primary: the main action (amber). secondary: outlined. text: a plain text button. */
  variant?: 'primary' | 'secondary' | 'text';
  /** Primary buttons are 56 px (large) or 54 px (medium) tall in the designs. */
  size?: 'large' | 'medium';
  icon?: ReactNode;
};

export function Button({ title, variant = 'primary', size = 'large', icon, disabled, ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && [styles.primary, size === 'medium' && styles.primaryMedium],
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.text,
        pressed && pressedStyles[variant],
        disabled && disabledStyles[variant],
      ]}
      {...rest}
    >
      {icon ? <View>{icon}</View> : null}
      <Text
        style={[
          labels[variant],
          variant === 'primary' && size === 'medium' && styles.labelMedium,
          disabled && { color: colors.textDisabled },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    borderRadius: radius.button,
  },
  primary: { height: 56, backgroundColor: colors.accent },
  primaryMedium: { height: 54 },
  secondary: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  text: { height: 44, backgroundColor: 'transparent' },
  labelMedium: type.buttonMedium,
});

const labels = StyleSheet.create({
  primary: { ...type.button, color: colors.onAccent },
  secondary: { ...type.buttonSecondary, color: colors.text },
  text: { ...type.buttonSecondary, color: colors.textSecondary },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accentPressed },
  secondary: { backgroundColor: colors.surface },
  text: { opacity: 0.7 },
});

const disabledStyles = StyleSheet.create({
  primary: { backgroundColor: colors.surfaceRaised },
  secondary: { borderColor: colors.line },
  text: {},
});
