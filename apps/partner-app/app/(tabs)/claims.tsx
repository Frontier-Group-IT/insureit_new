import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartnerAnchoredDropdown } from '@/components/ui/partner-anchored-dropdown';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerProfileAvatar } from '@/components/ui/partner-profile-avatar';
import { PartnerMotionBadge } from '@/components/ui/partner-motion-badge';
import { CLAIM_STAGES, claimStatusMilestone } from '@/lib/claim-tracker';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerClaimSummary,
  listPartnerClaims,
  type PartnerClaimRow,
  type PartnerClaimState,
  type PartnerClaimSummary,
} from '@/lib/claims';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 10;
let savedClaimQuery = '';
let savedClaimState: PartnerClaimState = 'all';

const CLAIM_FILTER_OPTIONS: Array<{ value: PartnerClaimState; label: string }> = [
  { value: 'all', label: 'All Claims' },
  { value: 'active', label: 'In Progress' },
  { value: 'completed', label: 'Settled' },
];

export default function ClaimsScreen() {
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
  const [state, setState] = useState<PartnerClaimState>(savedClaimState);
  const [query, setQuery] = useState(savedClaimQuery);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);
  useEffect(() => { setVisibleLimit(PAGE_SIZE); }, [state, debouncedSearch]);

  useEffect(() => {
    savedClaimQuery = query;
    savedClaimState = state;
  }, [query, state]);

  const fetchSummary = useCallback(() => getPartnerClaimSummary(), []);
  const summary = usePartnerQuery<PartnerClaimSummary>({
    scopeKey: cacheScopeKey,
    key: 'claims:summary',
    fetcher: fetchSummary,
    staleTimeMs: 90_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerClaims({ state, search: debouncedSearch, limit, offset });
    return { rows: nextRows, total: nextRows[0]?.total_count ?? 0 };
  }, [debouncedSearch, state]);

  const collection = usePartnerPageQuery<PartnerClaimRow>({
    scopeKey: cacheScopeKey,
    key: `claims:list:${state}:${debouncedSearch || 'all'}:limit:${visibleLimit}`,
    pageSize: visibleLimit,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const rows = collection.rows;
  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);
  const selectSummary = (filter: PartnerClaimState) => {
    setQuery('');
    setVisibleLimit(PAGE_SIZE);
    setState(filter);
  };
  const name = context?.identity.display_name || 'Partner';

  // The white sticky surface hides scrolling content, while the original banner remains unchanged at the top.
  // The banner, metrics, and Add Claim continue to scroll as normal.
  const [showStickyControls, setShowStickyControls] = useState(false);
  const [heroHeight, setHeroHeight] = useState(98);
  const [searchHeight, setSearchHeight] = useState(44);
  const searchControls = (
    <View style={styles.searchRow} onLayout={(event) => setSearchHeight(event.nativeEvent.layout.height)}>
      <PartnerSearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Search customer, claim number, vehicle number..."
        placeholders={['Search customer...', 'Search claim number...', 'Search vehicle number...']}
        containerStyle={styles.searchField}
      />
      <PartnerAnchoredDropdown
        visible={filterMenuOpen}
        onDismiss={() => setFilterMenuOpen(false)}
        align="right"
        menuWidth={160}
        menu={(
          <View style={styles.filterMenu}>
            {CLAIM_FILTER_OPTIONS.map((option) => {
              const active = state === option.value;
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
          accessibilityLabel="Filter claims"
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
      <View style={styles.hero} onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}>
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
              <Feather name="bell" size={20} color="#FFFFFF" />
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
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Claims</Text>
        </View>
      </View>

      <View style={styles.body}>
        {showStickyControls ? <View style={{ height: searchHeight }} /> : searchControls}

        <View style={styles.summaryRow}>
          {([
            { label: 'All Claims', filter: 'all' as const, value: summary.data?.total_claims, icon: 'document-text-outline' as const },
            { label: 'Settled Claims', filter: 'completed' as const, value: summary.data?.completed_claims, icon: 'shield-checkmark' as const },
            { label: 'In Progress', filter: 'active' as const, value: summary.data?.active_claims, icon: 'hourglass-outline' as const },
          ]).map((metric) => (
            <Pressable
              key={metric.label}
              accessibilityRole="button"
              accessibilityLabel={`Show ${metric.label}`}
              accessibilityState={{ selected: state === metric.filter && !query }}
              onPress={() => selectSummary(metric.filter)}
              style={({ pressed }) => [styles.summaryCard, (state === metric.filter && !query) && styles.summaryCardSelected, pressed && styles.summaryCardPressed]}
            >
              <View style={styles.summaryIcon}><Ionicons name={metric.icon} size={17} color="#153F88" /></View>
              <Text style={styles.summaryValue}>{metric.value == null ? '—' : metric.value.toLocaleString('en-IN')}</Text>
              <Text numberOfLines={2} style={styles.summaryLabel}>{metric.label}</Text>
              <Text style={styles.summaryChange}>—% vs last month</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add Claim"
          onPress={() => router.push('/claim/select-vehicle' as never)}
          style={({ pressed }) => [styles.addClaimButton, pressed && styles.addClaimButtonPressed]}
        >
          <View style={styles.addClaimButtonLeading}>
            <Image source={require("../../assets/partner/actions/add-claim-button.png")} style={styles.addClaimButtonIcon} resizeMode="contain" />
            <Text style={styles.addClaimButtonText}>Add Claim</Text>
          </View>
          <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
        </Pressable>

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
          <View style={styles.inlineBanner}>
            <PartnerBanner tone="warning" message={collection.error} />
          </View>
        ) : null}
      </View>
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding claims" />
  ) : collection.error ? (
    <PartnerStateView
      state="error"
      title="Claims could not be loaded"
      message={collection.error}
      actionLabel="Try again"
      onAction={() => void refreshAll()}
    />
  ) : (
    <PartnerStateView
      state="empty"
      asset={PartnerAssets.navigation.claims}
      title="No claims found"
      message="There are no claims matching this authorized scope and filter."
    />
  );

  const footer = rows.length && rows.length < collection.total ? (
    <View style={styles.listFooter}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Load More Claims"
        disabled={collection.loading || collection.changingPage}
        onPress={() => setVisibleLimit((current) => current + PAGE_SIZE)}
        style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
      >
        <Text style={styles.loadMoreText}>{collection.loading ? 'Loading Claims…' : 'Load More Claims'}</Text>
        <Feather name="chevron-down" size={13} color="#3156B8" />
      </Pressable>
    </View>
  ) : null;

  return (
    <View style={styles.safeArea}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        ref={verticalListRef}
        scrollEventThrottle={16}
        onScroll={(event) => {
          // Activate when the original heading reaches its pinned vertical position.
          // Measure the banner so layout changes do not shift the sticky threshold.
          const sticky = event.nativeEvent.contentOffset.y >= Math.max(0, heroHeight - searchHeight);
          setShowStickyControls((previous) => previous === sticky ? previous : sticky);
          if (sticky && filterMenuOpen) setFilterMenuOpen(false);
        }}
        data={rows}
        keyExtractor={(row) => row.claim_id}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <ClaimCard row={item} onPress={() => router.push(`/claim/${item.claim_id}` as never)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={<View style={styles.emptyWrap}>{empty}</View>}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={collection.refreshing || summary.refreshing}
        onRefresh={() => void refreshAll()}
      />
      </SafeAreaView>
      {isFocused ? <StatusBar style={showStickyControls ? 'light' : 'dark'} /> : null}
      {showStickyControls && safeAreaInsets.top > 0 ? <View pointerEvents="none" style={[styles.stickyStatusBarShield, { height: safeAreaInsets.top }]} /> : null}
      {showStickyControls ? (
        <View style={[styles.stickyOverlay, { top: safeAreaInsets.top }]} pointerEvents="box-none">
          <Text style={styles.stickyTitle}>Claims</Text>
          <View style={styles.stickySearchBody}>{searchControls}</View>
        </View>
      ) : null}
    </View>
  );
}

function ClaimCard({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  const completed = row.claim_state === 'completed';
  const stageIndex = claimStatusMilestone(row.current_status);
  // The list RPC supplies a broker status but not saved milestone records.
  // Show the next milestone for recognized legacy statuses such as Survey Done.
  const status = completed ? 'Completed' : stageIndex > 0
    ? CLAIM_STAGES[Math.min(stageIndex, CLAIM_STAGES.length - 1)].label
    : humanize(row.current_status || row.claim_state);
  const stageTone = completed ? 'success' : stageIndex > 0 ? 'approval' : claimStatusTone(row.current_status, row.claim_state);
  const vehicleLabel = row.vehicle_no || 'Vehicle not linked';
  const mode = claimModeLabel(row.claim_service_mode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open claim ${row.claim_no || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.claimCard, pressed && styles.claimCardPressed]}
    >
      <View style={styles.claimIconWrap}>
        <PartnerInsurerLogo
          name={row.insurer_name}
          fallback={PartnerAssets.navigation.claims}
          style={styles.claimIcon}
          accessibilityLabel={row.insurer_name ? `${row.insurer_name} logo` : 'Claim'}
        />
      </View>

      <View style={styles.claimCopy}>
        <View style={styles.claimHeadingRow}>
          <Text numberOfLines={1} style={styles.claimNo}>{row.claim_no || 'Claim'}</Text>
          {mode ? (
            <PartnerMotionBadge style={[styles.modeBadge, mode === 'External' && styles.modeBadgeExternal]}>
              <Text style={[styles.modeBadgeText, mode === 'External' && styles.modeBadgeTextExternal]}>{mode}</Text>
            </PartnerMotionBadge>
          ) : null}
        </View>
        <View style={styles.claimIdentityRow}>
          <Text style={styles.claimCustomer}>{row.customer_name}</Text>
          <View style={styles.claimVehicleLine}>
            <Text style={styles.claimSeparator}>-</Text>
            <Text numberOfLines={1} ellipsizeMode="tail" style={styles.claimDetail}>{vehicleLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.claimStatusRight}>
        <PartnerMotionBadge style={[
          styles.statusPill,
          claimToneStyles[stageTone].pill,
        ]}>
          <View style={[
            styles.statusDot,
            claimToneStyles[stageTone].dot,
          ]} />
          <Text
            numberOfLines={1}
            style={[
              styles.statusText,
              claimToneStyles[stageTone].text,
            ]}
          >
            {status}
          </Text>
        </PartnerMotionBadge>
      </View>
    </Pressable>
  );
}

type ClaimStageTone = 'draft' | 'documents' | 'approval' | 'survey' | 'settlement' | 'success' | 'rejected' | 'new' | 'warning';

function claimStatusTone(status: string | null, state: string): ClaimStageTone {
  const value = (status || '').toLowerCase().replace(/[_-]/g, ' ').trim();
  if (/reject|declin/.test(value)) return 'rejected';
  if (state === 'completed' || /settled|closed|completed/.test(value)) return 'success';
  if (/^new$/.test(value)) return 'new';
  if (/draft/.test(value)) return 'draft';
  if (/document|kyc|intimation/.test(value)) return 'documents';
  if (/approv|workshop|repair/.test(value)) return 'approval';
  if (/survey|assessment|inspection/.test(value)) return 'survey';
  if (/payment|settlement|invoice/.test(value)) return 'settlement';
  return 'warning';
}

const claimToneStyles: Record<ClaimStageTone, { pill: object; dot: object; text: object }> = {
  draft: { pill: { backgroundColor: '#FDEBE2' }, dot: { backgroundColor: '#E85D29' }, text: { color: '#B7481D' } },
  documents: { pill: { backgroundColor: '#FFF3C9' }, dot: { backgroundColor: '#E9A000' }, text: { color: '#9D6400' } },
  approval: { pill: { backgroundColor: '#E4EFFF' }, dot: { backgroundColor: '#2673D9' }, text: { color: '#2058A9' } },
  survey: { pill: { backgroundColor: '#F0E8FF' }, dot: { backgroundColor: '#8752CD' }, text: { color: '#6736A8' } },
  settlement: { pill: { backgroundColor: '#DFF5F4' }, dot: { backgroundColor: '#149B95' }, text: { color: '#08766F' } },
  success: { pill: { backgroundColor: '#E4F6EE' }, dot: { backgroundColor: '#19A56F' }, text: { color: '#178157' } },
  rejected: { pill: { backgroundColor: '#FDEBEC' }, dot: { backgroundColor: '#E04F5F' }, text: { color: '#C43F50' } },
  new: { pill: { backgroundColor: '#E8F1FF' }, dot: { backgroundColor: '#3156B8' }, text: { color: '#153F88' } },
  warning: { pill: { backgroundColor: '#FFF2DD' }, dot: { backgroundColor: '#F39A1E' }, text: { color: '#B66A14' } },
};

function claimModeLabel(value: string | null) {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('external')) return 'External';
  if (normalized.includes('internal')) return 'Internal';
  return null;
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUpdatedAt(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}


const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1, paddingBottom: 104, backgroundColor: '#FFFFFF' },
  pressed: { opacity: 0.76 },
  stickyStatusBarShield: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, backgroundColor: '#082657' },
  stickyOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: "#082657" },
  stickyTitle: { marginLeft: 18, marginTop: 12, marginBottom: 12, color: "#FFFFFF", fontSize: 15, lineHeight: 18, fontWeight: "400", letterSpacing: -0.2 },
  stickySearchBody: { paddingHorizontal: 10, paddingBottom: 10, backgroundColor: "#082657" },

  hero: { height: 98, overflow: 'hidden', backgroundColor: '#071E49' },
  heroBackdrop: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.92 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,42,95,0.10)' },
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
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  heroActions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 },
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
  },
  heroAvatarText: { color: partnerTheme.colors.brandStrong, fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  heroCopy: { zIndex: 3, position: 'absolute', left: 18, bottom: 12 },
  heroTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '800', letterSpacing: -0.2 },

  body: { paddingHorizontal: 10, zIndex: 5, backgroundColor: '#FFFFFF' },
  searchRow: {
    marginTop: -10,
    marginHorizontal: 6,
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
  filterText: { color: '#3156B8', ...partnerTheme.typography.caption, fontWeight: '700' },
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
  filterOptionText: { color: '#506079', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  filterOptionTextActive: { color: '#3156B8', fontWeight: '800' },
  banner: { marginTop: 8 },
  addClaimButton: { marginTop: 10, height: 60, borderRadius: 12, backgroundColor: '#183864', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  addClaimButtonLeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addClaimButtonIcon: { width: 42, height: 42 },
  addClaimButtonPressed: { opacity: 0.8 },
  addClaimButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 5, marginTop: 8 },
  summaryCard: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3ECF8', borderRadius: 9, elevation: 1 },
  summaryCardSelected: { backgroundColor: '#E8F1FF', borderColor: '#2458C5', borderBottomWidth: 3 },
  summaryCardPressed: { backgroundColor: '#E8F1FF' },
  summaryIcon: { width: 27, height: 27, borderRadius: 9, backgroundColor: '#EDF4FF', alignItems: 'center', justifyContent: 'center' },
  summaryValue: { marginTop: 3, color: '#153F88', fontSize: 15, fontWeight: '800' },
  summaryLabel: { color: '#506481', fontSize: 7.5, fontWeight: '700', textAlign: 'center', minHeight: 18 },
  summaryChange: { color: '#8492A8', fontSize: 6.5, textAlign: 'center' },
  controls: {
    marginTop: 8,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE5F0',
  },
  tabs: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { backgroundColor: '#EEF4FF', borderBottomColor: '#1738D5' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabText: { color: '#5E6C8C', textAlign: 'center', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  tabTextActive: { color: '#1738D5', fontWeight: '800' },
  tabCount: { color: '#7A88A3', fontSize: 8.2, lineHeight: 11, fontWeight: '800' },
  tabCountActive: { color: '#1738D5' },
  inlineBanner: { marginTop: 6 },

  rowWrap: { paddingHorizontal: 10, marginTop: 2 },
  claimCard: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1EAF5',
    shadowColor: '#12355E',
    shadowOpacity: 0.035,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  claimCardPressed: { backgroundColor: '#F4F8FF' },
  claimIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6ECF4',
  },
  claimIcon: { width: 28, height: 28 },
  claimCopy: { flex: 1, minWidth: 0 },
  claimHeadingRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  claimNo: { flexShrink: 1, color: '#071D49', fontSize: 11.5, lineHeight: 15, fontWeight: '500' },
  modeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: '#E8F1FF' },
  modeBadgeExternal: { backgroundColor: '#F0EAFE' },
  modeBadgeText: { color: '#2355A7', fontSize: 7.2, lineHeight: 9.5, fontWeight: '800' },
  modeBadgeTextExternal: { color: '#6842B8' },
  claimIdentityRow: { marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', minWidth: 0, columnGap: 4 },
  claimCustomer: { flexShrink: 0, maxWidth: '100%', color: '#405A82', fontSize: 9, lineHeight: 12, fontWeight: '400' },
  claimVehicleLine: { flex: 1, minWidth: 0, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimSeparator: { color: '#8390A7', fontSize: 9 },
  claimDetail: { flexShrink: 1, minWidth: 0, maxWidth: '100%', color: '#173D75', fontSize: 9, lineHeight: 12, fontWeight: '400' },
  claimStatusRight: { maxWidth: 110, alignItems: 'flex-end', justifyContent: 'flex-start', alignSelf: 'flex-start' },
  statusPill: {
    maxWidth: 110,
    minHeight: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  statusWarning: { backgroundColor: '#FFF2DD' },
  statusSuccess: { backgroundColor: '#E4F6EE' },
  statusRejected: { backgroundColor: '#FDEBEC' },
  statusNew: { backgroundColor: '#0B2E63' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusDotWarning: { backgroundColor: '#F39A1E' },
  statusDotSuccess: { backgroundColor: '#19A56F' },
  statusDotRejected: { backgroundColor: '#E04F5F' },
  statusDotNew: { backgroundColor: '#FFFFFF' },
  statusText: { flexShrink: 1, fontSize: 7.4, lineHeight: 9.5, fontWeight: '700', textAlign: 'center' },
  statusTextWarning: { color: '#B66A14' },
  statusTextSuccess: { color: '#178157' },
  statusTextRejected: { color: '#C43F50' },
  statusTextNew: { color: '#FFFFFF' },

  listFooter: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 12, alignItems: 'center' },
  loadMoreButton: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    backgroundColor: '#EEF4FD',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8E5F6',
  },
  loadMoreText: { color: '#1738D5', fontSize: 8, lineHeight: 11, fontWeight: '700' },
  loadingMore: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  loadingMoreText: { color: '#66789B', fontSize: 7.5, lineHeight: 10 },
  endText: { minHeight: 26, paddingTop: 6, color: '#7D8BA1', textAlign: 'center', fontSize: 7, lineHeight: 9 },
  emptyWrap: { flex: 1, paddingHorizontal: 10, paddingTop: 14, backgroundColor: '#FFFFFF' },
});