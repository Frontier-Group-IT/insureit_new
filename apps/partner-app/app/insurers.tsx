import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerInsurerRegister, type PartnerInsurerRegisterRow } from '@/lib/business';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type Metric = 'amounts' | 'premium' | 'payin' | 'retention' | 'payout';
type SortKey = 'amount_desc' | 'amount_asc' | 'policies_desc' | 'policies_asc' | 'name_asc' | 'name_desc' | 'payin_desc' | 'retention_desc';
const FINANCIAL_COLUMN_WIDTH = 118;
const ROW_HEIGHT = 62;

// Display aliases only: never alter the full insurer name used for the RPC,
// logo lookup, searches or accessibility.
const NAME_ALIASES: Array<[RegExp, string]> = [
  [/\bUnited India\b/i, 'United India'],
  [/\bNew India Assurance\b/i, 'New India'],
  [/\bICICI Lombard\b/i, 'ICICI Lombard'],
  [/\bTata AIG\b/i, 'Tata AIG'],
  [/\bGo Digit\b/i, 'Go Digit'],
  [/\bUniversal Sompo\b/i, 'Universal Sompo'],
  [/\bRoyal Sundaram\b/i, 'Royal Sundaram'],
  [/\bHDFC ERGO\b/i, 'HDFC ERGO'],
  [/\bIFFCO.TOKIO\b/i, 'IFFCO-TOKIO'],
  [/\bSBI General\b/i, 'SBI General'],
  [/\bCholamandalam\b/i, 'Chola MS'],
  [/\bShriram\b/i, 'Shriram'],
];
function displayInsurerName(name: string): string {
  const mapped = NAME_ALIASES.find(([pattern]) => pattern.test(name));
  if (mapped) return mapped[1];
  const short = name
    .replace(/^The\s+/i, '')
    .replace(/\b(?:General Insurance|Insurance Company|Insurance|Assurance Company|Assurance|Company|Limited|Ltd\.?|Co\.?)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return short || name;
}

const wholeRupeeFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
function formatInsurerRupees(amount: number | string): string {
  const numericAmount = Number(amount);
  return `₹${wholeRupeeFormatter.format(Number.isFinite(numericAmount) ? numericAmount : 0)}`;
}
function isoLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function getPresetRange(preset: 'mtd' | 'last_month') {
  const today = new Date();
  const from = preset === 'mtd'
    ? new Date(today.getFullYear(), today.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = preset === 'mtd'
    ? today
    : new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: isoLocal(from), to: isoLocal(to) };
}
function validDateRange(from: string, to: string) {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) return false;
  const start = parseLocal(from);
  const end = parseLocal(to);
  return isoLocal(start) === from && isoLocal(end) === to &&
    start.getTime() <= end.getTime() &&
    Math.round((end.getTime() - start.getTime()) / 86400000) <= 366 &&
    end.getTime() <= new Date().getTime();
}
function formatRange(from: string, to: string) {
  const display = (date: string) => parseLocal(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${display(from)} – ${display(to)}`;
}
function metricValue(row: PartnerInsurerRegisterRow, metric: Metric): number | string | null {
  if (metric === 'payin') return row.payin;
  if (metric === 'retention') return row.retention;
  if (metric === 'payout') return row.payout;
  return row.premium;
}

export default function InsurerListScreen() {
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const router = useRouter();
  const { context, cacheScopeKey } = usePartnerSession();
  const employee = context?.identity.actor_kind === 'employee';
  const canViewCommercials = employee && context?.can_view_insurer_commercials === true;
  const initialRange = getPresetRange('mtd');
  const [range, setRange] = useState(() => ({
    from: typeof params.from === 'string' && DATE_PATTERN.test(params.from) ? params.from : initialRange.from,
    to: typeof params.to === 'string' && DATE_PATTERN.test(params.to) ? params.to : initialRange.to,
  }));
  const [draft, setDraft] = useState(range);
  const [dateExpanded, setDateExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('amount_desc');
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = parseLocal(range.from);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const validRange = validDateRange(range.from, range.to);
  const validDraft = validDateRange(draft.from, draft.to);
  const { from, to } = range;

  const fetchInsurers = useCallback(() => {
    if (!validRange) return Promise.resolve([] as PartnerInsurerRegisterRow[]);
    return getPartnerInsurerRegister(from, to);
  }, [from, to, validRange]);

  const query = usePartnerQuery<PartnerInsurerRegisterRow[]>({
    scopeKey: cacheScopeKey,
    key: `business:insurers:range:${from}:${to}`,
    fetcher: fetchInsurers,
    staleTimeMs: 90_000,
  });
  // Amounts aliases premium because the existing RPC has no independent Amount field.
  const columns: Array<{ key: Metric | 'policies'; label: string }> = employee
    ? [{ key: 'policies', label: 'Policies' }, { key: 'amounts', label: 'Amount' }, { key: 'premium', label: 'Net Premium' }, ...(canViewCommercials ? [{ key: 'payin' as const, label: 'Pay-In' }, { key: 'retention' as const, label: 'Retention' }] : [])]
    : [{ key: 'policies', label: 'Policies' }, { key: 'amounts', label: 'Amount' }, { key: 'premium', label: 'Net Premium' }, { key: 'payout', label: 'Payout' }];
  const insurers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const filtered = (query.data ?? []).filter((row) =>
      !term || row.name.toLocaleLowerCase().includes(term) || displayInsurerName(row.name).toLocaleLowerCase().includes(term));
    return [...filtered].sort((left, right) => {
      if (sortKey === 'name_asc') return displayInsurerName(left.name).localeCompare(displayInsurerName(right.name));
      if (sortKey === 'name_desc') return displayInsurerName(right.name).localeCompare(displayInsurerName(left.name));
      if (sortKey === 'policies_asc') return left.policies - right.policies;
      if (sortKey === 'policies_desc') return right.policies - left.policies;
      if (sortKey === 'payin_desc' && canViewCommercials) return Number(right.payin ?? 0) - Number(left.payin ?? 0);
      if (sortKey === 'retention_desc' && canViewCommercials) return Number(right.retention ?? 0) - Number(left.retention ?? 0);
      return sortKey === 'amount_asc'
        ? Number(left.premium ?? 0) - Number(right.premium ?? 0)
        : Number(right.premium ?? 0) - Number(left.premium ?? 0);
    });
  }, [query.data, search, sortKey, canViewCommercials]);

  const openDateRange = () => {
    if (dateExpanded) {
      setDateExpanded(false);
      return;
    }
    setDraft(range);
    setPickerTarget('from');
    const start = parseLocal(range.from);
    setCalendarMonth(new Date(start.getFullYear(), start.getMonth(), 1));
    setDateExpanded(true);
  };
  const selectDate = (day: number) => {
    const selected = isoLocal(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    setDraft((current) => ({ ...current, [pickerTarget]: selected }));
    if (pickerTarget === 'from') setPickerTarget('to');
  };
  const changeMonth = (step: number) => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  };
  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const leading = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return [...Array<null>(leading).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [calendarMonth]);
  const today = new Date();
  const isCurrentMonth = calendarMonth.getFullYear() === today.getFullYear()
    && calendarMonth.getMonth() === today.getMonth();

  return (
    <PartnerScreen title="Insurer-wise Performance" hideTopBar fullWidth
      scrollProps={{ refreshControl: <RefreshControl refreshing={query.refreshing} onRefresh={() => void query.refresh()} /> }}
    >
      <View style={styles.referenceHeader}>
        <View style={styles.headerOrbLarge} />
        <View style={styles.headerOrbSmall} />
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Business"
          onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="bar-chart-outline" size={21} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>BUSINESS PERFORMANCE</Text>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>Insurer-wise Performance</Text>
        </View>
      </View>
      <View style={styles.headerSearchBand}>
        <View style={styles.headerSearch}>
          <Ionicons name="search-outline" size={18} color="#8698AE" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search insurer"
            placeholderTextColor="#94A2B5" autoCapitalize="none" autoCorrect={false}
            accessibilityLabel="Search insurer" style={styles.headerSearchInput} />
          {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear insurer search" onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color="#94A2B5" />
          </Pressable> : null}
        </View>
      </View>

      <View style={styles.dateSection}>
        <Pressable accessibilityRole="button" accessibilityLabel="Date Range"
          accessibilityState={{ expanded: dateExpanded }} onPress={openDateRange}
          style={styles.dateRangeTrigger}>
          <Ionicons name="calendar-outline" size={18} color="#155BB6" />
          <View style={styles.dateRangeCopy}>
            <Text style={styles.dateRangeTitle}>Date Range</Text>
            <Text style={styles.dateRangeValue}>{validRange ? formatRange(from, to) : 'Select a valid reporting range'}</Text>
          </View>
          <Ionicons name={dateExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#155BB6" />
        </Pressable>
        {dateExpanded ? (
          <View style={styles.datePanel}>
            <View style={styles.dateFields}>
              {(['from', 'to'] as const).map((field) => (
                <Pressable key={field} accessibilityRole="button"
                  accessibilityLabel={field === 'from' ? 'Select From Date' : 'Select To Date'}
                  accessibilityState={{ selected: pickerTarget === field }}
                  onPress={() => {
                    setPickerTarget(field);
                    const selected = parseLocal(draft[field]);
                    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
                  }}
                  style={[styles.dateButton, pickerTarget === field && styles.dateButtonActive]}>
                  <Text style={styles.dateButtonLabel}>{field === 'from' ? 'From Date' : 'To Date'}</Text>
                  <Text style={styles.dateButtonText}>{parseLocal(draft[field]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.calendarWrap}>
              <View style={styles.monthRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous month"
                  onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                  <Ionicons name="chevron-back" size={18} color="#155BB6" />
                </Pressable>
                <Text style={styles.monthTitle}>
                  {calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Next month"
                  disabled={isCurrentMonth} onPress={() => changeMonth(1)}
                  style={styles.monthArrow}>
                  <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? '#BDC8D7' : '#155BB6'} />
                </Pressable>
              </View>
              <View style={styles.calendarGrid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <View key={day} style={styles.calendarCell}>
                    <Text style={styles.weekdayText}>{day}</Text>
                  </View>
                ))}
                {calendarCells.map((day, index) => {
                  const value = day == null ? null : isoLocal(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                  const disabled = value != null && value > isoLocal(today);
                  const selected = value != null && value === draft[pickerTarget];
                  const inRange = value != null && value >= draft.from && value <= draft.to;
                  return (
                    <View key={index} style={styles.calendarCell}>
                      {day != null ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={value ?? ''}
                          accessibilityState={{ selected, disabled }} disabled={disabled}
                          onPress={() => selectDate(day)}
                          style={[styles.dayButton, inRange && styles.dayInRange, selected && styles.daySelected]}>
                          <Text style={[styles.dayText, disabled && styles.dayDisabledText,
                            selected && styles.daySelectedText]}>{day}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={styles.dateNote}>Select From and To dates using this calendar (maximum 366 days).</Text>
            {!validDraft ? <Text style={styles.invalidRange}>Choose a valid range: From Date must be on or before To Date, within 366 days.</Text> : null}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setDateExpanded(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={!validDraft}
                onPress={() => { setRange(draft); setDateExpanded(false); }}
                style={[styles.apply, !validDraft && styles.applyDisabled]}>
                <Text style={styles.applyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.registerArea}>
        <View style={styles.rangeRow}>
          <Text style={styles.countText}>{insurers.length} insurers</Text>
        </View>
        <View style={styles.register}>
          <View style={styles.registerContents}>
            <View style={styles.fixedNames}>
              <View style={styles.registerHeader}><Text style={styles.columnTitle}>INSURER</Text></View>
              {!validRange || (query.loading && !query.data) || (query.error && !query.data) ? null
                : insurers.map((insurer) => (
                  <View key={insurer.name} style={styles.tableRow}>
                    <PartnerInsurerLogo name={insurer.name} style={styles.logo} />
                    <Text style={styles.insurerName} numberOfLines={2} ellipsizeMode="tail"
                      accessibilityLabel={insurer.name}>{displayInsurerName(insurer.name)}</Text>
                  </View>
                ))}
            </View>
            <ScrollView horizontal nestedScrollEnabled directionalLockEnabled
              showsHorizontalScrollIndicator
              accessibilityLabel="Swipe financial columns horizontally. Insurer names remain visible.">
              <View>
                <View style={styles.registerHeader}>
                  {columns.map((column) => (
                    <Pressable key={column.key} accessibilityRole="button"
                      accessibilityLabel={`Sort by ${column.label}`}
                      onPress={() => {
                        if (column.key === 'policies') setSortKey('policies_desc');
                        else if (column.key === 'premium' || column.key === 'amounts') setSortKey('amount_desc');
                        else if (column.key === 'payin' && canViewCommercials) setSortKey('payin_desc');
                        else if (column.key === 'retention' && canViewCommercials) setSortKey('retention_desc');
                      }}
                      style={styles.metricHeaderCell}>
                      <Text numberOfLines={2} style={styles.metricHeaderText}>{column.label.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
                {(!validRange || (query.loading && !query.data) || (query.error && !query.data)) ? null
                  : insurers.map((insurer) => (
                    <View key={insurer.name} style={styles.financialRow}>
                      {columns.map((column) => {
                        const amount = column.key === 'policies' ? null : metricValue(insurer, column.key);
                        return (
                          <Text key={column.key} style={styles.metricCell} numberOfLines={1}
                            adjustsFontSizeToFit minimumFontScale={0.75}>
                            {column.key === 'policies' ? insurer.policies :
                              amount == null ? '—' : formatInsurerRupees(amount)}
                          </Text>
                        );
                      })}
                    </View>
                  ))}
              </View>
            </ScrollView>
          </View>
          {!validRange ? <PartnerStateView state="empty" title="Date range unavailable"
            message="Choose a valid range of up to 366 days." />
            : query.loading && !query.data ? <PartnerStateView state="loading" title="Loading insurers" />
            : query.error && !query.data ? <PartnerStateView state="error" title="Insurer list unavailable"
              message={query.error} actionLabel="Try again" onAction={() => void query.refresh()} />
            : !insurers.length ? <Text style={styles.empty}>
                {search.trim() ? 'No insurers match your search.' : 'No insurers found for the selected reporting period.'}
              </Text> : null}
          {query.error && query.data ? <Pressable accessibilityRole="button" onPress={() => void query.refresh()} style={styles.retry}>
            <Text style={styles.retryText}>Refresh failed. Tap to retry.</Text>
          </Pressable> : null}
        </View>
      </View>

    </PartnerScreen>
  );
}

const styles = StyleSheet.create({
  referenceHeader: { marginHorizontal: -16, height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#0860C8' },
  headerOrbLarge: { position: 'absolute', right: -38, top: -52, width: 170, height: 130, borderRadius: 90, backgroundColor: '#0D74E3', opacity: 0.9 },
  headerOrbSmall: { position: 'absolute', right: 95, top: -25, width: 85, height: 85, borderRadius: 45, backgroundColor: '#096BD7', opacity: 0.8 },
  headerIcon: { width: 37, height: 37, borderRadius: 8, backgroundColor: '#FFFFFF25', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: { fontSize: 8.5, color: '#DAEAFF', fontWeight: '800', letterSpacing: 1.1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 23 },
  headerSearchBand: { backgroundColor: '#0860C8', marginHorizontal: -16, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  headerSearch: { backgroundColor: '#FFFFFF', borderRadius: 10, minHeight: 42, paddingHorizontal: 12, alignItems: 'center', flexDirection: 'row', gap: 9 },
  headerSearchInput: { flex: 1, color: '#233D62', fontSize: 12, paddingVertical: 6 },
  dateSection: { marginHorizontal: 10, marginTop: 10, marginBottom: 8 },
  dateRangeTrigger: { minHeight: 54, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F2', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateRangeCopy: { flex: 1, gap: 3 },
  dateRangeTitle: { fontSize: 12, fontWeight: '800', color: '#173D7B' },
  dateRangeValue: { fontSize: 10.5, fontWeight: '600', color: '#667D9C' },
  datePanel: { paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#FFFFFF', borderRadius: 11, marginTop: 7, borderColor: '#DCE6F2', borderWidth: 1 },
  dateFields: { flexDirection: 'row', gap: 9 },
  dateButton: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#DCE6F2', borderRadius: 10, padding: 10, gap: 5 },
  dateButtonActive: { borderColor: '#155BB6', backgroundColor: '#F2F7FF' },
  dateButtonLabel: { fontSize: 10, color: '#667D9C', fontWeight: '700' },
  dateButtonText: { color: '#1F3A64', fontSize: 11, fontWeight: '700' },
  calendarWrap: { marginTop: 12, borderRadius: 10, padding: 6, backgroundColor: '#F8FAFF' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  monthArrow: { minHeight: 38, minWidth: 38, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 15, fontWeight: '800', color: '#173D7B' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.2857%', alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  weekdayText: { fontSize: 10, color: '#718198', fontWeight: '700' },
  dayButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayInRange: { backgroundColor: '#E5F1FF' },
  daySelected: { backgroundColor: '#155BB6' },
  dayText: { fontSize: 12, color: '#243B60', fontWeight: '600' },
  dayDisabledText: { color: '#BCC5D1' },
  daySelectedText: { color: '#FFFFFF', fontWeight: '800' },
  dateNote: { marginTop: 9, fontSize: 10, color: '#718198' },
  invalidRange: { marginTop: 7, color: '#B42318', fontSize: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancel: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#EEF2F7' },
  cancelText: { color: '#526781', fontWeight: '700', fontSize: 12 },
  apply: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#155BB6' },
  applyDisabled: { opacity: 0.45 },
  applyText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  registerArea: { paddingHorizontal: 10, paddingTop: 3, paddingBottom: 18 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 3, marginBottom: 8 },
  countText: { color: '#667D9C', fontSize: 10.5 },
  register: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#DCE6F2', backgroundColor: '#FFFFFF' },
  registerContents: { flexDirection: 'row', alignItems: 'flex-start' },
  fixedNames: { width: 148, borderRightWidth: 1, borderRightColor: '#D8E4F3', backgroundColor: '#FFFFFF' },
  registerHeader: { flexDirection: 'row', alignItems: 'center', height: 42, paddingHorizontal: 8, backgroundColor: '#E9F1FE', borderBottomWidth: 1, borderBottomColor: '#DCE6F2' },
  columnTitle: { color: '#38577E', fontSize: 10, fontWeight: '800' },
  metricHeaderCell: { width: FINANCIAL_COLUMN_WIDTH, minHeight: 38, justifyContent: 'center', paddingHorizontal: 6 },
  metricHeaderText: { textAlign: 'right', color: '#38577E', fontSize: 9.5, fontWeight: '800' },
  tableRow: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBF4', paddingHorizontal: 8, gap: 7 },
  logo: { width: 28, height: 28 },
  insurerName: { flex: 1, color: '#28466D', fontSize: 10.5, fontWeight: '700', lineHeight: 14 },
  financialRow: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBF4' },
  metricCell: { width: FINANCIAL_COLUMN_WIDTH, paddingHorizontal: 6, textAlign: 'right', color: '#163C7A', fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { padding: 18, fontSize: 12, color: '#718198' },
  retry: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#1D5AB0', fontSize: 12, fontWeight: '700' },
});
