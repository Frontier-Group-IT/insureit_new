import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerInsurerRegister, type PartnerInsurerRegisterRow } from '@/lib/business';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type Metric = 'amounts' | 'premium' | 'payin' | 'retention' | 'payout';
type DatePreset = 'mtd' | 'last_month' | 'custom';
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
function getPresetRange(preset: Exclude<DatePreset, 'custom'>) {
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
  const amountScrollRef = useRef<ScrollView>(null);
  const { context, cacheScopeKey } = usePartnerSession();
  const employee = context?.identity.actor_kind === 'employee';
  const initialRange = getPresetRange('mtd');
  const [range, setRange] = useState(() => ({
    from: typeof params.from === 'string' && DATE_PATTERN.test(params.from) ? params.from : initialRange.from,
    to: typeof params.to === 'string' && DATE_PATTERN.test(params.to) ? params.to : initialRange.to,
  }));
  const [draft, setDraft] = useState(range);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('custom');
  const [metric, setMetric] = useState<Metric>('amounts');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('amount_desc');
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
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
  const options: Array<{ key: Metric; label: string }> = employee
    ? [{ key: 'amounts', label: 'Amounts' }, { key: 'premium', label: 'Net Premium' }, { key: 'payin', label: 'Pay-In' }, { key: 'retention', label: 'Retention' }]
    : [{ key: 'amounts', label: 'Amounts' }, { key: 'premium', label: 'Net Premium' }, { key: 'payout', label: 'Payout' }];
  // Never expose employee-only metrics to Partner identities.
  const selectedMetric = options.some((option) => option.key === metric) ? metric : 'amounts';
  // Amounts aliases premium because the existing RPC has no independent Amount field.
  const columns: Array<{ key: Metric | 'policies'; label: string }> = employee
    ? [{ key: 'policies', label: 'Policies' }, { key: 'amounts', label: 'Amount' }, { key: 'premium', label: 'Net Premium' }, { key: 'payin', label: 'Pay-In' }, { key: 'retention', label: 'Retention' }]
    : [{ key: 'policies', label: 'Policies' }, { key: 'amounts', label: 'Amount' }, { key: 'premium', label: 'Net Premium' }, { key: 'payout', label: 'Payout' }];
  const sortOptions: Array<{ key: SortKey; label: string }> = [
    { key: 'amount_desc', label: 'Highest Net Premium' },
    { key: 'amount_asc', label: 'Lowest Net Premium' },
    { key: 'policies_desc', label: 'Most Policies' },
    { key: 'policies_asc', label: 'Fewest Policies' },
    { key: 'name_asc', label: 'Insurer Name A–Z' },
    { key: 'name_desc', label: 'Insurer Name Z–A' },
    ...(employee ? [
      { key: 'payin_desc' as SortKey, label: 'Highest Pay-In' },
      { key: 'retention_desc' as SortKey, label: 'Highest Retention' },
    ] : []),
  ];
  const sortForCurrentUser = sortOptions.some((option) => option.key === sortKey) ? sortKey : 'amount_desc';
  const scrollToMetric = (key: Metric) => {
    setMetric(key);
    const index = columns.findIndex((column) => column.key === key);
    amountScrollRef.current?.scrollTo({ x: Math.max(0, index) * FINANCIAL_COLUMN_WIDTH, animated: true });
  };

  const insurers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const filtered = (query.data ?? []).filter((row) =>
      !term || row.name.toLocaleLowerCase().includes(term) || displayInsurerName(row.name).toLocaleLowerCase().includes(term));
    return [...filtered].sort((left, right) => {
      if (sortForCurrentUser === 'name_asc') return displayInsurerName(left.name).localeCompare(displayInsurerName(right.name));
      if (sortForCurrentUser === 'name_desc') return displayInsurerName(right.name).localeCompare(displayInsurerName(left.name));
      if (sortForCurrentUser === 'policies_asc') return left.policies - right.policies;
      if (sortForCurrentUser === 'policies_desc') return right.policies - left.policies;
      if (sortForCurrentUser === 'payin_desc' && employee) return Number(right.payin ?? 0) - Number(left.payin ?? 0);
      if (sortForCurrentUser === 'retention_desc' && employee) return Number(right.retention ?? 0) - Number(left.retention ?? 0);
      return sortForCurrentUser === 'amount_asc'
        ? Number(left.premium ?? 0) - Number(right.premium ?? 0)
        : Number(right.premium ?? 0) - Number(left.premium ?? 0);
    });
  }, [query.data, search, sortForCurrentUser, employee]);

  const openDateRange = () => {
    setDraft(range);
    setPickerTarget(null);
    setDatePreset('custom');
    setDateModalOpen(true);
  };
  const handlePickedDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPickerTarget(null);
    if (event.type === 'dismissed' || !selected || !pickerTarget) return;
    setDatePreset('custom');
    setDraft((current) => ({ ...current, [pickerTarget]: isoLocal(selected) }));
  };
  const applyPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    setDatePreset(preset);
    setDraft(getPresetRange(preset));
  };

  return (
    <PartnerScreen
      title="Insurer-wise Performance"
      navyTopBar
      scrollProps={{
        refreshControl: <RefreshControl refreshing={query.refreshing} onRefresh={() => void query.refresh()} />,
      }}
    >
      <Text style={styles.subtitle}>Track policies, premium and business by insurer</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} accessibilityLabel="Financial metric and date range filters">
        {options.map((option) => (
          <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: selectedMetric === option.key }}
            onPress={() => setMetric(option.key)}
            style={[styles.chip, selectedMetric === option.key && styles.selectedChip]}>
            <Text style={[styles.chipText, selectedMetric === option.key && styles.selectedChipText]}>{option.label}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Date Range, open date picker" onPress={openDateRange} style={styles.dateChip}>
          <Ionicons name="calendar-outline" size={14} color="#1659AA" />
          <Text style={styles.dateChipText}>Date Range</Text>
          <Ionicons name="chevron-down" size={12} color="#1659AA" />
        </Pressable>
      </ScrollView>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#7890AA" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search insurer" placeholderTextColor="#8391A6"
            autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search insurer" style={styles.searchInput} />
          {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear insurer search" onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#718198" />
          </Pressable> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={sortByAmount ? 'Sort insurer names alphabetically' : 'Sort insurers by selected amount'}
          onPress={() => setSortByAmount((current) => !current)} style={styles.sortButton}>
          <Ionicons name={sortByAmount ? 'filter-outline' : 'text-outline'} size={19} color="#1659AA" />
        </Pressable>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{validRange ? formatRange(from, to) : 'Select a valid reporting range'}</Text>
        <Text style={styles.countText}>{insurers.length} insurers</Text>
      </View>

      <View style={styles.register}>
        <View style={styles.registerHeader}>
          <Text style={[styles.columnTitle, styles.nameHeading]}>INSURER</Text>
          <Text style={[styles.columnTitle, styles.policiesHeading]}>POLICIES</Text>
          <Text style={[styles.columnTitle, styles.amountHeading]}>{selectedLabel.toUpperCase()}</Text>
        </View>
        {!validRange ? (
          <PartnerStateView state="empty" title="Date range unavailable" message="Choose a valid range of up to 366 days." />
        ) : query.loading && !query.data ? (
          <PartnerStateView state="loading" title="Loading insurers" />
        ) : query.error && !query.data ? (
          <PartnerStateView state="error" title="Insurer list unavailable" message={query.error} actionLabel="Try again" onAction={() => void query.refresh()} />
        ) : insurers.length ? (
          insurers.map((insurer) => {
            const amount = metricValue(insurer, selectedMetric);
            return (
              <View key={insurer.name} style={styles.tableRow} accessibilityLabel={`${insurer.name}, ${insurer.policies} policies, ${selectedLabel} ${amount == null ? 'unavailable' : formatInsurerRupees(amount)}`}>
                <View style={styles.nameCell}>
                  <PartnerInsurerLogo name={insurer.name} style={styles.logo} />
                  <Text style={styles.insurerName} numberOfLines={2} ellipsizeMode="tail" accessibilityLabel={insurer.name}>
                    {displayInsurerName(insurer.name)}
                  </Text>
                </View>
                <Text style={styles.policyCount} numberOfLines={1}>{insurer.policies}</Text>
                <Text style={styles.amountValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {amount == null ? '—' : formatInsurerRupees(amount)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>{search.trim() ? 'No insurers match your search.' : 'No insurers found for the selected reporting period.'}</Text>
        )}
        {query.error && query.data ? (
          <Pressable onPress={() => void query.refresh()} accessibilityRole="button" style={styles.retry}>
            <Text style={styles.retryText}>Refresh failed. Tap to retry.</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={dateModalOpen} transparent animationType="slide" onRequestClose={() => setDateModalOpen(false)}>
        <View style={styles.modalShade}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Date Range</Text>
              <Pressable accessibilityLabel="Close date range" accessibilityRole="button" onPress={() => setDateModalOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" color="#526781" size={20} />
              </Pressable>
            </View>
            <View style={styles.presets}>
              {([['mtd', 'This Month'], ['last_month', 'Last Month'], ['custom', 'Custom Range']] as const).map(([key, label]) => (
                <Pressable key={key} onPress={() => key === 'custom' ? setDatePreset('custom') : applyPreset(key)}
                  accessibilityRole="button" accessibilityState={{ selected: datePreset === key }}
                  style={[styles.preset, datePreset === key && styles.presetActive]}>
                  <Text style={[styles.presetText, datePreset === key && styles.presetTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.dateFields}>
              <View style={styles.dateField}>
                <PartnerDatePicker label="From Date" value={parseLocal(draft.from)} maximumDate={new Date()}
                  onChange={(date) => { setDatePreset('custom'); setDraft((current) => ({ ...current, from: isoLocal(date) })); }} />
              </View>
              <View style={styles.dateField}>
                <PartnerDatePicker label="To Date" value={parseLocal(draft.to)} maximumDate={new Date()}
                  onChange={(date) => { setDatePreset('custom'); setDraft((current) => ({ ...current, to: isoLocal(date) })); }} />
              </View>
            </View>
            <Text style={styles.dateNote}>Select up to 366 days. Dates use your device calendar.</Text>
            {!validDraft ? <Text style={styles.invalidRange}>Select a valid date range, with From Date on or before To Date.</Text> : null}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setDateModalOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={!validDraft} onPress={() => { setRange(draft); setDateModalOpen(false); }}
                style={[styles.apply, !validDraft && styles.applyDisabled]}><Text style={styles.applyText}>Apply</Text></Pressable>
            </View>
            {Platform.OS === 'web' ? <Text style={styles.dateNote}>Use the Partner mobile app to open the native date picker.</Text> : null}
          </View>
        </View>
      </Modal>
    </PartnerScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: 12, marginBottom: 12, color: '#526784', fontSize: 11.5, lineHeight: 17 },
  filterRow: { alignItems: 'center', gap: 7, paddingBottom: 12, paddingRight: 10 },
  chip: { minHeight: 37, justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: '#D9E4F2', backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  chipText: { color: '#375778', fontSize: 11, fontWeight: '700' },
  selectedChip: { backgroundColor: '#155BB6', borderColor: '#155BB6' },
  selectedChipText: { color: '#FFFFFF' },
  dateChip: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#B6CDED', borderRadius: 11, backgroundColor: '#ECF4FF', paddingHorizontal: 12 },
  dateChipText: { color: '#1659AA', fontSize: 11, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBox: { flex: 1, minHeight: 41, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D8E4F2', backgroundColor: '#FFFFFF', borderRadius: 11, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 12, color: '#213C66', paddingVertical: 8 },
  sortButton: { width: 42, height: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderColor: '#D8E4F2', borderWidth: 1, borderRadius: 11 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 },
  rangeText: { color: '#667D9C', fontSize: 10.5, fontWeight: '500' },
  countText: { color: '#667D9C', fontSize: 10.5 },
  register: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#DCE6F2', backgroundColor: '#FFFFFF' },
  registerHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 39, paddingHorizontal: 9, backgroundColor: '#EDF4FE', borderBottomWidth: 1, borderBottomColor: '#DAE6F6' },
  columnTitle: { color: '#38577E', fontSize: 9, fontWeight: '800' },
  nameHeading: { flex: 1 },
  policiesHeading: { width: 47, textAlign: 'right' },
  amountHeading: { width: 112, textAlign: 'right' },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBF4', paddingHorizontal: 9, paddingVertical: 7 },
  nameCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28 },
  insurerName: { flex: 1, color: '#28466D', fontSize: 11, fontWeight: '600', lineHeight: 15 },
  policyCount: { width: 47, textAlign: 'right', color: '#34516F', fontSize: 11, fontWeight: '600' },
  amountValue: { width: 112, textAlign: 'right', color: '#163C7A', fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { padding: 18, fontSize: 12, color: '#718198' },
  retry: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#1D5AB0', fontSize: 12, fontWeight: '700' },
  modalShade: { flex: 1, backgroundColor: 'rgba(9,25,51,0.48)', justifyContent: 'flex-end' },
  modalPanel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#173D7B' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 15 },
  preset: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 9, backgroundColor: '#F3F6FA', borderWidth: 1, borderColor: '#E1E8F2' },
  presetActive: { backgroundColor: '#E8F2FF', borderColor: '#90B4E9' },
  presetText: { color: '#536987', fontSize: 11, fontWeight: '600' },
  presetTextActive: { color: '#155BB6' },
  dateFields: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, minWidth: 0 },
  dateNote: { marginTop: 10, color: '#718198', fontSize: 10.5 },
  invalidRange: { marginTop: 9, color: '#B42318', fontSize: 11 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancel: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#EEF2F7' },
  cancelText: { color: '#526781', fontWeight: '700', fontSize: 12 },
  apply: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#155BB6' },
  applyDisabled: { opacity: 0.45 },
  applyText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
});
