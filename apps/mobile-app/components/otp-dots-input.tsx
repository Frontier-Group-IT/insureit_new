import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  highlighted?: boolean;
};

export function OtpDotsInput({ value, onChangeText, disabled = false, autoFocus = false, highlighted = false }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: 6 }, (_, index) => Boolean(value[index]));

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => inputRef.current?.focus()}
      style={[styles.shell, highlighted && styles.shellHighlighted, disabled && styles.disabled]}
    >
      <View style={styles.cells} pointerEvents="none">
        {digits.map((filled, index) => (
          <View key={index} style={styles.dotSlot}>
            <View style={[styles.otpDot, filled && styles.otpDotFilled]} />
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(nextValue) => onChangeText(nextValue.replace(/\D/g, '').slice(0, 6))}
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { minHeight: 64, borderRadius: 18, borderWidth: 1, borderColor: '#D7E4F4', backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 20, shadowColor: '#0B63CE', shadowOpacity: 0.06, shadowRadius: 10, elevation: 1 },
  shellHighlighted: { borderColor: '#0A43A3', backgroundColor: '#F6FAFF', shadowOpacity: 0.14, elevation: 3 },
  disabled: { opacity: 0.64 },
  cells: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  dotSlot: { width: 22, height: 30, alignItems: 'center', justifyContent: 'center' },
  otpDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#C6D0DD' },
  otpDotFilled: { width: 15, height: 15, backgroundColor: '#071D49' },
  hiddenInput: { position: 'absolute', inset: 0, opacity: 0.01, color: 'transparent' },
});
