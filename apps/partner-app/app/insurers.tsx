import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { MotionNumber, useActivityMotion } from '@/components/activity-motion';
import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerDatePicker } from '@/components/ui/partner-date-picker';
import { getPartnerInsurerRegister, type PartnerInsurerRegisterRow } from '@/lib/business';
import { PartnerAssets } from '@/lib/partner-assets';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type Metric = 'premium' | 'payin' | 'retention' | 'payout';
type SortKey = 'amount_desc' | 'amount_asc' | 'policies_desc' | 'policies_asc' | 'name_asc' | 'name_desc' | 'payin_desc' | 'retention_desc';
const ROW_HEIGHT = 46;
const ENTRANCE_ROWS = 6;
const nativeMotion = Platform.OS !== 'web';

function useReportReveal(motion: boolean, ready: boolean, delay = 0) {
  const value = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!motion || !ready) { value.setValue(1); return; }
    if (played.current) return;
    played.current = true;
    value.setValue(0.72);
    const animation = Animated.timing(value, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nativeMotion, isInteraction: false });
    animation.start();
    return () => { animation.stop(); value.setValue(1); };
  }, [motion, ready, delay, value]);
  return value;
}

function revealStyle(value: Animated.Value) {
  return { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0.72, 1], outputRange: [4, 0], extrapolate: 'clamp' }) }] };
}

function ReportValue({ text, motion }: { text: string; motion: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const previous = useRef(text);
  useEffect(() => {
    const changed = previous.current !== text;
    previous.current = text;
    if (!motion || !changed) { opacity.setValue(1); return; }
    opacity.setValue(0.65);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: nativeMotion, isInteraction: false });
    animation.start();
    return () => { animation.stop(); opacity.setValue(1); };
  }, [motion, opacity, text]);
  return <Animated.Text style={[styles.metricAmountText, { opacity }]} numberOfLines={1}
    adjustsFontSizeToFit minimumFontScale={0.7}>{text}</Animated.Text>;
}
const INSURER_COLUMN_WIDTH = '31%';

// Fixed widths keep the first two metrics visible while additional columns scroll.
const METRIC_WIDTHS = { policies: 75, premium: 105, payin: 90, retention: 95, payout: 95 } as const;
const METRIC_COLORS = {
  policies: { header: '#E2EEFF', cell: '#F1F6FF' },
  premium: { header: '#EAE5FF', cell: '#F6F3FF' },
  payin: { header: '#DDF5E8', cell: '#F0FAF5' },
  retention: { header: '#FFF0DB', cell: '#FFFAF2' },
  payout: { header: '#FFF0DB', cell: '#FFFAF2' },
} as const;

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
// Compact table cells show readable rupee bands; tapping reveals the exact
// rounded whole-rupee amount used by the previous financial register.
function formatInsurerCompactRupees(amount: number | string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '—';
  const rounded = Math.round(numeric);
  const absolute = Math.abs(rounded);
  const [divisor, suffix] = absolute >= 10_000_000 ? [10_000_000, 'Cr']
    : absolute >= 100_000 ? [100_000, 'L']
    : absolute >= 1_000 ? [1_000, 'k']
    : [1, ''];
  if (divisor === 1) return formatInsurerRupees(rounded);
  const compact = (rounded / divisor).toFixed(2).replace(/\.?0+$/, '');
  return `₹${compact}${suffix}`;
}
function isoLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
function getPresetRange(preset: 'mtd' | 'last_month' | '90' | '365') {
  if (preset === '90' || preset === '365') {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    from.setDate(from.getDate() - (preset === '90' ? 89 : 364));
    return { from: isoLocal(from), to: isoLocal(today) };
  }
  const today = new Date();
  const from = preset === 'mtd'
    ? new Date(today.getFullYear(), today.getMonth(), 1)
    : new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = preset === 'mtd'
    ? today
    : new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: isoLocal(from), to: isoLocal(to) };
}
function selectedPreset(from: string, to: string): 'mtd' | '90' | '365' | null {
  for (const preset of ['mtd', '90', '365'] as const) {
    const dates = getPresetRange(preset);
    if (dates.from === from && dates.to === to) return preset;
  }
  return null;
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
  const { height: screenHeight } = useWindowDimensions();
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
  const [searchFocused, setSearchFocused] = useState(false);
  const { motion } = useActivityMotion();
  const headerReveal = useReportReveal(motion, true);
  const filterReveal = useReportReveal(motion, true, 90);
  const calendarScale = useRef(new Animated.Value(1)).current;
  const focusGlow = useRef(new Animated.Value(0)).current;
  const headerGlow = useRef(new Animated.Value(0)).current;
  const skeletonPulse = useRef(new Animated.Value(0)).current;
  const edgeOpacity = useRef(new Animated.Value(0)).current;
  const scrollMetrics = useRef({ x: 0, viewport: 0, content: 0 });
  const stickyMetricsOffset = useRef(new Animated.Value(0)).current;
  const stickyGeometry = useRef({ top: 0, rangeHeight: 0 });
  const [stickyTableVisible, setStickyTableVisible] = useState(false);
  const edgeVisible = useRef(false);
  const updateEdge = useCallback(() => {
    const { x, viewport, content } = scrollMetrics.current;
    const next = viewport > 0 && content - viewport - x > 2;
    if (next === edgeVisible.current) return;
    edgeVisible.current = next;
    edgeOpacity.stopAnimation();
    if (!motion) { edgeOpacity.setValue(next ? 1 : 0); return; }
    Animated.timing(edgeOpacity, { toValue: next ? 1 : 0, duration: 150, useNativeDriver: nativeMotion, isInteraction: false }).start();
  }, [edgeOpacity, motion]);
  const pressCalendar = (toValue: number) => {
    if (motion) Animated.spring(calendarScale, { toValue, stiffness: 240, damping: 22, mass: 0.8, useNativeDriver: nativeMotion, isInteraction: false }).start();
  };
  useEffect(() => {
    const animation = Animated.timing(focusGlow, { toValue: searchFocused ? 1 : 0, duration: motion ? 160 : 0, useNativeDriver: nativeMotion, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [focusGlow, searchFocused, motion]);
  useEffect(() => {
    if (!motion) { headerGlow.setValue(0); calendarScale.setValue(1); edgeOpacity.stopAnimation(); edgeOpacity.setValue(edgeVisible.current ? 1 : 0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(headerGlow, { toValue: 1, duration: 2400, useNativeDriver: nativeMotion, isInteraction: false }),
      Animated.timing(headerGlow, { toValue: 0, duration: 2400, useNativeDriver: nativeMotion, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); headerGlow.setValue(0); calendarScale.stopAnimation(); calendarScale.setValue(1); edgeOpacity.stopAnimation(); edgeOpacity.setValue(edgeVisible.current ? 1 : 0); };
  }, [motion, headerGlow, calendarScale, edgeOpacity]);
  const [sortKey, setSortKey] = useState<SortKey>('amount_desc');
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
  // Net Premium is the sole premium metric. The removed Amount column duplicated this RPC value.
  // Commercial figures remain visible only when the authenticated server grant permits them.
  const columns: Array<{ key: Metric | 'policies'; label: string }> = employee
    ? [{ key: 'policies', label: 'Policies' }, { key: 'premium', label: 'Net Premium' }, ...(canViewCommercials ? [{ key: 'payin' as const, label: 'Pay-In' }, { key: 'retention' as const, label: 'Retention' }] : [])]
    : [{ key: 'policies', label: 'Policies' }, { key: 'premium', label: 'Net Premium' }, { key: 'payout', label: 'Payout' }];
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

  const initialLoading = validRange && query.loading && !query.data;
  const reportReady = validRange && !!query.data;
  const tableReveal = useReportReveal(motion, reportReady, 120);
  // A bounded set of shared row values animates both halves in lockstep.
  // Never key these animations by search, sort, date or recycled row position.
  const rowReveals = useRef(Array.from({ length: ENTRANCE_ROWS }, () => new Animated.Value(1))).current;
  const initialRows = useRef<Map<string, Animated.Value> | null>(null);
  useEffect(() => {
    if (!motion || !reportReady) { rowReveals.forEach(value => value.setValue(1)); return; }
    if (initialRows.current || !insurers.length) return;
    initialRows.current = new Map(insurers.slice(0, ENTRANCE_ROWS).map((row, index) => [row.name, rowReveals[index]]));
    const animations = rowReveals.map((value, index) => {
      value.setValue(0.72);
      return Animated.timing(value, { toValue: 1, duration: 240, delay: 120 + index * 45, useNativeDriver: nativeMotion, isInteraction: false });
    });
    // The entrance style is attached on the next render, without changing data.
    setEntranceStarted(true);
    const animation = Animated.parallel(animations);
    animation.start();
    return () => { animation.stop(); rowReveals.forEach(value => value.setValue(1)); };
  }, [motion, reportReady, insurers, rowReveals]);
  const [entranceStarted, setEntranceStarted] = useState(false);
  const rowStyle = (name: string) => {
    const value = entranceStarted ? initialRows.current?.get(name) : undefined;
    return value ? revealStyle(value) : undefined;
  };
  useEffect(() => {
    if (!motion || !initialLoading) { skeletonPulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(skeletonPulse, { toValue: 1, duration: 650, useNativeDriver: nativeMotion, isInteraction: false }),
      Animated.timing(skeletonPulse, { toValue: 0, duration: 650, useNativeDriver: nativeMotion, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); skeletonPulse.setValue(0); };
  }, [motion, initialLoading, skeletonPulse]);
  const skeletonOpacity = skeletonPulse.interpolate({ inputRange: [0, 1], outputRange: [0.48, 1] });

  const onReportVerticalScroll = (y: number) => {
    const headerTop = stickyGeometry.current.top + stickyGeometry.current.rangeHeight;
    const bottom = headerTop + 38 + insurers.length * ROW_HEIGHT;
    const next = reportReady && insurers.length > 0 && headerTop > 0 && y > headerTop && y < bottom - 38;
    setStickyTableVisible(current => current === next ? current : next);
  };
  const reportColumnWidth = columns.reduce((total, column) => total + METRIC_WIDTHS[column.key], 0);
  const stickyTableHeader = stickyTableVisible ? (
    <View pointerEvents="box-none" style={styles.stickyHeaderOverlay}>
      <View style={[styles.registerContents, styles.stickyHeaderSurface]}>
        <View style={styles.fixedNames}>
          <View style={styles.registerHeader}><Text style={styles.columnTitle}>INSURER</Text></View>
        </View>
        <View style={[styles.financialColumns, styles.stickyMetricsViewport]}>
          <Animated.View style={{ flexDirection: 'row', width: reportColumnWidth, transform: [{ translateX: Animated.multiply(stickyMetricsOffset, -1) }] }}>
            {columns.map(column => <Pressable key={column.key} accessibilityRole="button"
              accessibilityLabel={`Sort by ${column.label}`}
              onPress={() => {
                if (column.key === 'policies') setSortKey('policies_desc');
                else if (column.key === 'premium') setSortKey('amount_desc');
                else if (column.key === 'payin' && canViewCommercials) setSortKey('payin_desc');
                else if (column.key === 'retention' && canViewCommercials) setSortKey('retention_desc');
              }}
              style={[styles.metricHeaderCell, { height: 38, width: METRIC_WIDTHS[column.key], backgroundColor: METRIC_COLORS[column.key].header }]}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}
                style={styles.metricHeaderText}>{column.label.toUpperCase()}</Text>
            </Pressable>)}
          </Animated.View>
        </View>
      </View>
    </View>
  ) : null;

  const openDateRange = () => {
    // Keep draft changes isolated until Apply Filter is tapped.
    setDraft(range);
    setDateExpanded(true);
  };
  const closeDateRange = () => {
    setDateExpanded(false);
    setDraft(range);
  };
  const applyDateRange = () => {
    if (!validDraft) return;
    setRange(draft);
    setDateExpanded(false);
  };
  const applyPreset = (preset: 'mtd' | '90' | '365') => setDraft(getPresetRange(preset));

  return (
    <PartnerScreen title="Insurer-wise Performance" hideTopBar fullWidth bottomNavigationNavy navyStatusBar
      fixedHeader={stickyTableHeader} resetScrollOnFocus={false}
      bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}
      scrollProps={{ refreshControl: <RefreshControl refreshing={query.refreshing} onRefresh={() => void query.refresh()} />, onScroll: event => onReportVerticalScroll(event.nativeEvent.contentOffset.y) }}
    >
      <View style={styles.referenceHeader}>
        <View style={styles.headerOrbLarge} />
        <View style={styles.headerOrbSmall} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: "#70BFFF", opacity: headerGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.055] }) }]} />
        <Animated.View style={[styles.headerCopy, revealStyle(headerReveal)]}>
          <View style={styles.headerTitleRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back to Business"
              onPress={() => router.back()} style={styles.headerIcon}>
              <Image source={PartnerAssets.status.businessGrowth} style={styles.headerArtwork} resizeMode="contain" />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>Insurer-wise Performance</Text>
          </View>
        </Animated.View>
      </View>
      <View style={styles.dateSection}>
        <Animated.View style={revealStyle(filterReveal)}>
        <View style={[styles.headerSearch, searchFocused && styles.searchFocused]}>
          <Animated.View pointerEvents="none" style={[styles.focusOutline, { opacity: focusGlow }]} />
          <Ionicons name="search-outline" size={18} color="#8698AE" />
          <TextInput value={search} onChangeText={setSearch} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} placeholder="Search insurer"
            placeholderTextColor="#94A2B5" autoCapitalize="none" autoCorrect={false}
            accessibilityLabel="Search insurer" style={styles.headerSearchInput} />
          {search ? <Pressable accessibilityRole="button" accessibilityLabel="Clear insurer search" onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color="#94A2B5" />
          </Pressable> : null}
          <View style={styles.calendarDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel="Date Range"
            accessibilityState={{ expanded: dateExpanded }} onPress={openDateRange}
            hitSlop={8} onPressIn={() => pressCalendar(0.92)} onPressOut={() => pressCalendar(1)} style={styles.calendarTrigger}>
            <Animated.View style={{ transform: [{ scale: calendarScale }] }}>
            <Ionicons name="calendar-outline" size={20} color="#155BB6" />
            </Animated.View>
          </Pressable>
        </View>
        <View style={styles.selectedRangeRow}>
          <Ionicons name="calendar-outline" size={13} color="#667D9C" />
          <Text style={styles.dateRangeValue}>{validRange ? formatRange(from, to) : 'Select a valid reporting range'}</Text>
        </View>
        </Animated.View>
      </View>

      <View style={styles.registerArea} onLayout={event => {
        const y = event.nativeEvent.layout.y;
        stickyGeometry.current.top = y;
      }}>
        <View style={styles.rangeRow} onLayout={event => {
          const height = event.nativeEvent.layout.height + 8;
          stickyGeometry.current.rangeHeight = height;
        }}>
          <Text style={styles.countText} accessibilityLabel={initialLoading ? "Loading insurers" : `${insurers.length} insurers`}>{initialLoading ? "Loading insurers…" : <MotionNumber text={`${insurers.length} insurers`} count={insurers.length} motion={motion && reportReady && !search.trim()} />}</Text>
        </View>
        <View style={styles.register}>
          <View style={styles.registerContents}>
            <View style={styles.fixedNames}>
              <View style={styles.registerHeader}><Animated.Text style={[styles.columnTitle, { opacity: tableReveal }]}>INSURER</Animated.Text></View>
              {initialLoading ? Array.from({ length: 5 }, (_, index) => <View key={`name-skeleton-${index}`} style={styles.tableRow} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Animated.View style={[styles.skeletonLogo, { opacity: skeletonOpacity }]} /><Animated.View style={[styles.skeletonName, { opacity: skeletonOpacity }]} /></View>) : null}
              {!validRange || (query.loading && !query.data) || (query.error && !query.data) ? null
                : insurers.map((insurer) => (
                  <Animated.View key={insurer.name} style={[styles.tableRow, rowStyle(insurer.name)]}>
                    <PartnerInsurerLogo name={insurer.name} style={styles.logo} />
                    <Text style={styles.insurerName} numberOfLines={2} ellipsizeMode="tail"
                      accessibilityLabel={insurer.name}>{displayInsurerName(insurer.name)}</Text>
                  </Animated.View>
                ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="Swipe horizontally for additional financial columns" style={styles.financialColumns} contentContainerStyle={styles.financialScrollContent}
              nestedScrollEnabled scrollEventThrottle={16}
              onLayout={event => { scrollMetrics.current.viewport = event.nativeEvent.layout.width; updateEdge(); }}
              onContentSizeChange={width => { scrollMetrics.current.content = width; updateEdge(); }}
              onScroll={event => { scrollMetrics.current.x = event.nativeEvent.contentOffset.x; stickyMetricsOffset.setValue(scrollMetrics.current.x); updateEdge(); }}>
              <View style={{ width: columns.reduce((total, column) => total + METRIC_WIDTHS[column.key], 0) }}>
              <View style={styles.registerHeader}>
                {columns.map((column) => (
                  <Pressable key={column.key} accessibilityRole="button"
                    accessibilityLabel={`Sort by ${column.label}`}
                    onPress={() => {
                      if (column.key === 'policies') setSortKey('policies_desc');
                      else if (column.key === 'premium') setSortKey('amount_desc');
                      else if (column.key === 'payin' && canViewCommercials) setSortKey('payin_desc');
                      else if (column.key === 'retention' && canViewCommercials) setSortKey('retention_desc');
                    }}
                    style={[styles.metricHeaderCell, { width: METRIC_WIDTHS[column.key], backgroundColor: METRIC_COLORS[column.key].header }]}>
                    <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}
                      style={[styles.metricHeaderText, { opacity: tableReveal }]}>{column.label.toUpperCase()}</Animated.Text>
                  </Pressable>
                ))}
              </View>
              {initialLoading ? Array.from({ length: 5 }, (_, index) => <View key={`metric-skeleton-${index}`} style={styles.financialRow} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{columns.map(column => <View key={column.key} style={[styles.metricPressable, { width: METRIC_WIDTHS[column.key], backgroundColor: METRIC_COLORS[column.key].cell }]}><Animated.View style={[styles.skeletonAmount, { opacity: skeletonOpacity }]} /></View>)}</View>) : null}
              {(!validRange || (query.loading && !query.data) || (query.error && !query.data)) ? null
                : insurers.map((insurer) => (
                  <Animated.View key={insurer.name} style={[styles.financialRow, rowStyle(insurer.name)]}>
                    {columns.map((column) => {
                      const amount = column.key === 'policies' ? null : metricValue(insurer, column.key);
                      if (column.key === 'policies') {
                        return <View key={column.key} style={[styles.metricPressable, { width: METRIC_WIDTHS[column.key], backgroundColor: METRIC_COLORS[column.key].cell }]}>
                          <Text style={styles.metricCell} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{insurer.policies}</Text>
                        </View>;
                      }
                      const exactAmount = amount == null ? '—' : formatInsurerRupees(amount);
                      return (
                        <Pressable key={column.key} accessibilityRole="button"
                          accessibilityLabel={`${insurer.name}, ${column.label}, ${exactAmount}. Tap for full amount`}
                          onPress={() => partnerAlert(`${displayInsurerName(insurer.name)} · ${column.label}`, exactAmount)}
                          style={[styles.metricPressable, { width: METRIC_WIDTHS[column.key], backgroundColor: METRIC_COLORS[column.key].cell }]}>
                          <ReportValue text={amount == null ? '—' : formatInsurerCompactRupees(amount)} motion={motion} />
                        </Pressable>
                      );
                    })}
                  </Animated.View>
                ))}
              </View>
            </ScrollView>
            <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.scrollEdge, { opacity: edgeOpacity }]} />
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


      <Modal visible={dateExpanded} transparent animationType={!motion ? 'none' : Platform.OS === 'ios' ? 'slide' : 'fade'}
        onRequestClose={closeDateRange}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
            accessibilityLabel="Dismiss Date Range filter" onPress={closeDateRange} />
          <View style={[styles.sheet,{ maxHeight: Math.max(330, screenHeight - 70) }]} accessibilityViewIsModal>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sort by</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close Date Range filter"
                onPress={closeDateRange} style={styles.sheetClose}>
                <Ionicons name="close" size={23} color="#586580" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetBody}>
              <Text style={styles.sheetSectionTitle}>Date Range</Text>
              <View style={styles.sheetPresets}>
                <Pressable accessibilityRole="button" disabled
                  accessibilityLabel="All Dates unavailable, report supports a maximum of 366 days"
                  style={[styles.sheetPreset, styles.sheetPresetDisabled]}>
                  <Text style={styles.sheetPresetText}>All Dates</Text>
                </Pressable>
                {(['mtd', '90', '365'] as const).map((key) => {
                  const selected = selectedPreset(draft.from, draft.to) === key;
                  const label = key === 'mtd' ? 'MTD' : key === '90' ? '90 Days' : '365 Days';
                  return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }}
                    onPress={() => applyPreset(key)}
                    style={[styles.sheetPreset, selected && styles.sheetPresetSelected]}>
                    <Text style={[styles.sheetPresetText, selected && styles.sheetPresetTextSelected]}>{label}</Text>
                  </Pressable>;
                })}
              </View>
              <Text style={styles.sheetNote}>This insurer report supports a maximum of 366 days. All Dates is not available.</Text>
              <View style={styles.sheetDates}>
                <View style={styles.sheetDateField}>
                  <PartnerDatePicker directSelect label="From"
                    value={DATE_PATTERN.test(draft.from) ? parseLocal(draft.from) : null}
                    onChange={(date) => setDraft((current) => ({ ...current, from: isoLocal(date) }))}
                    maximumDate={DATE_PATTERN.test(draft.to) ? parseLocal(draft.to) : new Date()} />
                </View>
                <View style={styles.sheetDateField}>
                  <PartnerDatePicker directSelect label="To"
                    value={DATE_PATTERN.test(draft.to) ? parseLocal(draft.to) : null}
                    onChange={(date) => setDraft((current) => ({ ...current, to: isoLocal(date) }))}
                    minimumDate={DATE_PATTERN.test(draft.from) ? parseLocal(draft.from) : undefined}
                    maximumDate={new Date()} />
                </View>
              </View>
              {!validDraft ? <Text style={styles.invalidRange}>Select valid From and To dates, no more than 366 days apart and not in the future.</Text> : null}
            </ScrollView>
            <View style={styles.sheetFooter}>
              <Pressable accessibilityRole="button" accessibilityLabel="Reset date filters"
                onPress={() => setDraft(getPresetRange('mtd'))} style={styles.sheetReset}>
                <Ionicons name="refresh-outline" size={17} color="#172552" />
                <Text style={styles.sheetResetText}>Reset Filters</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Apply insurer date range"
                disabled={!validDraft} onPress={applyDateRange}
                style={[styles.sheetApply,!validDraft && styles.applyDisabled]}>
                <Ionicons name="funnel-outline" size={17} color="#FFFFFF" />
                <Text style={styles.sheetApplyText}>Apply Filter</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PartnerScreen>
  );
}

const styles = StyleSheet.create({
  referenceHeader: { marginHorizontal: -16, height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#071E49' },
  headerOrbLarge: { position: 'absolute', right: -38, top: -52, width: 170, height: 130, borderRadius: 90, backgroundColor: '#13305F', opacity: 0.65 },
  headerOrbSmall: { position: 'absolute', right: 95, top: -25, width: 85, height: 85, borderRadius: 45, backgroundColor: '#112B57', opacity: 0.55 },
  headerIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  headerArtwork: { width: 51, height: 51 },
  headerCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, minHeight: 51 },
  headerTitle: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '800', color: '#FFFFFF', lineHeight: 23 },
  // Full-width pill within even side margins; calendar is part of this same search control.
  headerSearch: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD8E7', borderRadius: 999, minHeight: 46, paddingLeft: 14, paddingRight: 6, alignItems: 'center', flexDirection: 'row', gap: 9 },
  searchFocused: { borderColor: '#3986D7' },
  focusOutline: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 2, borderColor: '#A7D0F7' },
  skeletonLogo: { width: 21, height: 21, borderRadius: 5, backgroundColor: '#DCE7F5' },
  skeletonName: { flex: 1, maxWidth: 62, height: 8, borderRadius: 4, backgroundColor: '#DCE7F5' },
  skeletonAmount: { alignSelf: 'flex-end', width: '65%', height: 8, borderRadius: 4, backgroundColor: '#D6E1F2' },
  scrollEdge: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, backgroundColor: 'rgba(26,58,105,0.12)' },
  headerSearchInput: { flex: 1, minWidth: 0, color: '#233D62', fontSize: 12, paddingVertical: 6 },
  dateSection: { marginHorizontal: 14, marginTop: 14, marginBottom: 8 },
  calendarDivider: { width: 1, height: 22, backgroundColor: '#DCE6F2' },
  calendarTrigger: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  selectedRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 10 },
  dateRangeValue: { fontSize: 10.5, fontWeight: '600', color: '#667D9C' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9,22,55,0.65)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', paddingTop: 12, overflow: 'hidden' },
  sheetHeader: { paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E5ED' },
  sheetTitle: { fontSize: 19, color: '#17233A', fontWeight: '700' },
  sheetClose: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, gap: 12 },
  sheetSectionTitle: { fontSize: 14, color: '#182557', fontWeight: '700' },
  sheetPresets: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sheetPreset: { flex: 1, minWidth: 0, minHeight: 40, borderRadius: 10, backgroundColor: '#F1EFF9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  sheetPresetDisabled: { opacity: 0.45 },
  sheetPresetSelected: { backgroundColor: '#4230B3' },
  sheetPresetText: { fontSize: 11, color: '#25385B', fontWeight: '700', textAlign: 'center' },
  sheetPresetTextSelected: { color: '#FFFFFF' },
  sheetNote: { color: '#7C879B', fontSize: 10.5, lineHeight: 15 },
  sheetDates: { flexDirection: 'row', gap: 9 },
  sheetDateField: { flex: 1, minWidth: 0 },
  invalidRange: { color: '#B42318', fontSize: 11 },
  sheetFooter: { flexDirection: 'row', gap: 9, paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E3E5EC' },
  sheetReset: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 24, borderWidth: 1, borderColor: '#C8CFE0' },
  sheetResetText: { fontSize: 12, color: '#172552', fontWeight: '700' },
  sheetApply: { flex: 1.5, minWidth: 0, minHeight: 44, borderRadius: 24, backgroundColor: '#4230B3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  applyDisabled: { opacity: 0.45 },
  sheetApplyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  stickyHeaderOverlay: { position: 'absolute', top: 0, left: 10, right: 10, zIndex: 15, elevation: 5 },
  stickyHeaderSurface: { height: 38, overflow: 'hidden', borderWidth: 1, borderTopWidth: 0, borderColor: '#DCE6F2', backgroundColor: '#FFFFFF' },
  stickyMetricsViewport: { overflow: 'hidden' },
  registerArea: { paddingHorizontal: 10, paddingTop: 3, paddingBottom: 18 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 3, marginBottom: 8 },
  countText: { color: '#667D9C', fontSize: 10.5 },
  register: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#DCE6F2', backgroundColor: '#FFFFFF' },
  registerContents: { flexDirection: 'row', alignItems: 'flex-start', width: '100%' },
  fixedNames: { width: INSURER_COLUMN_WIDTH, borderRightWidth: 1, borderRightColor: '#D8E4F3', backgroundColor: '#FFFFFF' },
  financialColumns: { flex: 1, minWidth: 0 },
  financialScrollContent: { alignItems: 'flex-start' },
  registerHeader: { flexDirection: 'row', alignItems: 'center', height: 38, backgroundColor: '#E9F1FE', borderBottomWidth: 1, borderBottomColor: '#DCE6F2' },
  columnTitle: { color: '#38577E', fontSize: 9, fontWeight: '800' },
  metricHeaderCell: { minWidth: 0, minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
  policyColumn: { width: '17%' },
  amountColumn: { flex: 1, minWidth: 0 },
  metricHeaderText: { textAlign: 'center', color: '#38577E', fontSize: 10, fontWeight: '800' },
  tableRow: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBF4', paddingHorizontal: 4, gap: 4 },
  logo: { width: 21, height: 21 },
  insurerName: { flex: 1, minWidth: 0, color: '#28466D', fontSize: 9.2, fontWeight: '700', lineHeight: 12 },
  financialRow: { flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2EBF4' },
  metricCell: { minWidth: 0, paddingHorizontal: 8, textAlign: 'right', color: '#163C7A', fontSize: 9.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricPressable: { minWidth: 0, height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 8 },
  metricAmountText: { color: '#163C7A', textAlign: 'right', fontSize: 9.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { padding: 18, fontSize: 12, color: '#718198' },
  retry: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#1D5AB0', fontSize: 12, fontWeight: '700' },
});
