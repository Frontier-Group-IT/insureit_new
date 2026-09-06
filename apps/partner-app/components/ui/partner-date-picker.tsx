import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { partnerSelectionHaptic } from '@/lib/partner-haptics';
import { partnerTheme } from '@/lib/theme';

type PartnerDatePickerProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

export function PartnerDatePicker({ label, value, onChange, minimumDate, maximumDate, disabled = false }: PartnerDatePickerProps) {
  const [open, setOpen] = useState(false);
  const displayValue = useMemo(() => value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value)
    : 'Select date', [value]);

  const openPicker = () => {
    if (disabled || Platform.OS === 'web') return;
    void partnerSelectionHaptic();
    setOpen(true);
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !selected) return;
    onChange(selected);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayValue}`}
        accessibilityHint={Platform.OS === 'web' ? 'Native date selection is available in the Partner mobile app.' : 'Opens the system date picker.'}
        disabled={disabled || Platform.OS === 'web'}
        onPress={openPicker}
        style={({ pressed }) => [styles.control, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{displayValue}</Text>
        <Ionicons name="calendar-outline" size={18} color={partnerTheme.colors.brand} />
      </Pressable>

      {open ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  control: {
    minHeight: partnerTheme.control.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
    borderRadius: partnerTheme.radius.lg,
    backgroundColor: partnerTheme.colors.surface,
  },
  value: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  placeholder: { color: partnerTheme.colors.inkMuted },
  pickerWrap: { borderWidth: 1, borderColor: partnerTheme.colors.line, borderRadius: partnerTheme.radius.lg, overflow: 'hidden', backgroundColor: partnerTheme.colors.surface },
  doneButton: { minHeight: partnerTheme.control.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  doneText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.bodyStrong },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: partnerTheme.colors.surfaceMuted },
});
