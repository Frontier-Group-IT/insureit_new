import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartnerAnchoredDropdown } from '@/components/ui/partner-anchored-dropdown';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerProfileAvatar } from '@/components/ui/partner-profile-avatar';
import { PartnerMotionBadge } from '@/components/ui/partner-motion-badge';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
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
import { getPartnerUnreadActivityCount } from '@/lib/engagement';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerNetwork } from '@/providers/partner-network-provider';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 10;
let savedPolicyQuery = '';
let savedPolicyLifecycle: PartnerPolicyLifecycle = 'all';

const POLICY_FILTER_OPTIONS: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: 'all', label: 'All Policies' },
  { value: 'in_force', label: 'Active' },
  { value: 'expiring', label: 'Expiring Soon' },
  { value: 'expired', label: 'Lapsed' },
  { value: 'upcoming', label: 'Upcoming' },
];

export default function PoliciesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const safeAreaInsets = useSafeAreaInsets();
  // SafeAreaView already offsets overlays when iOS reports a top inset.
  // Only fall back when older OTA runtimes report zero, avoiding double spacing.
  const verticalListRef = useRef<FlatList>(null);
  useFocusEffect(useCallback(() => {
    const reset = () => verticalListRef.current?.scrollToOffset({ offset: 0, animated: false });
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, []));
  const { cacheScopeKey, context, avatarUri } = usePartnerSession();
  const { isOffline } = usePartnerNetwork();
  const [lifecycle, setLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [query, setQuery] = useState(savedPolicyQuery);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [loadMoreFeedback, setLoadMoreFeedback] = useState(false);
  const [requestedLimit, setRequestedLimit] = useState(PAGE_SIZE);
  const loadMoreStartedAt = useRef(0);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setUnreadActivityCount(0);
    void getPartnerUnreadActivityCount(100)
      .then((count) => { if (!cancelled) setUnreadActivityCount(count); })
      .catch(() => { if (!cancelled) setUnreadActivityCount(0); });
    return () => { cancelled = true; };
  }, [cacheScopeKey]));
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
    setRequestedLimit(PAGE_SIZE);
    setLoadMoreFeedback(false);
  }, [lifecycle, debouncedSearch]);

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
    // The requested limit is part of the cache identity. Without this, increasing
    // 10 -> 20 can reuse the cached 10-row "page 0" result and appear to do nothing.
    key: `policies:list:${lifecycle}:${debouncedSearch || 'all'}:limit:${visibleLimit}`,
    pageSize: visibleLimit,
    fetchPage,
    staleTimeMs: 60_000,
  });

  useEffect(() => {
    if (!loadMoreFeedback) return;

    const reachedRequestedSize =
      collection.rows.length >= requestedLimit ||
      (collection.total > 0 && collection.rows.length >= collection.total);
    const finishedRequest = !collection.loading && !collection.changingPage && reachedRequestedSize;

    if (!finishedRequest && !collection.error) return;

    const elapsed = Date.now() - loadMoreStartedAt.current;
    const remaining = Math.max(0, 900 - elapsed);
    const timer = setTimeout(() => setLoadMoreFeedback(false), remaining);
    return () => clearTimeout(timer);
  }, [
    collection.changingPage,
    collection.error,
    collection.loading,
    collection.rows.length,
    collection.total,
    loadMoreFeedback,
    requestedLimit,
  ]);

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const selectSummary = (filter: PartnerPolicyLifecycle) => {
    setQuery('');
    setVisibleLimit(PAGE_SIZE);
    setLifecycle(filter);
  };
  const name = context?.identity.display_name || 'Partner';

  // Keep the search/filter row visible once the list scrolls past the hero.
  // A same-size spacer preserves scroll position when the search docks.
  const [searchSticky, setSearchSticky] = useState(false);
  const searchTopY = useRef(Number.POSITIVE_INFINITY);
  const searchControls = (
      <View style={styles.searchRow}>
        <PartnerSearchField
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search customer, vehicle number or policy number..."
          placeholders={['Search customer...', 'Search vehicle number...', 'Search policy number...']}
          containerStyle={styles.searchField}
        />
        <PartnerAnchoredDropdown
          visible={filterMenuOpen}
          onDismiss={() => setFilterMenuOpen(false)}
          align="right"
          menuWidth={170}
          menu={(
            <View style={styles.filterMenu}>
              {POLICY_FILTER_OPTIONS.map((option) => {
                const active = lifecycle === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setFilterMenuOpen(false);
                      selectSummary(option.value);
                    }}
                    style={({ pressed }) => [styles.filterOption, active && styles.filterOptionActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>
                    {active ? <Ionicons name="checkmark" size={15} color="#3156B8" /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter policies"
            accessibilityState={{ expanded: filterMenuOpen }}
            onPress={() => setFilterMenuOpen((open) => !open)}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <Ionicons name="filter-outline" size={18} color="#3156B8" />
            <Text style={styles.filterText}>Filter</Text>
          </Pressable>
        </PartnerAnchoredDropdown>
      </View>

  );

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
              accessibilityLabel={unreadActivityCount ? `View recent activity, ${unreadActivityCount} unread` : "View recent activity"}
              onPress={() => router.push('/activity')}
              style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
            >
              <Feather name="bell" size={20} color="#FFFFFF" />
              {unreadActivityCount > 0 ? <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>{unreadActivityCount > 99 ? "99+" : unreadActivityCount}</Text></View> : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.heroAvatarTouch, pressed && styles.pressed]}
            >
              <PartnerProfileAvatar
                name={name}
                uri={avatarUri}
                size={35}
                backgroundColor="#FFFFFF"
                textColor={partnerTheme.colors.brandStrong}
                style={styles.heroAvatar}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroHeadingRow}>
          <Text style={styles.heroTitle}>Policies</Text>

        </View>
      </View>

      <View onLayout={(event) => { searchTopY.current = event.nativeEvent.layout.y; }}>
        {searchSticky ? <View style={styles.searchSpacer} /> : searchControls}
      </View>

      <View style={styles.summaryRow}>
        {([
          { label: 'Total Policies', filter: 'all' as const, value: summary.data?.total_policies, icon: 'document-text' as const, tint: '#2559AD' },
          { label: 'Active Policies', filter: 'in_force' as const, value: summary.data?.in_force_policies, icon: 'shield-checkmark' as const, tint: '#123B83' },
          { label: 'Expiring Soon', filter: 'expiring' as const, value: summary.data?.expiring_30_days, icon: 'hourglass' as const, tint: '#2347A2' },
          { label: 'Lapsed Policies', filter: 'expired' as const, value: summary.data?.expired_policies, icon: 'close-circle' as const, tint: '#163B82' },
          { label: 'Upcoming', filter: 'upcoming' as const, value: summary.data?.upcoming_policies, icon: 'calendar' as const, tint: '#3156B8' },
        ]).map((metric) => (
          <Pressable
            key={metric.label}
            accessibilityRole="button"
            accessibilityLabel={`Show ${metric.label}`}
            accessibilityState={{ selected: lifecycle === metric.filter && query.length === 0 }}
            onPress={() => selectSummary(metric.filter)}
            style={({ pressed }) => [styles.summaryCard, (lifecycle === metric.filter && query.length === 0) && styles.summaryCardSelected, pressed && styles.summaryCardPressed]}
          >
            <View style={styles.summaryIcon}>
              <Ionicons name={metric.icon} size={19} color={metric.tint} />
            </View>
            <Text style={styles.summaryValue}>{metric.value === undefined ? '—' : metric.value.toLocaleString('en-IN')}</Text>
            <Text numberOfLines={2} style={styles.summaryLabel}>{metric.label}</Text>
            <Text style={styles.summaryPercent}>{formatPortfolioShare(metric.value, summary.data?.total_policies)}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Policy Intake"
        onPress={() => router.push('/policy-intakes')}
        style={({ pressed }) => [styles.intakeBanner, pressed && styles.pressed]}
      >
        <View style={styles.intakeBannerIcon}><Ionicons name="document-text" size={23} color="#FFFFFF" /></View>
        <View style={styles.intakeBannerCopy}>
          <Text style={styles.intakeBannerTitle}>Policy Intake</Text>
          <Text style={styles.intakeBannerSubtitle}>Create new policy for your customer</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#FFFFFF" />
      </Pressable>

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

  const isLoadingMore = loadMoreFeedback || collection.loading || collection.changingPage;
  const footer = collection.rows.length && collection.rows.length < collection.total ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isLoadingMore ? 'Loading more policies' : 'Load More Policies'}
      accessibilityState={{ disabled: isLoadingMore, busy: isLoadingMore }}
      disabled={isLoadingMore}
      onPress={() => {
        const nextLimit = visibleLimit + PAGE_SIZE;
        loadMoreStartedAt.current = Date.now();
        setRequestedLimit(nextLimit);
        setLoadMoreFeedback(true);
        setVisibleLimit(nextLimit);
      }}
      style={({ pressed }) => [
        styles.loadMoreButton,
        isLoadingMore && styles.loadMoreButtonLoading,
        pressed && !isLoadingMore && styles.pressed,
      ]}
    >
      {isLoadingMore ? (
        <>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadMoreTextLoading}>Loading more policies…</Text>
        </>
      ) : (
        <>
          <Text style={styles.loadMoreText}>Load More Policies</Text>
          <Feather name="chevron-down" size={13} color="#3156B8" />
        </>
      )}
    </Pressable>
  ) : null;

  return (
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        ref={verticalListRef}
        data={collection.rows}
        keyExtractor={(row) => row.policy_id}
        renderItem={({ item }) => (
          <PolicyCard
            row={item}
            onPress={() => router.push(`/policy/${item.policy_id}` as never)}
          />
        )}
        ListHeaderComponent={header}
        onScroll={(event) => {
          const shouldStick = event.nativeEvent.contentOffset.y >= searchTopY.current;
          setSearchSticky((current) => current === shouldStick ? current : shouldStick);
        }}
        scrollEventThrottle={16}
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
      {isFocused ? <StatusBar style={searchSticky ? 'light' : 'dark'} /> : null}
      {searchSticky && safeAreaInsets.top > 0 ? <View pointerEvents="none" style={[styles.stickyStatusBarShield, { height: safeAreaInsets.top }]} /> : null}
      {searchSticky ? <View style={[styles.stickySearchOverlay, { top: safeAreaInsets.top }]} pointerEvents="box-none"><Text style={styles.stickyClaimsHeading}>Policies</Text>{searchControls}</View> : null}
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
        <PartnerMotionBadge style={[styles.statusPill, { backgroundColor: status.background }]}>
          <View style={[styles.statusDot, { backgroundColor: status.foreground }]} />
          <Text style={[styles.statusText, { color: status.foreground }]}>{status.label}</Text>
        </PartnerMotionBadge>
        <Text style={styles.policyPeriod}>{formatDate(row.start_date)} - {formatDate(row.end_date)}</Text>
      </View>
    </Pressable>
  );
}

/** Portfolio composition, not month-over-month growth. No percentage when summary is unavailable. */
function formatPortfolioShare(count: number | undefined, total: number | undefined) {
  if (count == null || total == null || !Number.isFinite(count) || !Number.isFinite(total) || total < 0) return '—';
  if (total === 0) return '0% of total';
  const percentage = (count / total) * 100;
  const formatted = Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1);
  return `${formatted}% of total`;
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


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 108, backgroundColor: '#FFFFFF' },
  contentEmpty: { flexGrow: 1 },
  hero: {
    height: 98,
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
    top: 13,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 35,
  },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
  heroLogo: { width: 30, height: 35, tintColor: '#FFFFFF' },
  heroBrandCopy: { justifyContent: 'center' },
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800', letterSpacing: -0.08 },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800', letterSpacing: -0.08 },
  heroActions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 },
  unreadBadge: {
    position: 'absolute', top: -8, right: -9, minWidth: 21, height: 21,
    paddingHorizontal: 4, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E53445', borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: Platform.OS === 'ios' ? '400' : '900' },
  heroIconButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,33,78,0.72)',
    borderWidth: 1.25,
    borderColor: '#FFFFFF',
  },
  heroAvatarTouch: { borderRadius: 18 },
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
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: Platform.OS === 'ios' ? '400' : '800',
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
  intakeHeaderText: { color: '#0B2E63', fontSize: 9.5, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  searchSpacer: { height: 44, marginTop: -10, marginHorizontal: 16 },
  stickyStatusBarShield: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, backgroundColor: '#082657' },
  stickySearchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: '#082657', paddingTop: 12, paddingBottom: 10 },
  stickyClaimsHeading: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '400', marginLeft: 18, marginBottom: 12 },
  searchRow: {
    zIndex: 5,
    marginTop: -10,
    marginHorizontal: 16,
    height: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DFEA',
    overflow: 'hidden',
    shadowColor: '#173B6C',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchField: {
    flex: 1,
    minHeight: 44,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: '#FFFFFF',
  },
  filterButton: {
    height: 44,
    minWidth: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#D9DFEA',
  },
  filterText: { color: '#3156B8', ...partnerTheme.typography.caption, fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  filterMenu: {
    overflow: 'hidden',
    borderRadius: 12,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE6F1',
    shadowColor: '#102449',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  filterOption: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  filterOptionActive: { backgroundColor: '#F0F5FF' },
  filterOptionText: { color: '#506079', fontSize: 10, lineHeight: 13, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  filterOptionTextActive: { color: '#3156B8', fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  summaryRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 9, gap: 3 },
  summaryCard: { flex: 1, minWidth: 0, minHeight: 86, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 2, borderRadius: 9, backgroundColor: '#F6F9FF', borderWidth: 1, borderColor: '#E8EFFB', shadowColor: '#17448C', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  summaryCardSelected: { backgroundColor: '#E8F1FF', borderColor: '#2458C5', borderBottomWidth: 3 },
  summaryCardPressed: { backgroundColor: '#E8F1FF' },
  summaryIcon: { width: 27, height: 27, borderRadius: 8, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  summaryValue: { marginTop: 3, color: '#153C89', fontSize: 17, lineHeight: 19, fontWeight: Platform.OS === 'ios' ? '400' : '900' },
  summaryLabel: { marginTop: 2, color: '#6077A0', fontSize: 7.5, lineHeight: 10, textAlign: 'center', fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  summaryPercent: { marginTop: 2, color: '#3156B8', fontSize: 7, lineHeight: 9, textAlign: 'center', fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  intakeBanner: { marginHorizontal: 12, marginTop: 8, minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#082D70', borderWidth: 1, borderColor: '#0C4794' },
  intakeBannerIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#174F9C' },
  intakeBannerCopy: { flex: 1 },
  intakeBannerTitle: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  intakeBannerSubtitle: { marginTop: 2, color: '#D6E6FF', fontSize: 8.5, lineHeight: 11 },
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
  tabText: { color: '#708099', textAlign: 'center', fontSize: 9.2, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  tabTextActive: { color: '#183E87', fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  tabCount: { color: '#8B98AA', fontSize: 8.2, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  tabCountActive: { color: '#3156B8' },
  cardGap: { height: 2 },
  policyCard: {
    minHeight: 54,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9F3',
  },
  policyCardPressed: { backgroundColor: '#F6F9FF' },
  policyIconShell: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F8FC',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E9F3',
    overflow: 'hidden',
  },
  insurerLogo: { width: 27, height: 27 },
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
  customerName: { color: '#173A7D', fontSize: 12, lineHeight: 15, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  policyNumber: { marginTop: 1, color: '#5C6C84', fontSize: 8.2, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  vehicleText: { marginTop: 1, color: '#7D8CA1', fontSize: 7.6, lineHeight: 10, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  policyRight: { width: 104, alignItems: 'flex-end' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 7.4, lineHeight: 10, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  policyPeriod: { marginTop: 2, color: '#72829A', fontSize: 7.1, lineHeight: 9.5, fontWeight: Platform.OS === 'ios' ? '400' : '600', textAlign: 'right' },
  listFooter: { minHeight: 58, marginHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: '#708099', fontSize: 8, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  loadMoreButton: {
    marginHorizontal: 12,
    marginTop: 5,
    minHeight: 36,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5FD',
  },
  loadMoreButtonLoading: { backgroundColor: '#3156B8' },
  loadMoreText: { color: '#3156B8', fontSize: 8, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  loadMoreTextLoading: { color: '#FFFFFF', fontSize: 8.5, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  endText: { color: '#9AA6B7', fontSize: 7, lineHeight: 10, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  pressed: { opacity: 0.72 },
});