import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
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
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerPagination } from '@/components/ui/partner-pagination';
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
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerNetwork } from '@/providers/partner-network-provider';
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
  const { cacheScopeKey, context } = usePartnerSession();
  const { isOffline } = usePartnerNetwork();
  const [lifecycle, setLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [query, setQuery] = useState(savedPolicyQuery);
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

  const collection = usePartnerPageQuery<PartnerPolicyRow>({
    scopeKey: cacheScopeKey,
    key: `policies:list:${lifecycle}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const name = context?.identity.display_name || 'Partner';

  const header = (
    <View>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/partner/banners/claims-header-reference.jpg')}
          resizeMode="cover"
          style={styles.heroBackdrop}
        />
        <View style={styles.heroShade} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroBrand}>
            <Image
              source={require('../../assets/insureit-partner-official.png')}
              resizeMode="contain"
              style={styles.heroLogo}
              accessibilityLabel="InsureIT Partner"
            />
            <View style={styles.heroBrandCopy} accessibilityLabel="insureit Partner">
              <Text style={styles.heroBrandInsureit}>insureit</Text>
              <Text style={styles.heroBrandPartner}>Partner</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View recent activity"
              onPress={() => router.push('/activity')}
              style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
            >
              <Feather name="clock" size={17} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.heroAvatar, pressed && styles.pressed]}
            >
              <Text style={styles.heroAvatarText}>{initials(name)}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.heroHeadingRow}>
          <Text style={styles.heroTitle}>Policies</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Policy Intake"
            onPress={() => router.push('/policy-intakes')}
            style={({ pressed }) => [styles.intakeHeaderButton, pressed && styles.pressed]}
          >
            <Ionicons name="add-circle-outline" size={16} color="#0B2E63" />
            <Text style={styles.intakeHeaderText}>Policy Intake</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchRow}>
        <PartnerSearchField
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search customer, vehicle number or policy number..."
        />
      </View>

      {isOffline || collection.stale || summary.stale ? (
        <View style={styles.feedback}>
          <PartnerBanner
            tone="warning"
            title={isOffline ? "You're offline" : 'Showing cached information'}
            message={isOffline
              ? 'Available cached information remains visible. Reconnect to refresh.'
              : `Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`}
          />
        </View>
      ) : null}

      <View style={styles.tabsRow}>
        <View style={styles.tabsScroller}>
          {filters.map((filter) => {
            const active = lifecycle === filter.value;
            const count = policyFilterCount(summary.data, filter.value);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${filter.label}${count === null ? '' : ` ${count}`}`}
                key={filter.value}
                onPress={() => setLifecycle(filter.value)}
                style={({ pressed }) => [styles.tabButton, active && styles.tabButtonActive, pressed && styles.pressed]}
              >
                <View style={styles.tabLabelRow}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{filter.label}</Text>
                  {count === null ? null : (
                    <Text style={[styles.tabCount, active && styles.tabCountActive]}>({count})</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        key={`policies-page-${collection.page}`}
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
        {row.insurer_name ? (
          <PartnerInsurerLogo
            name={row.insurer_name}
            style={styles.insurerLogo}
            accessibilityLabel={row.insurer_name}
          />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={20} color="#2459B7" />
            <View style={styles.policyIconMini}>
              <Ionicons name="shield-checkmark" size={8} color="#FFFFFF" />
            </View>
          </>
        )}
      </View>

      <View style={styles.policyMain}>
        <Text numberOfLines={1} style={styles.customerName}>{row.customer_name}</Text>
        <Text numberOfLines={1} style={styles.policyNumber}>{row.policy_no || row.policy_code || 'Policy'}</Text>
        <Text numberOfLines={1} style={styles.vehicleText}>{row.vehicle_no || category}</Text>
      </View>

      <View style={styles.policyRight}>
        <View style={[styles.statusPill, { backgroundColor: status.background }]}>
          <View style={[styles.statusDot, { backgroundColor: status.foreground }]} />
          <Text style={[styles.statusText, { color: status.foreground }]}>{status.label}</Text>
        </View>
        <Text style={styles.policyPeriod}>{formatDate(row.start_date)} - {formatDate(row.end_date)}</Text>
      </View>
    </Pressable>
  );
}

function policyFilterCount(summary: PartnerPolicySummary | null, lifecycle: PartnerPolicyLifecycle) {
  if (!summary) return null;
  if (lifecycle === 'in_force') return summary.in_force_policies;
  if (lifecycle === 'expiring') return summary.expiring_30_days;
  if (lifecycle === 'expired') return summary.expired_policies;
  if (lifecycle === 'upcoming') return summary.upcoming_policies;
  return summary.total_policies;
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

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 108, backgroundColor: '#FFFFFF' },
  contentEmpty: { flexGrow: 1 },
  hero: {
    height: 162,
    overflow: 'hidden',
    backgroundColor: '#0752A2',
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.92,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1,42,95,0.10)',
  },
  heroTopRow: {
    zIndex: 3,
    position: 'absolute',
    top: 30,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
  heroLogo: { width: 30, height: 35, tintColor: '#FFFFFF' },
  heroBrandCopy: { justifyContent: 'center' },
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '800', letterSpacing: -0.08 },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: '800', letterSpacing: -0.08 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroIconButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,33,78,0.72)',
    borderWidth: 1.25,
    borderColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#001B42',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#001B42',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroAvatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  heroHeadingRow: {
    zIndex: 3,
    position: 'absolute',
    left: 18,
    right: 15,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  intakeHeaderButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#001B42',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  intakeHeaderText: { color: '#0B2E63', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
  searchRow: {
    marginTop: -14,
    marginHorizontal: 12,
    zIndex: 4,
  },
  feedback: { marginHorizontal: 12, marginTop: 7 },
  tabsRow: {
    minHeight: 48,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  tabsScroller: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { backgroundColor: '#EEF4FF', borderBottomColor: '#3156B8' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2.5 },
  tabText: { color: '#708099', textAlign: 'center', fontSize: 9.2, lineHeight: 12, fontWeight: '700' },
  tabTextActive: { color: '#183E87', fontWeight: '800' },
  tabCount: { color: '#8B98AA', fontSize: 8.2, lineHeight: 11, fontWeight: '800' },
  tabCountActive: { color: '#3156B8' },
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
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E9F3',
    overflow: 'hidden',
  },
  insurerLogo: { width: 31, height: 31 },
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
  customerName: { color: '#173A7D', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  policyNumber: { marginTop: 2, color: '#5C6C84', fontSize: 8.2, lineHeight: 11, fontWeight: '600' },
  vehicleText: { marginTop: 2, color: '#7D8CA1', fontSize: 7.6, lineHeight: 10, fontWeight: '600' },
  policyRight: { width: 104, alignItems: 'flex-end' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 7.4, lineHeight: 10, fontWeight: '800' },
  policyPeriod: { marginTop: 4, color: '#72829A', fontSize: 7.1, lineHeight: 9.5, fontWeight: '600', textAlign: 'right' },
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