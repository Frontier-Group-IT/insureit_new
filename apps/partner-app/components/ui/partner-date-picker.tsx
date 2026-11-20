import { formatAppDate } from '@/lib/indian-date';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { partnerSelectionHaptic } from '@/lib/partner-haptics';
import { partnerTheme } from '@/lib/theme';

type PartnerDatePickerProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  /** Opt in to immediate iOS day selection without the shared Done button. */
  directSelect?: boolean;
  /** Dark month-grid calendar used only by Business trend custom range. */
  calendarVariant?: 'default' | 'dark';
};

export function PartnerDatePicker({ label, value, onChange, minimumDate, maximumDate, disabled = false, directSelect = false, calendarVariant = 'default' }: PartnerDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date((value ?? new Date()).getFullYear(), (value ?? new Date()).getMonth(), 1, 12));
  const displayValue = useMemo(() => value
    ? formatAppDate(value)
    : 'Select date', [value]);

  const openPicker = () => {
    if (disabled || Platform.OS === 'web') return;
    void partnerSelectionHaptic();
    setVisibleMonth(new Date((value ?? new Date()).getFullYear(), (value ?? new Date()).getMonth(), 1, 12));
    setOpen(true);
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) {
      if (Platform.OS === 'android') setOpen(false);
      return;
    }
    // Only this screen opts in; all other date pickers retain their behavior.
    if (Platform.OS === 'android' || directSelect) setOpen(false);
    onChange(selected);
  };

  const calendarCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const offset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0, 12).getDate();
    return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= days ? new Date(year, month, day, 12) : null;
    });
  }, [visibleMonth]);
  const isOutsideRange = (day: Date) =>
    (minimumDate && new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() <
      new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()).getTime()) ||
    (maximumDate && new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() >
      new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate()).getTime());

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayValue}`}
        accessibilityHint={Platform.OS === 'web' ? 'Native date selection is available in the Partner mobile app.' : 'Opens the date calendar.'}
        disabled={disabled || Platform.OS === 'web'}
        onPress={openPicker}
        style={({ pressed }) => [styles.control, disabled && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{displayValue}</Text>
        <Ionicons name="calendar-outline" size={18} color={partnerTheme.colors.brand} />
      </Pressable>

      {open && directSelect ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={styles.calendarOverlay}>
            <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
              accessibilityLabel="Close calendar" onPress={() => setOpen(false)} />
            <View style={[styles.calendarCard, calendarVariant === 'dark' && styles.calendarCardDark]}>
          {calendarVariant === 'dark' ? (
            <View style={styles.darkSelectedHeading}>
              <Text style={styles.darkYear}>{(value ?? visibleMonth).getFullYear()}</Text>
              <Text style={styles.darkSelectedDate}>{(value ?? visibleMonth).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
            </View>
          ) : null}
          <View style={styles.calendarHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month"
              onPress={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1, 12))}
              style={styles.monthButton}><Ionicons name="chevron-back" size={20} color={calendarVariant === 'dark' ? '#FFFFFF' : partnerTheme.colors.brand}/></Pressable>
            <Text style={[styles.monthTitle, calendarVariant === 'dark' && styles.darkMonthTitle]}>{visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month"
              onPress={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1, 12))}
              style={styles.monthButton}><Ionicons name="chevron-forward" size={20} color={calendarVariant === 'dark' ? '#FFFFFF' : partnerTheme.colors.brand}/></Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {['M','T','W','T','F','S','S'].map((weekday, index) =>
              <View key={index} style={styles.dayCell}><Text style={[styles.weekday, calendarVariant === 'dark' && styles.darkWeekday]}>{weekday}</Text></View>)}
            {calendarCells.map((day, index) => {
              const selected = Boolean(day && value && day.getFullYear() === value.getFullYear() &&
                day.getMonth() === value.getMonth() && day.getDate() === value.getDate());
              const outside = day ? Boolean(isOutsideRange(day)) : false;
              return (
                <View key={index} style={styles.dayCell}>
                  {day ? <Pressable accessibilityRole="button"
                    accessibilityLabel={day.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    accessibilityState={{ disabled: outside, selected }}
                    disabled={outside}
                    onPress={() => { void partnerSelectionHaptic(); onChange(day); setOpen(false); }}
                    style={[styles.dayButton, calendarVariant === 'dark' && styles.darkDayButton, selected && (calendarVariant === 'dark' ? styles.darkDaySelected : styles.daySelected)]}>
                    <Text style={[styles.dayText, calendarVariant === 'dark' && styles.darkDayText, outside && styles.dayDisabled, selected && (calendarVariant === 'dark' ? styles.darkDaySelectedText : styles.daySelectedText)]}>{day.getDate()}</Text>
                  </Pressable> : null}
                </View>
              );
            })}
          </View>
            </View>
          </View>
        </Modal>
      ) : open ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' && !directSelect ? (
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
  calendarOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,30,66,0.64)', padding: 18 },
  calendarCard: { width: '100%', maxWidth: 344, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 12 },
  calendarCardDark: { padding: 0, overflow: 'hidden', backgroundColor: '#393939', borderRadius: 6 },
  darkSelectedHeading: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 18, backgroundColor: '#525252' },
  darkYear: { color: '#CECECE', fontSize: 16, fontWeight: '600' },
  darkSelectedDate: { marginTop: 6, color: '#FFFFFF', fontSize: 27, fontWeight: '800' },
  darkMonthTitle: { color: '#FFFFFF', fontSize: 16 },
  darkWeekday: { color: '#D6D6D6' },
  darkDayButton: { width: 36, height: 36, borderRadius: 20 },
  darkDayText: { color: '#FFFFFF', fontSize: 15 },
  darkDaySelected: { backgroundColor: '#79C9C4' },
  darkDaySelectedText: { color: '#122A2A', fontWeight: '800' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 5 },
  monthButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { color: partnerTheme.colors.ink, fontSize: 13, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingBottom: 6 },
  dayCell: { width: '14.2857%', height: 34, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: partnerTheme.colors.inkMuted, fontSize: 11, fontWeight: '700' },
  dayButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  dayText: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '600' },
  dayDisabled: { color: '#B2B9C7' },
  daySelected: { backgroundColor: partnerTheme.colors.brand },
  daySelectedText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { backgroundColor: partnerTheme.colors.surfaceMuted },
});
