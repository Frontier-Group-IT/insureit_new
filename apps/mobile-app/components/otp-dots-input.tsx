import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
};

export function OtpDotsInput({ value, onChangeText, disabled = false }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? '');

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => inputRef.current?.focus()}
      style={[styles.shell, disabled && styles.disabled]}
    >
      <View style={styles.cells} pointerEvents="none">
        {digits.map((digit, index) => (
          <View key={index} style={[styles.cell, digit && styles.cellFilled]}>
            <Text style={[styles.dot, digit && styles.digit]}>{digit || '•'}</Text>
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
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { minHeight: 62, borderRadius: 16, borderWidth: 1, borderColor: '#D7E4F4', backgroundColor: '#FFFFFF', justifyContent: 'center', paddingHorizontal: 10, shadowColor: '#0B63CE', shadowOpacity: 0.06, shadowRadius: 10, elevation: 1 },
  disabled: { opacity: 0.64 },
  cells: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  cell: { flex: 1, maxWidth: 46, aspectRatio: 1, borderRadius: 14, backgroundColor: '#F3F7FC', borderWidth: 1, borderColor: '#E0E9F4', alignItems: 'center', justifyContent: 'center' },
  cellFilled: { backgroundColor: '#EEF5FF', borderColor: '#AFCBF4' },
  dot: { color: '#C5CEDA', fontSize: 29, lineHeight: 31, fontWeight: '900' },
  digit: { color: '#071D49', fontSize: 20, lineHeight: 24 },
  hiddenInput: { position: 'absolute', inset: 0, opacity: 0.01, color: 'transparent' },
});
