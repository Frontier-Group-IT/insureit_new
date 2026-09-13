import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getPartnerBusinessRange, type PartnerBusinessRangeSummary } from '@/lib/home';
import { partnerTheme } from '@/lib/theme';

type AppliedRange = { summary: PartnerBusinessRangeSummary; label: string } | null;
type Mode = 'this_month' | 'last_30' | 'custom';

export function PartnerBusinessDateFilterCompat({ onChange }: { onChange: (value: AppliedRange) => void }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('this_month');
  const [fromDate, setFromDate] = useState(startOfMonth(today));
  const [toDate, setToDate] = useState(today);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [label, setLabel] = useState('This Month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = async (nextMode: Mode) => {
    if (loading) return;
    if (nextMode === 'this_month') {
      setMode(nextMode);
      setLabel('This Month');
      setFromDate(startOfMonth(today));
      setToDate(today);
      setError(null);
      onChange(null);
      setOpen(false);
      return;
    }
    if (nextMode === 'last_30') {
      const from = addDays(today, -29);
      await applyRange(from, today, 'Last 30 Days', nextMode);
      return;
    }
    setMode('custom');
    setSelecting('from');
    setVisibleMonth(startOfMonth(fromDate));
  };

  const applyRange = async (from: Date, to: Date, nextLabel: string, nextMode: Mode = 'custom') => {
    if (loading || to < from || daysInclusive(from, to) > 366) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await getPartnerBusinessRange(toDateKey(from), toDateKey(to));
      setFromDate(from);
      setToDate(to);
      setMode(nextMode);
      setLabel(nextLabel);
      onChange({ summary, label: nextLabel });
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this business range.');
    } finally {
      setLoading(false);
    }
  };

  const chooseDay = (date: Date) => {
    if (date > today) return;
    if (selecting === 'from') {
      setFromDate(date);
      if (toDate < date || daysInclusive(date, toDate) > 366) setToDate(date);
      setSelecting('to');
      return;
    }
    if (date < fromDate || daysInclusive(fromDate, date) > 366) return;
    setToDate(date);
  };

  const customReady = toDate >= fromDate && daysInclusive(fromDate, toDate) <= 366;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Business date filter. ${label}`}
        onPress={() => { setError(null); setOpen(true); }}
        style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={16} color={partnerTheme.colors.brand} />
        <Text numberOfLines={1} style={styles.filterText}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={partnerTheme.colors.brand} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.title}>Business date range</Text>
                <Text style={styles.meta}>Choose a preset or a custom range up to 366 days.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close date filter" onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={partnerTheme.colors.inkMuted} />
              </Pressable>
            </View>

            <View style={styles.presets}>
              <Preset label="This Month" active={mode === 'this_month'} onPress={() => void applyPreset('this_month')} />
              <Preset label="Last 30 Days" active={mode === 'last_30'} onPress={() => void applyPreset('last_30')} />
              <Preset label="Custom" active={mode === 'custom'} onPress={() => void applyPreset('custom')} />
            </View>

            {mode === 'custom' ? (
              <>
                <View style={styles.rangeRow}>
                  <DatePill label="From" date={fromDate} active={selecting === 'from'} onPress={() => { setSelecting('from'); setVisibleMonth(startOfMonth(fromDate)); }} />
                  <DatePill label="To" date={toDate} active={selecting === 'to'} onPress={() => { setSelecting('to'); setVisibleMonth(startOfMonth(toDate)); }} />
                </View>
                <Calendar month={visibleMonth} today={today} fromDate={fromDate} toDate={toDate} selecting={selecting} onMonthChange={setVisibleMonth} onChoose={chooseDay} />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apply custom business date range"
                  disabled={!customReady || loading}
                  onPress={() => void applyRange(fromDate, toDate, `${shortDate(fromDate)} – ${shortDate(toDate)}`)}
                  style={({ pressed }) => [styles.applyButton, (!customReady || loading) && styles.disabled, pressed && styles.pressed]}
                >
                  <Text style={styles.applyText}>{loading ? 'Loading…' : 'Apply range'}</Text>
                </Pressable>
              </>
            ) : error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Preset({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && styles.pressed]}><Text style={[styles.presetText, active && styles.presetTextActive]}>{label}</Text></Pressable>;
}

function DatePill({ label, date, active, onPress }: { label: string; date: Date; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.datePill, active && styles.datePillActive]}><Text style={styles.dateLabel}>{label}</Text><Text style={styles.dateValue}>{fullDate(date)}</Text></Pressable>;
}

function Calendar({ month, today, fromDate, toDate, selecting, onMonthChange, onChoose }: { month: Date; today: Date; fromDate: Date; toDate: Date; selecting: 'from' | 'to'; onMonthChange: (date: Date) => void; onChoose: (date: Date) => void }) {
  const days = calendarDays(month);
  const canNext = startOfMonth(month) < startOfMonth(today);
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={() => onMonthChange(addMonths(month, -1))} hitSlop={8}><Ionicons name="chevron-back" size={20} color={partnerTheme.colors.brand} /></Pressable>
        <Text style={styles.monthLabel}>{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(month)}</Text>
        <Pressable disabled={!canNext} onPress={() => onMonthChange(addMonths(month, 1))} hitSlop={8}><Ionicons name="chevron-forward" size={20} color={canNext ? partnerTheme.colors.brand : '#C7CFDA'} /></Pressable>
      </View>
      <View style={styles.weekRow}>{['S','M','T','W','T','F','S'].map((d, i) => <Text key={`${d}-${i}`} style={styles.weekDay}>{d}</Text>)}</View>
      <View style={styles.dayGrid}>
        {days.map((item, index) => {
          if (!item) return <View key={`blank-${index}`} style={styles.dayCell} />;
          const future = item > today;
          const selected = sameDay(item, fromDate) || sameDay(item, toDate);
          const inRange = item >= fromDate && item <= toDate;
          const invalidTo = selecting === 'to' && item < fromDate;
          return (
            <Pressable key={item.toISOString()} disabled={future || invalidTo} onPress={() => onChoose(item)} style={[styles.dayCell, inRange && styles.dayInRange, selected && styles.daySelected]}>
              <Text style={[styles.dayText, (future || invalidTo) && styles.dayDisabled, selected && styles.daySelectedText]}>{item.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function calendarDays(month: Date) {
  const first = startOfMonth(month);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const result: Array<Date | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= count; day += 1) result.push(new Date(first.getFullYear(), first.getMonth(), day));
  while (result.length % 7) result.push(null);
  return result;
}
function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function startOfMonth(value: Date) { return new Date(value.getFullYear(), value.getMonth(), 1); }
function addDays(value: Date, days: number) { const next = new Date(value); next.setDate(next.getDate() + days); return startOfDay(next); }
function addMonths(value: Date, months: number) { return new Date(value.getFullYear(), value.getMonth() + months, 1); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function daysInclusive(a: Date, b: Date) { return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000) + 1; }
function toDateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`; }
function shortDate(value: Date) { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(value); }
function fullDate(value: Date) { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value); }

const styles = StyleSheet.create({
  filterButton: { minHeight: 38, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5F0' },
  filterText: { maxWidth: 190, color: '#17345F', fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,22,46,0.34)' },
  sheet: { maxHeight: '86%', padding: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#FFFFFF' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { color: '#102E62', fontSize: 17, fontWeight: '800' },
  meta: { marginTop: 2, color: '#66758B', fontSize: 10.5, lineHeight: 14 },
  presets: { marginTop: 14, flexDirection: 'row', gap: 7 },
  preset: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F4F7FB', borderWidth: 1, borderColor: '#E0E7F0' },
  presetActive: { backgroundColor: '#EAF3FF', borderColor: '#8DB9F4' },
  presetText: { color: '#596A80', fontSize: 10.5, fontWeight: '700' },
  presetTextActive: { color: '#174F9B' },
  rangeRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  datePill: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: '#DDE6F0', backgroundColor: '#FAFCFF' },
  datePillActive: { borderColor: '#6EA6E8', backgroundColor: '#EEF6FF' },
  dateLabel: { color: '#7A8798', fontSize: 9.5, fontWeight: '600' },
  dateValue: { marginTop: 2, color: '#183760', fontSize: 10.5, fontWeight: '700' },
  calendar: { marginTop: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E1E8F1', backgroundColor: '#FBFCFE' },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { color: '#17345F', fontSize: 12, fontWeight: '800' },
  weekRow: { marginTop: 8, flexDirection: 'row' },
  weekDay: { width: '14.285%', textAlign: 'center', color: '#8A97A8', fontSize: 9, fontWeight: '700' },
  dayGrid: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  dayInRange: { backgroundColor: '#EEF6FF' },
  daySelected: { backgroundColor: '#1767C5' },
  dayText: { color: '#263D5D', fontSize: 10.5, fontWeight: '600' },
  dayDisabled: { color: '#C7CFDA' },
  daySelectedText: { color: '#FFFFFF', fontWeight: '800' },
  applyButton: { marginTop: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#1767C5' },
  applyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  error: { marginTop: 10, color: '#B33A32', fontSize: 10.5, lineHeight: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
});
