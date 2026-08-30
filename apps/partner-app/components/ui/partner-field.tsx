import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerField({
  label,
  error,
  helper,
  ...inputProps
}: ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  helper?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel || label}
        style={[styles.input, inputProps.editable === false && styles.disabled, error && styles.inputError, inputProps.style]}
        placeholderTextColor={inputProps.placeholderTextColor || '#9AA3B2'}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.label },
  input: {
    minHeight: partnerTheme.control.fieldHeight,
    borderRadius: partnerTheme.radius.md,
    paddingHorizontal: 14,
    color: partnerTheme.colors.ink,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
    ...partnerTheme.typography.body,
  },
  disabled: { backgroundColor: partnerTheme.colors.surfaceMuted, color: partnerTheme.colors.inkMuted },
  inputError: { borderColor: '#E6A6A0' },
  error: { marginTop: 5, color: partnerTheme.colors.danger, ...partnerTheme.typography.caption },
  helper: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
});
