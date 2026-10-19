import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, radius, type } from '@/theme';

import { Label } from './Label';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** A short line under the field, e.g. "At least 8 characters." */
  hint?: string;
  /** Space between label and field: 8 in 04 (where `.field` is defined), 10 in 02. */
  labelGap?: 8 | 10;
};

/** A labelled text field (.label + .field in the designs). */
export function TextField({ label, hint, labelGap = 8, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Label gap={labelGap} nativeID={`label-${label}`}>
        {label}
      </Label>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`label-${label}`}
        placeholderTextColor={colors.textDisabled}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        style={[styles.field, focused && styles.focused]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
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
  focused: { borderColor: colors.ring },
  hint: { marginTop: 8 },
});
