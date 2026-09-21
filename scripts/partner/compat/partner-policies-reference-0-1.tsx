import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerPolicySummary,
  listPartnerPolicies,
  type PartnerPolicyLifecycle,
  type PartnerPolicyRow,
  type PartnerPolicySummary,
} from '@/lib/policies';
import { PartnerAssets } from '@/lib/partner-assets';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_force', label: 'Active' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'expired', label: 'Lapsed' },
  { value: 'upcoming', label: 'Upcoming' },
];

let savedPolicyQuery = '';
let savedPolicyLifecycle: PartnerPolicyLifecycle = 'all';

export default function PoliciesScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const [lifecycle, setLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [query, setQuery] = useState(savedPolicyQuery);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    savedPolicyQuery = query;
    savedPolicyLifecycle = lifecycle;
  }, [lifecycle, query]);

  const fetchSummary = useCallback(() => getPartnerPolicySummary(), []);
  const summary = usePartnerQuery<PartnerPolicySummary>({
    scopeKey: cacheScopeKey,
    key: 'policies:summary',
    fetcher: fetchSummary,
    staleTimeMs: 2 * 60_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerPolicies({
      lifecycle,
      search: debouncedSearch,
      limit,
      offset,
    });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch, lifecycle]);

  const collection = usePartnerPagedQuery<PartnerPolicyRow>({
    scopeKey: cacheScopeKey,
    key: `policies:list:${lifecycle}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const summaryItems = useMemo(() => [
    {
      key: 'total',
      label: 'Total Policies',
      value: summary.data?.total_policies ?? 0,
      icon: 'document-text-outline' as const,
      accent: '#2A64C7',
      helper: 'Portfolio',
    },
    {
      key: 'active',
      label: 'Active Policies',
      value: summary.data?.in_force_policies ?? 0,
      icon: 'shield-checkmark-outline' as const,
      accent: '#1D9A68',
      helper: 'In force',
    },
    {
      key: 'expiring',
      label: 'Expiring Soon',
      value: summary.data?.expiring_30_days ?? 0,
      icon: 'hourglass-outline' as const,
      accent: '#C47B12',
      helper: 'Next 30 days',
    },
    {
      key: 'lapsed',
      label: 'Lapsed Policies',
      value: summary.data?.expired_policies ?? 0,
      icon: 'close-circle-outline' as const,
      accent: '#D04C4C',
      helper: 'Expired',
    },
  ], [summary.data]);

  const header = (
    <View>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/figma-dashboard/hero-banner.jpg')}
          style={styles.heroBackdrop}
          resizeMode="cover"
        />
        <View style={styles.heroBackdropShade} />
        <View style={styles.heroTopRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/insureit-partner-official.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open activity"
              onPress={() => router.push('/activity')}
              style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
            >
              <Ionicons name="notifications-outline" size={17} color="#FFFFFF" />
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
            >
              <Ionicons name="person-circle-outline" size={19} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Policies</Text>
          <Text style={styles.heroSubtitle}>Manage. Track. Grow.</Text>
        </View>

        <View style={styles.heroArtworkWrap}>
          <Image source={PartnerAssets.navigation.policies} style={styles.heroArtwork} resizeMode="contain" />
          <View style={styles.heroShield}>
            <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.heroWords}>
          <Text style={styles.heroWord}>MOTOR</Text>
          <Text style={styles.heroWord}>COMMERCIAL</Text>
          <Text style={styles.heroWord}>HEALTH</Text>
          <Text style={styles.heroWord}>LIFE</Text>
          <Text style={styles.heroWord}>PROTECTION</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <PartnerSearchField
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search customer, vehicle number or policy number..."
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle policy filters"
          accessibilityState={{ expanded: filtersVisible }}
          onPress={() => setFiltersVisible((value) => !value)}
          style={({ pressed }) => [styles.filterButton, filtersVisible && styles.filterButtonActive, pressed && styles.pressed]}
        >
          <Ionicons name="filter-outline" size={15} color="#3156B8" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </Pressable>
      </View>

      {collection.stale || summary.stale ? (
        <View style={styles.feedback}>
          <PartnerBanner
            tone="warning"
            title={collection.offline || summary.offline ? "You're offline" : 'Showing cached information'}
            message={collection.offline || summary.offline
              ? 'Available cached information remains visible. Reconnect to refresh.'
              : `Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`}
          />
        </View>
      ) : null}

      {summary.loading && !summary.data ? (
        <View style={styles.summaryLoading}>
          <PartnerStateView state="loading" title="Loading policy summary" />
        </View>
      ) : (
        <View style={styles.summaryGrid}>
          {summaryItems.map(({ key, ...item }) => (
            <SummaryCard key={key} {...item} />
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Policy Intake"
        onPress={() => router.push('/policy-intakes')}
        style={({ pressed }) => [styles.intakeCard, pressed && styles.intakePressed]}
      >
        <View style={styles.intakeIcon}>
          <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
          <View style={styles.intakePlus}>
            <Ionicons name="add" size={9} color="#123979" />
          </View>
        </View>
        <View style={styles.intakeBody}>
          <Text style={styles.intakeTitle}>Policy Intake</Text>
          <Text style={styles.intakeSubtitle}>Create new policy for your customer</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </Pressable>

      {filtersVisible ? (
        <View style={styles.tabsRow}>
          <View style={styles.tabsScroller}>
            {filters.map((filter) => {
              const active = lifecycle === filter.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={filter.value}
                  onPress={() => setLifecycle(filter.value)}
                  style={({ pressed }) => [styles.tabButton, active && styles.tabButtonActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sortAffordance}>
            <Text style={styles.sortText}>Sort by</Text>
            <Ionicons name="chevron-down" size={10} color="#3156B8" />
          </View>
        </View>
      ) : null}

      <View style={styles.bookHeader}>
        <View>
          <Text style={styles.bookTitle}>POLICY BOOK</Text>
          <Text style={styles.bookMeta}>{collection.loading ? 'Searching…' : `${collection.total} records`}</Text>
        </View>
      </View>

      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="warning" message={collection.error} />
        </View>
      ) : null}
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding policies" />
  ) : collection.error ? (
    <PartnerStateView
      state="error"
      title="Policies could not be loaded"
      message={collection.error}
      actionLabel="Try again"
      onAction={() => void refreshAll()}
    />
  ) : (
    <PartnerStateView
      state="empty"
      asset={PartnerAssets.emptyStates.noPolicies}
      title="No policies found"
      message="Try another search term or policy lifecycle filter."
    />
  );

  const footer = collection.rows.length ? (
    <View style={styles.listFooter}>
      {collection.loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator color="#3156B8" />
          <Text style={styles.loadingMoreText}>Loading more policies…</Text>
        </View>
      ) : collection.rows.length < collection.total ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Load more policies"
          onPress={() => void collection.loadMore()}
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
        >
          <Text style={styles.loadMoreText}>Load More Policies</Text>
          <Ionicons name="chevron-down" size={13} color="#3156B8" />
        </Pressable>
      ) : (
        <Text style={styles.endText}>End of policy book</Text>
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={collection.rows}
        keyExtractor={(row) => row.policy_id}
        renderItem={({ item }) => (
          <PolicyCard
            row={item}
            onPress={() => router.push(`/policy/${item.policy_id}` as never)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        ItemSeparatorComponent={() => <View style={styles.cardGap} />}
        refreshControl={(
          <RefreshControl
            refreshing={collection.refreshing || summary.refreshing}
            onRefresh={() => void refreshAll()}
            tintColor="#3156B8"
          />
        )}
        contentContainerStyle={[styles.content, !collection.rows.length && styles.contentEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  value,
  label,
  helper,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  helper: string;
  accent: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: `${accent}12` }]}>
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
      <Text numberOfLines={2} style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryHelper}>{helper}</Text>
    </View>
  );
}

function PolicyCard({ row, onPress }: { row: PartnerPolicyRow; onPress: () => void }) {
  const category = policyCategory(row);
  const status = policyStatus(row.lifecycle_status);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${category} policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.policyCard, pressed && styles.policyCardPressed]}
    >
      <View style={styles.policyIconShell}>
        <Ionicons name="document-text-outline" size={20} color="#2459B7" />
        <View style={styles.policyIconMini}>
          <Ionicons name="shield-checkmark" size={8} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.policyMain}>
        <Text numberOfLines={1} style={styles.customerName}>{row.customer_name}</Text>
        <Text numberOfLines={1} style={styles.policyNumber}>{row.policy_no || row.policy_code || 'Policy'}</Text>
        <View style={styles.policyMetaRow}>
          <Text numberOfLines={1} style={styles.vehicleText}>{row.vehicle_no || category}</Text>
          {row.insurer_name ? (
            <>
              <Text style={styles.metaDot}>•</Text>
              <Text numberOfLines={1} style={styles.insurerText}>{shortInsurer(row.insurer_name)}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.policyRight}>
        <View style={[styles.statusPill, { backgroundColor: status.background }]}>
          <View style={[styles.statusDot, { backgroundColor: status.foreground }]} />
          <Text style={[styles.statusText, { color: status.foreground }]}>{status.label}</Text>
        </View>
        <Text style={styles.policyPeriod}>{formatDate(row.start_date)} - {formatDate(row.end_date)}</Text>
      </View>

      <Ionicons name="chevron-forward" size={15} color="#3156B8" />
    </Pressable>
  );
}

function policyStatus(value: PartnerPolicyRow['lifecycle_status']) {
  if (value === 'expired') {
    return { label: 'Lapsed', foreground: '#D04C4C', background: '#FDECEC' };
  }
  if (value === 'expiring') {
    return { label: 'Expiring Soon', foreground: '#C47B12', background: '#FFF5E5' };
  }
  if (value === 'upcoming') {
    return { label: 'Upcoming', foreground: '#4C63C8', background: '#EEF0FF' };
  }
  return { label: 'Active', foreground: '#1D9A68', background: '#EAF8F2' };
}

function policyCategory(row: PartnerPolicyRow) {
  const value = [row.policy_type, row.policy_product, row.business_line].filter(Boolean).join(' ').toLowerCase();
  if (value.includes('health')) return 'Health';
  if (value.includes('life')) return 'Life';
  if (value.includes('motor') || row.vehicle_id || row.vehicle_no) return 'Motor';
  return 'Non-Motor';
}

function shortInsurer(value: string) {
  const compact = value
    .replace(/general insurance company/gi, '')
    .replace(/insurance company/gi, '')
    .replace(/limited/gi, '')
    .replace(/ltd\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return compact || value;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function formatUpdatedAt(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  content: { paddingBottom: 108 },
  contentEmpty: { flexGrow: 1 },
  hero: {
    minHeight: 158,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 30,
    backgroundColor: '#0757AE',
  },
  heroBackdrop: {
    position: 'absolute',
    left: '-6%',
    top: -8,
    width: '112%',
    height: 182,
    opacity: 0.70,
    transform: [{ scale: 0.92 }],
  },
  heroBackdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,42,93,0.14)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', maxWidth: '60%' },
  brandLogo: { width: 112, height: 34 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroIconButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,58,120,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.90)',
  },
  notificationDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    right: 5,
    top: 5,
    backgroundColor: '#F04E55',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  heroCopy: { position: 'absolute', left: 16, bottom: 25, zIndex: 3 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: '700', letterSpacing: -0.15 },
  heroSubtitle: { marginTop: 1, color: '#FFFFFF', fontSize: 11.5, lineHeight: 16, fontWeight: '500' },
  heroArtworkWrap: {
    position: 'absolute',
    right: 58,
    bottom: 2,
    width: 118,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heroArtwork: { width: 94, height: 94, opacity: 0.98 },
  heroShield: {
    position: 'absolute',
    left: 8,
    bottom: 7,
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B65C7',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  heroWords: { position: 'absolute', zIndex: 3, right: 9, bottom: 16, width: 52 },
  heroWord: { color: '#FFFFFF', fontSize: 5.5, lineHeight: 7.5, fontWeight: '800' },
  searchRow: {
    marginTop: -15,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 4,
  },
  searchBox: { flex: 1 },
  filterButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  filterButtonActive: { borderColor: '#B8C9ED' },
  filterButtonText: { color: '#3156B8', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },
  feedback: { marginHorizontal: 12, marginTop: 7 },
  summaryLoading: { marginHorizontal: 12, marginTop: 10 },
  summaryGrid: {
    marginHorizontal: 12,
    marginTop: 10,
    flexDirection: 'row',
    gap: 5,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 96,
    alignItems: 'center',
    borderRadius: 11,
    paddingHorizontal: 3,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EAF3',
  },
  summaryIcon: {
    width: 27,
    height: 27,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: { marginTop: 4, fontSize: 14, lineHeight: 16, fontWeight: '800' },
  summaryLabel: { minHeight: 20, marginTop: 2, color: '#506079', textAlign: 'center', fontSize: 7, lineHeight: 9, fontWeight: '700' },
  summaryHelper: { marginTop: 2, color: '#9AA6B7', fontSize: 5.8, lineHeight: 8, fontWeight: '600' },
  intakeCard: {
    minHeight: 48,
    marginHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 10,
    paddingHorizontal: 11,
    backgroundColor: '#073B86',
  },
  intakePressed: { opacity: 0.86 },
  intakeIcon: {
    width: 31,
    height: 31,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E58B4',
  },
  intakePlus: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  intakeBody: { flex: 1 },
  intakeTitle: { color: '#FFFFFF', fontSize: 10.5, lineHeight: 13, fontWeight: '800' },
  intakeSubtitle: { marginTop: 1, color: '#C9DAF7', fontSize: 6.7, lineHeight: 9, fontWeight: '500' },
  tabsRow: {
    minHeight: 37,
    marginHorizontal: 12,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE5F0',
  },
  tabsScroller: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  tabButton: {
    minHeight: 37,
    justifyContent: 'center',
    marginRight: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { borderBottomColor: '#3156B8' },
  tabText: { color: '#708099', fontSize: 7, lineHeight: 10, fontWeight: '700' },
  tabTextActive: { color: '#183E87' },
  sortAffordance: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 6 },
  sortText: { color: '#3156B8', fontSize: 7, lineHeight: 10, fontWeight: '700' },
  bookHeader: { marginHorizontal: 12, paddingTop: 9, paddingBottom: 6 },
  bookTitle: { color: '#708099', fontSize: 7.2, lineHeight: 10, letterSpacing: 1.2, fontWeight: '800' },
  bookMeta: { marginTop: 2, color: '#9AA6B7', fontSize: 6.4, lineHeight: 9, fontWeight: '600' },
  cardGap: { height: 5 },
  policyCard: {
    minHeight: 66,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9F3',
  },
  policyCardPressed: { backgroundColor: '#F6F9FF' },
  policyIconShell: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF4FF',
  },
  policyIconMini: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3156B8',
  },
  policyMain: { flex: 1, minWidth: 0 },
  customerName: { color: '#173A7D', fontSize: 8.8, lineHeight: 11, fontWeight: '800' },
  policyNumber: { marginTop: 2, color: '#5C6C84', fontSize: 6.7, lineHeight: 9, fontWeight: '600' },
  policyMetaRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  vehicleText: { maxWidth: '48%', color: '#7D8CA1', fontSize: 6.1, lineHeight: 8, fontWeight: '600' },
  insurerText: { flex: 1, color: '#7D8CA1', fontSize: 6.1, lineHeight: 8, fontWeight: '600' },
  metaDot: { paddingHorizontal: 3, color: '#A3AFBF', fontSize: 6, lineHeight: 8 },
  policyRight: { width: 104, alignItems: 'flex-end' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 6.3, lineHeight: 8, fontWeight: '800' },
  policyPeriod: { marginTop: 4, color: '#72829A', fontSize: 5.6, lineHeight: 8, fontWeight: '600', textAlign: 'right' },
  listFooter: { minHeight: 58, marginHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: '#708099', fontSize: 8, lineHeight: 11, fontWeight: '600' },
  loadMoreButton: {
    minHeight: 36,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5FD',
  },
  loadMoreText: { color: '#3156B8', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  endText: { color: '#9AA6B7', fontSize: 7, lineHeight: 10, fontWeight: '600' },
  pressed: { opacity: 0.72 },
});
