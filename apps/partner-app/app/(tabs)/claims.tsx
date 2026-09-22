import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  getPartnerClaimSummary,
  listPartnerClaims,
  type PartnerClaimRow,
  type PartnerClaimState,
  type PartnerClaimSummary,
} from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerClaimState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In Progress' },
  { value: 'completed', label: 'Settled' },
];
type SortOrder = 'newest' | 'oldest';

let savedClaimQuery = '';
let savedClaimState: PartnerClaimState = 'all';

export default function ClaimsScreen() {
  const router = useRouter();
  const { cacheScopeKey, context } = usePartnerSession();
  const [state, setState] = useState<PartnerClaimState>(savedClaimState);
  const [query, setQuery] = useState(savedClaimQuery);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

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
    const nextRows = await listPartnerClaims({
      state,
      search: debouncedSearch,
      limit,
      offset,
    });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch, state]);

  const collection = usePartnerPagedQuery<PartnerClaimRow>({
    scopeKey: cacheScopeKey,
    key: `claims:list:${state}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const rows = useMemo(() => {
    return [...collection.rows].sort((left, right) => {
      const leftTime = new Date(left.accident_at || left.created_at).getTime() || 0;
      const rightTime = new Date(right.accident_at || right.created_at).getTime() || 0;
      return sortOrder === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [collection.rows, sortOrder]);

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const name = context?.identity.display_name || 'Partner';

  const header = (
    <View>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/figma-dashboard/hero-banner.jpg')}
          resizeMode="cover"
          style={styles.heroBackdrop}
        />
        <View style={styles.heroShade} />

        <View style={styles.heroTopRow}>
          <Image
            source={require('../../assets/insureit-partner-official.png')}
            resizeMode="contain"
            style={styles.officialLogo}
            accessibilityLabel="InsureIT Partner"
          />
          <View style={styles.heroActions}>
            <PartnerIconButton
              icon="time-outline"
              label="View recent activity"
              onPress={() => router.push('/activity')}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push('/profile')}
              style={({ pressed }) => [styles.avatarTouch, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(name)}</Text>
              </View>
            </Pressable>
          </View>

        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Claims</Text>
          <Text style={styles.heroSubtitle}>Support. Settle. Keep{'\\n'}Your Business Moving.</Text>
        </View>

        <View pointerEvents="none" style={styles.heroArtworkWrap}>
          <Image source={PartnerAssets.navigation.claims} resizeMode="contain" style={styles.heroArtwork} />
        </View>      </View>

      <View style={styles.body}>
        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={22} color="#1738D5" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customer, claim number, vehicle number..."
            placeholderTextColor="#7A8AAA"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#A5B2C8" />
            </Pressable>
          ) : null}
          <View style={styles.searchDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter claims"
            onPress={() => setFilterOpen(true)}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <Ionicons name="filter-outline" size={21} color="#1738D5" />
            <Text style={styles.filterText}>Filter</Text>
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

        {summary.loading && !summary.data ? (
          <View style={styles.summaryLoading}>
            <ActivityIndicator color={partnerTheme.colors.brand} />
          </View>
        ) : (
          <View style={styles.kpiGrid}>
            <MetricCard icon="document-text-outline" value={summary.data?.total_claims ?? 0} label="Total Claims" />
            <MetricCard icon="shield-checkmark-outline" value={summary.data?.completed_claims ?? 0} label="Settled Claims" />
            <MetricCard icon="hourglass-outline" value={summary.data?.active_claims ?? 0} label="In Progress" />
            <MetricCard icon="headset-outline" value={summary.data?.assistance_requested ?? 0} label="Assistance" />
          </View>
        )}

        <View style={styles.controls}>
          <View style={styles.tabs}>
            {filters.map((filter) => {
              const active = filter.value === state;
              return (
                <Pressable
                  key={filter.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setState(filter.value)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sort claims"
            onPress={() => setSortOpen(true)}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
          >
            <Text style={styles.sortText}>Sort By</Text>
            <Ionicons name="chevron-down" size={17} color="#1E31D3" />
          </Pressable>
        </View>

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

  const footer = rows.length ? (
    <View style={styles.listFooter}>
      {collection.loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator color="#1738D5" />
          <Text style={styles.loadingMoreText}>Loading more claims…</Text>
        </View>
      ) : collection.rows.length < collection.total ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Load more claims"
          onPress={() => void collection.loadMore()}
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
        >
          <Text style={styles.loadMoreText}>Load More Claims</Text>
          <Ionicons name="chevron-down" size={18} color="#1738D5" />
        </Pressable>
      ) : (
        <Text style={styles.endText}>End of claim book</Text>
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
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

      <ChoiceModal
        visible={filterOpen}
        title="Filter claims"
        options={filters.map((filter) => ({
          key: filter.value,
          label: filter.label,
          selected: state === filter.value,
          onPress: () => {
            setState(filter.value);
            setFilterOpen(false);
          },
        }))}
        onClose={() => setFilterOpen(false)}
      />

      <ChoiceModal
        visible={sortOpen}
        title="Sort claims"
        options={[
          {
            key: 'newest',
            label: 'Newest first',
            selected: sortOrder === 'newest',
            onPress: () => {
              setSortOrder('newest');
              setSortOpen(false);
            },
          },
          {
            key: 'oldest',
            label: 'Oldest first',
            selected: sortOrder === 'oldest',
            onPress: () => {
              setSortOrder('oldest');
              setSortOpen(false);
            },
          },
        ]}
        onClose={() => setSortOpen(false)}
      />
    </SafeAreaView>
  );
}

function MetricCard({ icon, value, label }: { icon: ComponentProps<typeof Ionicons>['name']; value: number; label: string }) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiIconWrap}>
        <Ionicons name={icon} size={24} color="#0D4185" />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.kpiLabel}>{label}</Text>
      <View style={styles.scopeLine}>
        <Ionicons name="analytics-outline" size={11} color="#19A56F" />
        <Text style={styles.scopeText}>Current scope</Text>
      </View>
    </View>
  );
}

function ClaimCard({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  const status = humanize(row.current_status || row.claim_state);
  const completed = row.claim_state === 'completed';
  const vehiclePolicy = [row.vehicle_no || 'Vehicle not linked', row.policy_no || 'External policy'].join('  |  ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open claim ${row.claim_no || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.claimCard, pressed && styles.claimCardPressed]}
    >
      <View style={styles.claimIconWrap}>
        <Image
          source={completed ? PartnerAssets.status.verified : PartnerAssets.navigation.claims}
          resizeMode="contain"
          style={styles.claimIcon}
        />
      </View>

      <View style={styles.claimCopy}>
        <Text numberOfLines={1} style={styles.claimNo}>{row.claim_no || 'Claim'}</Text>
        <Text numberOfLines={1} style={styles.claimCustomer}>{row.customer_name} · {row.insurer_name || 'Insurer not recorded'}</Text>
        <Text numberOfLines={1} style={styles.claimDetail}>{vehiclePolicy}</Text>
        <Text numberOfLines={1} style={styles.claimAmount}>{claimAmount(row)}</Text>
      </View>

      <View style={styles.claimRight}>
        <View style={[styles.statusPill, completed ? styles.statusSuccess : styles.statusWarning]}>
          <View style={[styles.statusDot, completed ? styles.statusDotSuccess : styles.statusDotWarning]} />
          <Text numberOfLines={1} style={[styles.statusText, completed ? styles.statusTextSuccess : styles.statusTextWarning]}>{status}</Text>
        </View>
        <Text style={styles.claimDate}>Claimed on {formatDate(row.accident_at || row.created_at)}</Text>
      </View>

      <Ionicons name="chevron-forward" size={23} color="#1738D5" />
    </Pressable>
  );
}

function ChoiceModal({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Array<{ key: string; label: string; selected: boolean; onPress: () => void }>;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityLabel="Close" hitSlop={8} onPress={onClose}>
              <Ionicons name="close" size={21} color="#263B5F" />
            </Pressable>
          </View>
          {options.map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: option.selected }}
              onPress={option.onPress}
              style={({ pressed }) => [styles.modalOption, pressed && styles.pressed]}
            >
              <Text style={[styles.modalOptionText, option.selected && styles.modalOptionTextSelected]}>{option.label}</Text>
              {option.selected ? <Ionicons name="checkmark-circle" size={20} color="#1738D5" /> : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function claimAmount(row: PartnerClaimRow) {
  const value = row.settlement_amount ?? row.approved_amount ?? row.estimated_loss;
  return value == null ? 'Amount not recorded' : formatIndianCurrency(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUpdatedAt(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0752A2' },
  content: { paddingBottom: 104, backgroundColor: '#F7FAFE' },
  pressed: { opacity: 0.76 },

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
    top: 6,
    left: 16,
    right: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  officialLogo: { width: 108, height: 42 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  avatarTouch: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  heroCopy: { zIndex: 3, position: 'absolute', left: 18, top: 64, width: 148 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    marginTop: 1,
    color: '#FFFFFF',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroArtworkWrap: {
    position: 'absolute',
    right: 36,
    bottom: 4,
    width: 116,
    height: 104,
    opacity: 0.98,
  },
  heroArtwork: { width: '100%', height: '100%' },

  body: { marginTop: -13, paddingHorizontal: 10, zIndex: 5 },
  searchShell: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE6F4',
    shadowColor: '#173B6C',
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 7, color: '#18304F', fontSize: 9.5, lineHeight: 13 },
  searchDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: '#CFD9E8' },
  filterButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 1 },
  filterText: { color: '#1738D5', fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  banner: { marginTop: 8 },

  summaryLoading: {
    marginTop: 7,
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  kpiGrid: { marginTop: 7, flexDirection: 'row', gap: 4 },
  kpiCard: {
    flex: 1,
    minHeight: 84,
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1EAF5',
    shadowColor: '#12355E',
    shadowOpacity: 0.035,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECF5FF',
  },
  kpiValue: { marginTop: 1, color: '#1738D5', fontSize: 15, lineHeight: 18, fontWeight: '800' },
  kpiLabel: { minHeight: 20, color: '#3F55A1', textAlign: 'center', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },
  scopeLine: { marginTop: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  scopeText: { color: '#19A56F', fontSize: 6.5, lineHeight: 8, fontWeight: '700' },

  controls: {
    marginTop: 6,
    minHeight: 33,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E9F5',
    paddingHorizontal: 2,
  },
  tabs: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  tab: {
    minWidth: 50,
    minHeight: 31,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { backgroundColor: '#F0F5FF', borderBottomColor: '#1738D5', borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  tabText: { color: '#5E6C8C', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },
  tabTextActive: { color: '#1738D5', fontWeight: '800' },
  sortButton: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5 },
  sortText: { color: '#1E31D3', fontSize: 8, lineHeight: 10, fontWeight: '700' },
  inlineBanner: { marginTop: 6 },

  rowWrap: { paddingHorizontal: 10, marginTop: 5 },
  claimCard: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF6FF',
  },
  claimIcon: { width: 29, height: 29 },
  claimCopy: { flex: 1, minWidth: 0 },
  claimNo: { color: '#071D49', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
  claimCustomer: { marginTop: 0, color: '#51678E', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },
  claimDetail: { marginTop: 1, color: '#7788A5', fontSize: 6.8, lineHeight: 9 },
  claimAmount: { marginTop: 2, color: '#152238', fontSize: 7.2, lineHeight: 9.5, fontWeight: '700' },
  claimRight: { width: 84, alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'space-between', paddingVertical: 0 },
  statusPill: {
    maxWidth: 84,
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    borderRadius: 9,
  },
  statusWarning: { backgroundColor: '#FFF2DD' },
  statusSuccess: { backgroundColor: '#E4F6EE' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusDotWarning: { backgroundColor: '#F39A1E' },
  statusDotSuccess: { backgroundColor: '#19A56F' },
  statusText: { flexShrink: 1, fontSize: 6.6, lineHeight: 9, fontWeight: '700' },
  statusTextWarning: { color: '#B66A14' },
  statusTextSuccess: { color: '#178157' },
  claimDate: { color: '#66789B', fontSize: 6.4, lineHeight: 8.5, fontWeight: '600', textAlign: 'right' },

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
  emptyWrap: { paddingHorizontal: 10, paddingTop: 14 },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8,28,55,0.38)',
  },
  modalCard: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4EAF3',
  },
  modalTitle: { color: '#102B58', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  modalOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDF1F6',
  },
  modalOptionText: { color: '#40516F', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  modalOptionTextSelected: { color: '#1738D5', fontWeight: '800' },
});
