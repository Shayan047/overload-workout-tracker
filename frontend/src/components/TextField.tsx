import { useContext, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, radius, type } from '@/theme';

import { EyeIcon, EyeOffIcon } from './icons';
import { RevealFocusedContext } from './revealFocused';
import { Label } from './Label';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** A short line under the field, e.g. "At least 8 characters." */
  hint?: string;
  /** Space between label and field: 8 in 04 (where `.field` is defined), 10 in 02. */
  labelGap?: 8 | 10;
};

/** A labelled text field (.label + .field in the designs). With `secureTextEntry` it's a
 * password field: never capitalized or corrected, with a button to show what's typed. */
export function TextField({ label, hint, labelGap = 8, secureTextEntry, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const revealFocused = useContext(RevealFocusedContext);
  const password = !!secureTextEntry;
  return (
    <View>
      <Label gap={labelGap} nativeID={`label-${label}`}>
        {label}
      </Label>
      <View>
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={`label-${label}`}
          placeholderTextColor={colors.textDisabled}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[styles.field, password && styles.withToggle, focused && styles.focused]}
          onFocus={(event) => {
            setFocused(true);
            revealFocused?.();
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...(password ? ({ autoCapitalize: 'none', autoCorrect: false, spellCheck: false } as const) : null)}
          {...rest}
          secureTextEntry={password && !revealed}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((shown) => !shown)}
            style={styles.toggle}
          >
            {revealed ? <EyeOffIcon color={colors.textMuted} /> : <EyeIcon color={colors.textMuted} />}
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text variant="small" color="textFaint" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 52,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    color: colors.text,
    ...type.field,
  },
  withToggle: { paddingRight: 52 },
  focused: { borderColor: colors.ring },
  // 44 px target, centred in the 52 px field.
  toggle: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { marginTop: 8 },
});
