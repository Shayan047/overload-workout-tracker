import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, type } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: keyof typeof type;
  color?: keyof typeof colors;
};

/** Text in an Archivo instance and a theme color. Use this instead of React Native's Text. */
export function Text({ variant = 'body', color = 'text', style, ...rest }: TextProps) {
  return <RNText style={[type[variant], { color: colors[color] }, style]} {...rest} />;
}
