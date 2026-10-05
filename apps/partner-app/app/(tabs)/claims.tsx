import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerInsurerLogoSource } from '@/lib/catalog-logos';
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
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerClaimState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In Progress' },
  { value: 'completed', label: 'Settled' },
];

let savedClaimQuery = '';
let savedClaimState: PartnerClaimState = 'all';

export default function ClaimsScreen() {
  const router = useRouter();
  const { cacheScopeKey, context } = usePartnerSession();
  const [state, setState] = useState<PartnerClaimState>(savedClaimState);
  const [query, setQuery] = useState(savedClaimQuery);
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
    const nextRows = await listPartnerClaims({ state, search: debouncedSearch, limit, offset });
    return { rows: nextRows, total: nextRows[0]?.total_count ?? 0 };
  }, [debouncedSearch, state]);

  const collection = usePartnerPagedQuery<PartnerClaimRow>({
    scopeKey: cacheScopeKey,
    key: `claims:list:${state}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const rows = collection.rows;
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
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Claims</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={15} color="#1738D5" />
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
              <Ionicons name="close-circle" size={14} color="#A5B2C8" />
            </Pressable>
          ) : null}
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
          <Ionicons name="chevron-down" size={12} color="#1738D5" />
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
    </SafeAreaView>
  );
}

function ClaimCard({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  const status = humanize(row.current_status || row.claim_state);
  const completed = row.claim_state === 'completed';
  const rejected = /reject/i.test(row.current_status || '');
  const isNew = /^new$/i.test((row.current_status || '').trim());
  const vehiclePolicy = [row.vehicle_no || 'Vehicle not linked', row.policy_no || 'External policy'].join('  |  ');
  const insurerLogo = getPartnerInsurerLogoSource(row.insurer_name);
  const mode = claimModeLabel(row.claim_service_mode);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open claim ${row.claim_no || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.claimCard, pressed && styles.claimCardPressed]}
    >
      <View style={styles.claimIconWrap}>
        <Image
          source={insurerLogo ?? PartnerAssets.navigation.claims}
          resizeMode="contain"
          style={styles.claimIcon}
          accessibilityLabel={row.insurer_name ? `${row.insurer_name} logo` : 'Claim'}
        />
      </View>

      <View style={styles.claimCopy}>
        <View style={styles.claimHeadingRow}>
          <Text numberOfLines={1} style={styles.claimNo}>{row.claim_no || 'Claim'}</Text>
          {mode ? (
            <View style={[styles.modeBadge, mode === 'External' && styles.modeBadgeExternal]}>
              <Text style={[styles.modeBadgeText, mode === 'External' && styles.modeBadgeTextExternal]}>{mode}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.claimCustomer}>{row.customer_name}</Text>
        <Text numberOfLines={1} style={styles.claimDetail}>{vehiclePolicy}</Text>
      </View>

      <View style={styles.claimStatusCenter}>
        <View style={[
          styles.statusPill,
          rejected ? styles.statusRejected : completed ? styles.statusSuccess : isNew ? styles.statusNew : styles.statusWarning,
        ]}>
          <View style={[
            styles.statusDot,
            rejected ? styles.statusDotRejected : completed ? styles.statusDotSuccess : isNew ? styles.statusDotNew : styles.statusDotWarning,
          ]} />
          <Text
            numberOfLines={1}
            style={[
              styles.statusText,
              rejected ? styles.statusTextRejected : completed ? styles.statusTextSuccess : isNew ? styles.statusTextNew : styles.statusTextWarning,
            ]}
          >
            {status}
          </Text>
        </View>
      </View>

      <View style={styles.claimSurveyorWrap}>
        <Text style={styles.claimSurveyorLabel}>Surveyor</Text>
        <Text numberOfLines={1} style={styles.claimSurveyorName}>{row.surveyor_name || '—'}</Text>
      </View>
    </Pressable>
  );
}

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

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flexGrow: 1, paddingBottom: 104, backgroundColor: '#FFFFFF' },
  pressed: { opacity: 0.76 },

  hero: { height: 162, overflow: 'hidden', backgroundColor: '#0752A2' },
  heroBackdrop: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.92 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(1,42,95,0.10)' },
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
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
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
  heroAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroAvatarText: { color: partnerTheme.colors.brandStrong, fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  heroCopy: { zIndex: 3, position: 'absolute', left: 18, bottom: 24 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 23, fontWeight: '800', letterSpacing: -0.2 },

  body: { marginTop: -13, paddingHorizontal: 10, zIndex: 5, backgroundColor: '#FFFFFF' },
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
  banner: { marginTop: 8 },
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
  tabText: { color: '#5E6C8C', textAlign: 'center', fontSize: 9, lineHeight: 12, fontWeight: '700' },
  tabTextActive: { color: '#1738D5', fontWeight: '800' },
  inlineBanner: { marginTop: 6 },

  rowWrap: { paddingHorizontal: 10, marginTop: 5 },
  claimCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
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
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6ECF4',
  },
  claimIcon: { width: 32, height: 32 },
  claimCopy: { flex: 1, minWidth: 0 },
  claimHeadingRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  claimNo: { flexShrink: 1, color: '#071D49', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  modeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: '#E8F1FF' },
  modeBadgeExternal: { backgroundColor: '#F0EAFE' },
  modeBadgeText: { color: '#2355A7', fontSize: 7.2, lineHeight: 9.5, fontWeight: '800' },
  modeBadgeTextExternal: { color: '#6842B8' },
  claimCustomer: { marginTop: 2, color: '#405A82', fontSize: 9.4, lineHeight: 12, fontWeight: '700' },
  claimDetail: { marginTop: 2, color: '#7788A5', fontSize: 8.2, lineHeight: 10.5 },
  claimStatusCenter: { width: 82, alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    maxWidth: 82,
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
  claimSurveyorWrap: { width: 62, alignItems: 'flex-end', justifyContent: 'center' },
  claimSurveyorLabel: { color: '#8491A7', fontSize: 6.8, lineHeight: 9, fontWeight: '600', textAlign: 'right' },
  claimSurveyorName: { marginTop: 1, maxWidth: 62, color: '#536987', fontSize: 7.6, lineHeight: 10, fontWeight: '800', textAlign: 'right' },

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
