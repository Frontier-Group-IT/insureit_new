import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

type PartnerFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  labelIcon?: ReactNode;
  error?: string;
  helper?: string;
  rightAccessory?: ReactNode;
};

export const PartnerField = forwardRef<TextInput, PartnerFieldProps>(function PartnerField(
  {
    label,
    labelIcon,
    error,
    helper,
    rightAccessory,
    ...inputProps
  },
  ref,
) {
  const accessibilityHint = error || helper || inputProps.accessibilityHint;
  const accessibilityState = {
    ...inputProps.accessibilityState,
    disabled: inputProps.editable === false,
  };

  return (
    <View>
      <View style={styles.labelRow}>
        {labelIcon ? <View style={styles.labelIcon}>{labelIcon}</View> : null}
        <Text style={[styles.label, labelIcon ? styles.inlineLabel : null]}>{label}</Text>
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          {...inputProps}
          ref={ref}
          accessibilityLabel={inputProps.accessibilityLabel || label}
          accessibilityHint={accessibilityHint}
          accessibilityState={accessibilityState}
          style={[
            styles.input,
            Boolean(rightAccessory) && styles.inputWithAccessory,
            inputProps.editable === false && styles.disabled,
            error && styles.inputError,
            inputProps.style,
          ]}
          placeholderTextColor={inputProps.placeholderTextColor || '#9AA3B2'}
        />
        {rightAccessory ? <View style={styles.rightAccessory}>{rightAccessory}</View> : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  labelIcon: { alignItems: 'center', justifyContent: 'center' },
  label: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.label },
  inlineLabel: { color: partnerTheme.colors.ink },
  inputWrap: { position: 'relative' },
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
  inputWithAccessory: { paddingRight: 52 },
  rightAccessory: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: partnerTheme.colors.surfaceMuted, color: partnerTheme.colors.inkMuted },
  inputError: { borderColor: '#E6A6A0' },
  error: { marginTop: 5, color: partnerTheme.colors.danger, ...partnerTheme.typography.caption },
  helper: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
});
