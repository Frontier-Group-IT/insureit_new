import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { canPartnerStartClaim } from '@/lib/partner-permissions';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 10;
let savedClaimQuery = '';
let savedClaimState: PartnerClaimState = 'all';

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
  const [filterOpen, setFilterOpen] = useState(false);
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
        suggestions={debouncedSearch.length >= 2 ? rows.flatMap(r => [r.claim_no || "",r.insurer_claim_no || "",r.customer_name,r.vehicle_no || "",r.policy_no || "",r.insurer_name || ""]) : []}
        placeholder="Search customer, claim number, vehicle number..."
        placeholders={['Search customer...', 'Search claim number...', 'Search vehicle number...']}
        containerStyle={styles.searchField}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Filter claims"
        accessibilityHint="Choose a claim status" onPress={() => setFilterOpen(true)}
        style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
        <Ionicons name="options-outline" size={21} color="#17365D" />
      </Pressable>
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
        <View style={styles.heroBottomRow}>
          <Text style={styles.heroTitle}>Claims</Text>
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
          <View style={styles.stickyHeadingRow}>
            <Text style={styles.stickyTitle}>Claims</Text>
            {canPartnerStartClaim(context) ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Add Claim"
                onPress={() => router.push('/claim/select-vehicle' as never)}
                style={({ pressed }) => [styles.stickyAddClaim, pressed && styles.pressed]}>
                <Ionicons name="add-circle-outline" size={15} color="#FFFFFF" />
                <Text style={styles.stickyAddClaimText}>Add Claim</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.stickySearchBody}>{searchControls}</View>
        </View>
      ) : null}
      <Modal transparent visible={filterOpen} animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.filterBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} accessibilityLabel="Close filters" onPress={() => setFilterOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeading}>
              <Text style={styles.filterSheetTitle}>Filter Claims</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close filters"
                onPress={() => setFilterOpen(false)} style={styles.filterClose}>
                <Ionicons name="close" size={21} color="#17365D" />
              </Pressable>
            </View>
            {([
              { label: 'All Claims', filter: 'all' as const, count: summary.data?.total_claims },
              { label: 'Settled', filter: 'completed' as const, count: summary.data?.completed_claims },
              { label: 'In Progress', filter: 'active' as const, count: summary.data?.active_claims },
            ]).map(option => (
              <Pressable key={option.filter} accessibilityRole="button"
                accessibilityState={{ selected: state === option.filter }}
                onPress={() => { selectSummary(option.filter); setFilterOpen(false); }}
                style={({ pressed }) => [styles.filterChoice, pressed && styles.pressed]}>
                <Text style={styles.filterChoiceLabel}>{option.label}</Text>
                <Text style={styles.filterChoiceCount}>{option.count == null ? '—' : option.count.toLocaleString('en-IN')}</Text>
                <Ionicons name={state === option.filter ? 'radio-button-on' : 'radio-button-off'} size={21} color="#17365D" />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
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
  stickyHeadingRow: { marginHorizontal: 16, marginTop: 8, marginBottom: 7, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stickyTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '700' },
  stickyAddClaim: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 12 },
  stickyAddClaimText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
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
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
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
  heroAvatarText: { color: partnerTheme.colors.brandStrong, fontSize: 11.5, lineHeight: 15, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  heroBottomRow: { zIndex: 3, position: 'absolute', left: 18, right: 16, bottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 35 },
  heroTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '700' },
  heroAddClaim: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, borderRadius: 18, borderColor: '#FFFFFF', borderWidth: 1.3, backgroundColor: 'rgba(4,33,78,0.70)' },
  heroAddClaimText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  body: { paddingHorizontal: 10, zIndex: 5, backgroundColor: '#FFFFFF' },
  searchRow: {
    marginTop: 10,
    marginHorizontal: 6,
    height: 44,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
    shadowColor: '#173B6C',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchField: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D9DFEA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  filterButton: { height: 44, width: 44, marginLeft: 8, borderRadius: 14, borderWidth: 1, borderColor: '#D9DFEA', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FC' },
  filterBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,22,46,0.40)' },
  filterSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32 },
  filterSheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  filterSheetTitle: { color: '#17365D', fontWeight: '700', fontSize: 17 },
  filterClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F5FB' },
  filterChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomColor: '#E8EDF4', borderBottomWidth: StyleSheet.hairlineWidth },
  filterChoiceLabel: { flex: 1, color: '#263E5D', fontWeight: '600', fontSize: 13 },
  filterChoiceCount: { color: '#667893', fontSize: 12 },
  banner: { marginTop: 8 },
  summaryRow: { marginTop: 13, marginBottom: 10, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' },
  summaryChips: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  summaryChip: { flex: 1, minWidth: 0, minHeight: 62, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 3, borderRadius: 13, backgroundColor: '#F5F7FB', borderWidth: 1, borderColor: '#EDF0F6' },
  summaryChipSelected: { backgroundColor: '#17365D', borderColor: '#17365D' },
  summaryChipPressed: { opacity: 0.78 },
  summaryChipLabel: { color: '#52627B', fontSize: 10, lineHeight: 13, fontWeight: '600', flexShrink: 1 },
  summaryChipLabelSelected: { color: '#FFFFFF' },
  summaryChipCount: { color: '#17365D', fontSize: 19, lineHeight: 23, fontWeight: '700', flexShrink: 0 },
  summaryChipCountSelected: { color: '#E2EEFF' },
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
  tabText: { color: '#5E6C8C', textAlign: 'center', fontSize: 9, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  tabTextActive: { color: '#1738D5', fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  tabCount: { color: '#7A88A3', fontSize: 8.2, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
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
  modeBadgeText: { color: '#2355A7', fontSize: 7.2, lineHeight: 9.5, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  modeBadgeTextExternal: { color: '#6842B8' },
  claimIdentityRow: { marginTop: 3, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', minWidth: 0, columnGap: 4 },
  claimCustomer: { flexShrink: 0, maxWidth: '100%', color: '#405A82', fontSize: 9, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '400' },
  claimVehicleLine: { flex: 1, minWidth: 0, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimSeparator: { color: '#8390A7', fontSize: 9 },
  claimDetail: { flexShrink: 1, minWidth: 0, maxWidth: '100%', color: '#173D75', fontSize: 9, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '400' },
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
  statusText: { flexShrink: 1, fontSize: 8, lineHeight: 10, fontWeight: '600', textAlign: 'center' },
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
  loadMoreText: { color: '#1738D5', fontSize: 8, lineHeight: 11, fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  loadingMore: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  loadingMoreText: { color: '#66789B', fontSize: 7.5, lineHeight: 10 },
  endText: { minHeight: 26, paddingTop: 6, color: '#7D8BA1', textAlign: 'center', fontSize: 7, lineHeight: 9 },
  emptyWrap: { flex: 1, paddingHorizontal: 10, paddingTop: 14, backgroundColor: '#FFFFFF' },
});