import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerPagination } from '@/components/ui/partner-pagination';
import {
  getPartnerCustomerSummary,
  listPartnerCustomers,
  type PartnerCustomerRow,
  type PartnerCustomerStatusFilter,
  type PartnerCustomerSummary,
} from '@/lib/customers';
import { PartnerAssets } from '@/lib/partner-assets';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
let savedCustomerQuery = '';

export default function CustomersScreen() {
  const router = useRouter();
  const motion = useCustomerMotion();
  const heroMotion = useEntrance(motion);
  const firstRows = useRef<Set<string> | null>(null);
  const playedRows = useRef(new Set<string>());
  const contactLock = useRef(0);
  const refreshLock = useRef(false);
  const refreshFeedback = useRef(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [kpiWidth, setKpiWidth] = useState(0);
  const selection = useRef(new Animated.Value(0)).current;
  const verticalListRef = useRef<FlatList>(null);
  useFocusEffect(useCallback(() => {
    const reset = () => verticalListRef.current?.scrollToOffset({ offset: 0, animated: false });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, []));
  const { cacheScopeKey } = usePartnerSession();
  const [query, setQuery] = useState(savedCustomerQuery);
  const [statusFilter, setStatusFilter] = useState<PartnerCustomerStatusFilter>('all');
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    savedCustomerQuery = query;
  }, [query]);

  const fetchSummary = useCallback(() => getPartnerCustomerSummary(), []);
  const summary = usePartnerQuery<PartnerCustomerSummary>({
    scopeKey: cacheScopeKey,
    key: 'customers:summary',
    fetcher: fetchSummary,
    staleTimeMs: 2 * 60_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerCustomers({ limit, offset, search: debouncedSearch, status: statusFilter });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch, statusFilter]);

  const collection = usePartnerPageQuery<PartnerCustomerRow>({
    scopeKey: cacheScopeKey,
    key: `customers:list:${statusFilter}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const refreshAll = useCallback(async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setManualRefreshing(true);
    try { await Promise.all([summary.refresh(), collection.refresh()]); }
    finally { refreshLock.current = false; refreshFeedback.current = true; setManualRefreshing(false); }
  }, [collection, summary]);

  const totals = useMemo(() => {
    const customers = summary.data?.total_customers ?? 0;
    const active = summary.data?.active_customers ?? 0;
    return { customers, active, inactive: Math.max(customers - active, 0) };
  }, [summary.data]);

  const refreshing = manualRefreshing || collection.refreshing || summary.refreshing;
  const spin = useRef(new Animated.Value(0)).current;
  const refreshScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (refreshing || !refreshFeedback.current) return;
    refreshFeedback.current = false;
    if (!motion || collection.error || summary.error || collection.stale || summary.stale) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const animation = Animated.sequence([Animated.timing(refreshScale, { toValue: 1.12, duration: 100, useNativeDriver: true }), Animated.spring(refreshScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 })]);
    animation.start();
    return () => { animation.stop(); refreshScale.setValue(1); };
  }, [refreshing, motion, collection.error, summary.error, collection.stale, summary.stale, refreshScale]);
  useEffect(() => {
    spin.setValue(0);
    if (!motion || !refreshing) return;
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    animation.start();
    return () => { animation.stop(); spin.setValue(0); };
  }, [motion, refreshing, spin]);
  useEffect(() => {
    const target = statusFilter === 'all' ? 0 : statusFilter === 'active' ? 1 : 2;
    if (!motion) { selection.setValue(target); return; }
    const animation = Animated.spring(selection, { toValue: target, useNativeDriver: true, speed: 20, bounciness: 3 });
    animation.start();
    return () => animation.stop();
  }, [statusFilter, motion, selection]);
  const selectFilter = useCallback((next: PartnerCustomerStatusFilter) => {
    if (next === statusFilter) return;
    void Haptics.selectionAsync().catch(() => {});
    setStatusFilter(next);
  }, [statusFilter]);
  // Freeze the first batch; never re-arm entrances for scrolling, search or page changes.
  useEffect(() => {
    if (!collection.loading && firstRows.current === null && collection.rows.length) {
      firstRows.current = new Set(collection.rows.slice(0, 7).map(row => row.customer_id));
    }
  }, [collection.loading, collection.rows]);
  const openCustomer = useCallback((id: string) => router.push(`/customer/${id}` as never), [router]);
  const contact = useCallback((url: string) => {
    const now = Date.now();
    if (now < contactLock.current) return;
    contactLock.current = now + 1000;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void Linking.openURL(url).catch(() => { contactLock.current = 0; });
  }, []);
  const renderCustomer = useCallback(({ item, index }: { item: PartnerCustomerRow; index: number }) => (
    <CustomerCard row={item} index={index} motion={motion} initialRows={firstRows} playedRows={playedRows} onOpen={openCustomer} onContact={contact} />
  ), [motion, openCustomer, contact]);

  const listHeader = (
    <View>
      <View style={styles.hero}>
        <Animated.View pointerEvents="none" style={[styles.heroOrbLarge, { transform: [{ translateX: heroMotion.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]} />
        <Animated.View pointerEvents="none" style={[styles.heroOrbSmall, { transform: [{ translateX: heroMotion.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Animated.View style={[styles.heroIcon, { transform: [{ scale: heroMotion.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}>
          <Ionicons name="people" size={19} color="#0A5CC7" />
        </Animated.View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>BUSINESS</Text>
          <Text style={styles.title}>Customers</Text>
        </View>
      </View>

      <View style={styles.kpiOuter}>
        {summary.loading && !summary.data ? (
          <View style={styles.kpiLoading} accessibilityRole="progressbar" accessibilityLabel="Loading customer totals"><View style={styles.kpiSkeletonBlock} /><View style={styles.kpiSkeletonBlock} /><View style={styles.kpiSkeletonBlock} /></View>
        ) : (
          <View style={styles.kpiStrip} onLayout={event => setKpiWidth(event.nativeEvent.layout.width)}>
            {kpiWidth > 0 ? <Animated.View pointerEvents="none" style={[styles.selection, { width: kpiWidth / 3, transform: [{ translateX: Animated.multiply(selection, kpiWidth / 3) }] }]} /> : null}
            <KpiCell
              label="Customers"
              value={totals.customers}
              icon="people-outline"
              active={statusFilter === 'all'}
              first
              motion={motion} onPress={() => selectFilter('all')}
            />
            <KpiCell
              label="Active"
              value={totals.active}
              icon="checkmark-circle-outline"
              active={statusFilter === 'active'}
              motion={motion} onPress={() => selectFilter('active')}
            />
            <KpiCell
              label="Inactive"
              value={totals.inactive}
              icon="remove-circle-outline"
              active={statusFilter === 'inactive'}
              last
              motion={motion} onPress={() => selectFilter('inactive')}
            />
          </View>
        )}
      </View>

      <View style={styles.searchBand}>
        <PartnerSearchField
          value={query} onChangeText={setQuery} onClear={() => setQuery('')}
          placeholder="Search name, code, phone, email or city"
          placeholders={["Search customer name…","Search mobile number…","Search customer code…","Search city…"]}
          suggestions={debouncedSearch.length >= 2 ? collection.rows.flatMap(row => [row.customer_name,row.customer_code || "",row.phone || "",row.email || "",row.city || ""]) : []}
          containerStyle={styles.searchBox} premiumMotion={motion} pausePlaceholder={!motion}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh customers" onPress={() => void refreshAll()} accessibilityState={{ busy: refreshing }} disabled={refreshing} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }, { scale: refreshScale }] }}><Ionicons name="refresh" size={18} color="#173E73" /></Animated.View>
        </Pressable>
      </View>

      {(collection.stale || summary.stale) ? (
        <View style={styles.banner}>
          <PartnerBanner
            tone="warning"
            title={collection.offline || summary.offline ? "You're offline" : 'Showing cached information'}
            message={`Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`}
          />
        </View>
      ) : null}

      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.banner}><PartnerBanner tone="warning" message={collection.error} /></View>
      ) : null}
    </View>
  );

  const empty = collection.loading ? (
    <CustomerSkeleton motion={motion} />
  ) : collection.error ? (
    <PartnerStateView state="error" title="Customers could not be loaded" message={collection.error} actionLabel="Try again" onAction={() => void refreshAll()} />
  ) : (
    <PartnerStateView
      state="empty"
      asset={PartnerAssets.emptyStates.noCustomers}
      title="No customers found"
      message={debouncedSearch ? 'Try a different name, code, phone, email or city.' : statusFilter === 'all' ? 'Customers in your authorized business scope will appear here.' : `No ${statusFilter} customers are available in your authorized business scope.`}
    />
  );

  const footer = collection.rows.length ? (
    <PartnerPagination
      page={collection.page}
      totalPages={collection.totalPages}
      total={collection.total}
      pageSize={PAGE_SIZE}
      rowCount={collection.rows.length}
      onPrevious={collection.previousPage}
      onNext={collection.nextPage}
      disabled={collection.changingPage}
    />
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" backgroundColor="#071E49" />
      <FlatList
        ref={verticalListRef}
        key={`customers-page-${collection.page}`}
        data={collection.rows}
        keyExtractor={(row) => row.customer_id}
        renderItem={renderCustomer}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<View style={styles.emptyWrap}>{empty}</View>}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={() => void refreshAll()}
      />

      <PartnerStackBottomNavigation activeTab="business" />
    </SafeAreaView>
  );
}

function KpiCell({
  label,
  value,
  icon,
  active = false,
  first = false,
  last = false,
  onPress,
  motion,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  first?: boolean;
  last?: boolean;
  onPress: () => void;
  motion: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${label.toLowerCase()} customers`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kpiCell,
        active && { borderLeftColor: '#0B2E63' },
        first && styles.kpiCellFirst,
        last && styles.kpiCellLast,
        pressed && styles.kpiCellPressed,
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? '#FFFFFF' : '#1E5A98'} />
      <View style={styles.kpiCopy}>
        <Text style={[styles.kpiValue, active && styles.kpiTextActive]}><CountValue value={value} motion={motion} /></Text>
        <Text style={[styles.kpiLabel, active && styles.kpiTextActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const CustomerCard = memo(function CustomerCard({ row, index, motion, initialRows, playedRows, onOpen, onContact }: { row: PartnerCustomerRow; index: number; motion: boolean; initialRows: { current: Set<string> | null }; playedRows: { current: Set<string> }; onOpen: (id: string) => void; onContact: (url: string) => void }) {
  const eligible = useRef(index < 7 && (initialRows.current === null || initialRows.current.has(row.customer_id)) && !playedRows.current.has(row.customer_id)).current;
  const entrance = useEntrance(motion && eligible, index * 60);
  useEffect(() => { if (eligible) playedRows.current.add(row.customer_id); }, [eligible, playedRows, row.customer_id]);
  const press = useRef(new Animated.Value(1)).current;
  const animatePress = (value: number) => {
    if (!motion) return;
    Animated.spring(press, { toValue: value, useNativeDriver: true, speed: 28, bounciness: 3 }).start();
  };
  useEffect(() => () => press.stopAnimation(), [press]);
  const isActive = (row.customer_status || '').trim().toLowerCase() === 'active';
  const phone = normalizePhone(row.phone || '');

  return (
    <Animated.View style={[styles.cardWrap, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <Animated.View style={[styles.card, { transform: [{ scale: press }] }]}>
        <Animated.View style={[styles.avatar, { transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}><View pointerEvents="none" style={styles.avatarHighlight} />
          <Text style={styles.avatarText}>{initials(row.customer_name)}</Text>
        </Animated.View>

        <Pressable accessibilityRole="button" accessibilityLabel={`Open customer ${row.customer_name}`} onPress={() => onOpen(row.customer_id)} onPressIn={() => animatePress(0.98)} onPressOut={() => animatePress(1)} style={({ pressed }) => [styles.customerMain, pressed && styles.customerMainPressed]}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.customerName}>{row.customer_name}</Text>
            <Animated.View accessibilityLabel={isActive ? 'Active customer' : 'Inactive customer'} style={[styles.statusDot, isActive ? styles.statusDotActive : styles.statusDotInactive, { transform: [{ scale: entrance }] }]} />
          </View>
          <Text numberOfLines={1} style={styles.meta}>{row.customer_code || 'Customer code pending'}{row.phone ? ` · ${row.phone}` : ''}</Text>
          <Text numberOfLines={1} style={styles.meta}>{row.intermediary_code || 'Direct / unassigned'}</Text>
        </Pressable>

        <View style={styles.actions}>
          <ContactIcon icon="call-outline" label="Call" disabled={!phone} tone="phone" motion={motion} onPress={() => phone && onContact(`tel:+91${phone}`)} />
          <ContactIcon icon="logo-whatsapp" label="WhatsApp" disabled={!phone} tone="whatsapp" motion={motion} onPress={() => phone && onContact(`https://wa.me/91${phone}`)} />
        </View>
      </Animated.View>
    </Animated.View>
  );
});

function ContactIcon({ icon, label, disabled, tone, onPress, motion }: { icon: 'call-outline' | 'logo-whatsapp'; label: string; disabled: boolean; tone: 'phone' | 'whatsapp'; onPress: () => void; motion: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  useEffect(() => () => { scale.stopAnimation(); ripple.stopAnimation(); }, [scale, ripple]);
  const press = (down: boolean) => { if (!motion) return; Animated.spring(scale, { toValue: down ? 0.92 : 1, speed: 25, bounciness: 4, useNativeDriver: true }).start(); if (down) { ripple.setValue(1); Animated.timing(ripple, { toValue: 0, duration: 350, useNativeDriver: true }).start(); } };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={() => press(true)} onPressOut={() => press(false)} style={({ pressed }) => [styles.actionButton, tone === 'whatsapp' && styles.actionButtonWhatsapp, disabled && styles.actionDisabled, pressed && !disabled && styles.pressed]}>
      <Animated.View pointerEvents="none" style={[styles.contactRipple, { backgroundColor: tone === 'whatsapp' ? '#12A64A' : '#5935E8', opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }), transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }] }]} />
      <Animated.View style={{ transform: [{ scale }] }}><Ionicons name={icon} size={16} color={tone === 'whatsapp' ? '#12A64A' : '#5935E8'} /></Animated.View>
    </Pressable>
  );
}

function useCustomerMotion() {
  const [reduced, setReduced] = useState(true);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); }).catch(() => {});
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { alive = false; reduce.remove(); app.remove(); };
  }, []);
  return focused && foreground && !reduced;
}

function useEntrance(enabled: boolean, delay = 0) {
  const progress = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!enabled || played.current) { progress.setValue(1); return; }
    played.current = true;
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 230, delay, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [enabled, delay, progress]);
  return progress;
}

function CountValue({ value, motion }: { value: number; motion: boolean }) {
  const [shown, setShown] = useState(value);
  const played = useRef(false);
  useEffect(() => {
    if (!motion || played.current || value === 0) { setShown(value); return; }
    played.current = true;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min((Date.now() - start) / 500, 1);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motion, value]);
  return <>{shown}</>;
}

function CustomerSkeleton({ motion }: { motion: boolean }) {
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { phase.setValue(0); return; }
    const animation = Animated.loop(Animated.timing(phase, { toValue: 1, duration: 1100, useNativeDriver: true, isInteraction: false }));
    animation.start();
    return () => { animation.stop(); phase.setValue(0); };
  }, [motion, phase]);
  return <View accessibilityRole="progressbar" accessibilityLabel="Finding customers">{Array.from({ length: 5 }, (_, index) => <View key={index} style={styles.cardWrap}><View style={[styles.card, { overflow: 'hidden' }]}><View style={styles.skeletonAvatar} /><View style={{ flex: 1, gap: 5 }}><View style={styles.skeletonLine} /><View style={[styles.skeletonLine, { width: '65%' }]} /><View style={[styles.skeletonLine, { width: '35%' }]} /></View><View style={styles.skeletonAvatar} /><Animated.View pointerEvents="none" style={[styles.shimmer, { transform: [{ translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-80, 400] }) }] }]} /></View></View>)}</View>;
}

function normalizePhone(value: string) { return value.replace(/\D/g, '').slice(-10); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CU'; }
function formatUpdatedAt(value: number | null) { if (!value) return 'earlier'; return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#071E49' },
  content: { paddingBottom: 16, backgroundColor: '#F5F7FB', flexGrow: 1 },
  pressed: { opacity: 0.72 },
  hero: { height: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#071E49' },
  heroOrbLarge: { position: 'absolute', right: -42, top: -55, width: 180, height: 130, borderRadius: 90, backgroundColor: '#102D59', opacity: 0.92 },
  heroOrbSmall: { position: 'absolute', right: 105, top: -32, width: 100, height: 88, borderRadius: 52, backgroundColor: '#0C2853', opacity: 0.82 },
  backButton: { width: 30, height: 34, alignItems: 'flex-start', justifyContent: 'center' },
  heroIcon: { width: 31, height: 31, marginLeft: 2, marginRight: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#D6E9FF', fontSize: 7.5, lineHeight: 9, letterSpacing: 0.85, fontWeight: '800' },
  title: { marginTop: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontWeight: '800' },

  kpiOuter: { paddingHorizontal: 10, paddingTop: 8, backgroundColor: '#F5F7FB' },
  kpiLoading: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DEE7F2' },
  kpiSkeletonBlock: { flex: 1, height: 35, borderRadius: 8, backgroundColor: '#EDEFF3' },
  kpiStrip: { height: 48, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F0' },
  kpiCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E1E7F0', backgroundColor: 'transparent' },
  selection: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#0B2E63' },
  kpiCellPressed: { opacity: 0.78 },
  kpiCopy: { minWidth: 0, alignItems: 'flex-start' },
  kpiCellFirst: { borderLeftWidth: 0 },
  kpiCellLast: {},
  kpiValue: { color: '#122B4E', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  kpiLabel: { marginTop: 1, color: '#65758D', fontSize: 7.4, lineHeight: 9.5, fontWeight: '600' },
  kpiTextActive: { color: '#FFFFFF' },

  searchBand: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, flexDirection: 'row', gap: 7 },
  searchBox: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F0', shadowColor: '#173B6C', shadowOpacity: 0.04, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 7, color: '#20344F', fontSize: 9.5, lineHeight: 13 },
  refreshButton: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE5F0' },
  banner: { marginHorizontal: 10, marginBottom: 5 },

  cardWrap: { paddingHorizontal: 10, paddingTop: 5 },
  card: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E0E8F2', shadowColor: '#15375F', shadowOpacity: 0.035, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EDFF' },
  avatarHighlight: { position: 'absolute', top: 1, left: 2, width: 30, height: 16, borderRadius: 15, backgroundColor: '#FFFFFF', opacity: 0.16 },
  contactRipple: { ...StyleSheet.absoluteFillObject, borderRadius: 15 },
  skeletonAvatar: { width: 29, height: 29, borderRadius: 18, backgroundColor: '#EDEFF3' },
  skeletonLine: { width: '85%', height: 7, borderRadius: 4, backgroundColor: '#EDEFF3' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 45, backgroundColor: '#FFFFFF', opacity: 0.45 },
  avatarText: { color: '#583CE7', fontSize: 8, lineHeight: 10, fontWeight: '800' },
  customerMain: { flex: 1, minWidth: 0, paddingVertical: 2, borderRadius: 6 },
  customerMainPressed: { opacity: 0.62 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  customerName: { flexShrink: 1, color: '#0B1A32', fontSize: 9.4, lineHeight: 12, fontWeight: '800' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusDotActive: { backgroundColor: '#1BB36B' },
  statusDotInactive: { backgroundColor: '#F3A32A' },
  meta: { marginTop: 1, color: '#60708A', fontSize: 6.9, lineHeight: 9 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionButton: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F0FF' },
  actionButtonWhatsapp: { backgroundColor: '#ECFAF0' },
  actionDisabled: { opacity: 0.3 },

  emptyWrap: { paddingHorizontal: 10, paddingTop: 16 },
  listFooter: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  loadingMoreText: { color: '#71819A', fontSize: 7.5, lineHeight: 10 },


});