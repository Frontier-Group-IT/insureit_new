import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TEAL = '#80CBC4';
const dayOnly = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDate = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function PartnerPolicyCalendarDialog({ visible, value, onCancel, onConfirm }: {
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [draft, setDraft] = useState(() => dayOnly(value));
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const [yearMode, setYearMode] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setDraft(dayOnly(value));
    setMonth(new Date(value.getFullYear(), value.getMonth(), 1));
    setYearMode(false);
  }, [visible, value.getFullYear(), value.getMonth(), value.getDate()]);
  const cells = useMemo(() => {
    const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= count ? day : null;
    });
  }, [month]);
  const changeMonth = (step: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + step, 1));
  const yearChoices = Array.from({ length: 201 }, (_, i) => 1900 + i);
  return <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Dismiss calendar" onPress={onCancel} />
      <View style={styles.dialog} accessibilityViewIsModal>
        <View style={styles.header}>
          <Pressable onPress={() => setYearMode(!yearMode)} accessibilityRole="button" accessibilityLabel="Choose calendar year">
            <Text style={styles.year}>{draft.getFullYear()}</Text>
          </Pressable>
          <Text style={styles.heading}>{draft.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
        </View>
        {yearMode ? <ScrollView style={styles.years} contentContainerStyle={styles.yearGrid}>
          {yearChoices.map(year => <Pressable key={year} style={[styles.yearCell, year === draft.getFullYear() && styles.selectedYear]}
            onPress={() => {
              const selected = new Date(year, draft.getMonth(), Math.min(draft.getDate(), new Date(year, draft.getMonth() + 1, 0).getDate()));
              setDraft(selected);
              setMonth(new Date(year, selected.getMonth(), 1));
              setYearMode(false);
            }}>
            <Text style={[styles.yearText, year === draft.getFullYear() && styles.selectedText]}>{year}</Text>
          </Pressable>)}
        </ScrollView> : <>
          <View style={styles.monthRow}>
            <Pressable accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} hitSlop={12}><Ionicons name="chevron-back" size={22} color="#FFFFFF" /></Pressable>
            <Text style={styles.monthText}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
            <Pressable accessibilityLabel="Next month" onPress={() => changeMonth(1)} hitSlop={12}><Ionicons name="chevron-forward" size={22} color="#FFFFFF" /></Pressable>
          </View>
          <View style={styles.weekdays}>{DAYS.map((day, index) => <Text key={index} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.days}>{cells.map((day, index) => {
            const candidate = day ? new Date(month.getFullYear(), month.getMonth(), day) : null;
            const selected = candidate ? sameDate(candidate, draft) : false;
            return <View key={index} style={styles.dayCell}>{candidate ? <Pressable
              accessibilityRole="button" accessibilityLabel={candidate.toDateString()} accessibilityState={{ selected }}
              onPress={() => setDraft(candidate)}
              style={[styles.dayButton, selected && styles.selectedDay]}>
              <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day}</Text>
            </Pressable> : null}</View>;
          })}</View>
        </>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}><Text style={styles.actionText}>CANCEL</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onConfirm(draft)} hitSlop={8}><Text style={styles.actionText}>OK</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  dialog: { width: '100%', maxWidth: 368, backgroundColor: '#424242', elevation: 12, overflow: 'hidden' },
  header: { backgroundColor: '#555555', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24 },
  year: { fontSize: 16, color: '#C5C5C5', fontWeight: '600' },
  heading: { fontSize: 34, color: '#FFFFFF', fontWeight: '700', marginTop: 2 },
  monthRow: { height: 66, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  weekdays: { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 8 },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 12, color: '#BDBDBD' },
  days: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, minHeight: 264 },
  dayCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: TEAL },
  dayText: { fontSize: 13, color: '#FFFFFF' },
  selectedDayText: { color: '#173C3B', fontWeight: '700' },
  years: { height: 284 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 14 },
  yearCell: { width: '25%', alignItems: 'center', paddingVertical: 12, borderRadius: 6 },
  selectedYear: { backgroundColor: TEAL },
  yearText: { color: '#FFFFFF', fontSize: 13 },
  selectedText: { color: '#173C3B', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 40, paddingHorizontal: 30, paddingTop: 18, paddingBottom: 22 },
  actionText: { fontSize: 14, color: TEAL, fontWeight: '600' },
});
