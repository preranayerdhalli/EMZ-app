import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, type TextInputProps } from 'react-native';
import { colors, borderRadius, spacing, typography, fonts } from '@/constants/theme';

type Props = {
  label?: string;
  hint?: string;
  error?: string;
} & TextInputProps;

export function TextField({ label, hint, error, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const showError = Boolean(error);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        style={[
          styles.input,
          focused && styles.focused,
          showError && styles.error,
          style as any,
        ]}
        placeholderTextColor={colors.ink.placeholder}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
      {showError ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: typography.micro.fontSize,
    lineHeight: typography.micro.lineHeight,
    fontFamily: fonts.bodyMedium,
    letterSpacing: typography.micro.letterSpacing,
    textTransform: typography.micro.textTransform,
    color: colors.ink.tertiary,
  },
  input: {
    height: 52,
    borderRadius: borderRadius.input,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.bodyRegular,
    color: colors.ink.primary,
    backgroundColor: colors.control.fieldBg,
    borderWidth: 1,
    borderColor: colors.control.fieldBorder,
  },
  focused: {
    borderColor: colors.control.fieldFocus,
  },
  error: {
    borderColor: 'rgba(232,83,74,0.55)',
  },
  hint: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: colors.ink.tertiary,
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontFamily: fonts.bodyLight,
    color: colors.danger,
  },
});
