import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { PartnerOperationalRow } from '@/components/ui/partner-operational-row';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { PartnerTopTabs } from '@/components/ui/partner-top-tabs';
import {
  getPartnerClaimSummary,
  listPartnerClaims,
  type PartnerClaimRow,
  type PartnerClaimState,
  type PartnerClaimSummary,
} from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerClaimState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

let savedClaimQuery = '';
let savedClaimState: PartnerClaimState = 'all';

export default function ClaimsScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
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

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const header = (
    <View>
      {summary.loading && !summary.data ? (
        <PartnerStateView state="loading" title="Loading claim summary" />
      ) : (
        <PartnerListSummaryStrip
          items={[
            { key: 'total', label: 'Claims', value: summary.data?.total_claims ?? 0 },
            { key: 'active', label: 'Active', value: summary.data?.active_claims ?? 0, tone: 'warning' },
            { key: 'done', label: 'Completed', value: summary.data?.completed_claims ?? 0, tone: 'success' },
            { key: 'assist', label: 'Assistance', value: summary.data?.assistance_requested ?? 0 },
          ]}
        />
      )}

      {(collection.stale || summary.stale) ? (
        <View style={styles.banner}>
          <PartnerBanner
            tone="warning"
            title={collection.offline || summary.offline ? "You're offline" : 'Showing cached information'}
            message={`Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`}
          />
        </View>
      ) : null}

      <View style={styles.search}>
        <PartnerSearchField
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search claim, customer, vehicle or policy"
        />
      </View>

      <View style={styles.tabs}>
        <PartnerTopTabs
          activeKey={state}
          onChange={(key) => setState(key as PartnerClaimState)}
          tabs={filters.map((filter) => ({ key: filter.value, label: filter.label }))}
        />
      </View>

      <PartnerSectionHeader
        title="Claim book"
        meta={collection.loading ? 'Searching…' : `${collection.total} records`}
      />

      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.inlineBanner}>
          <PartnerBanner tone="warning" message={collection.error} />
        </View>
      ) : null}
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
      icon="shield-checkmark-outline"
      title="No claims found"
      message="There are no claims matching this authorized scope and filter."
    />
  );

  const footer = collection.rows.length ? (
    <View style={styles.listFooter}>
      {collection.loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator color={partnerTheme.colors.brand} />
          <Text style={styles.loadingMoreText}>Loading more claims…</Text>
        </View>
      ) : collection.rows.length >= collection.total ? (
        <Text style={styles.endText}>End of claim book</Text>
      ) : null}
    </View>
  ) : null;

  return (
    <PartnerListScreen
      eyebrow="SERVICE"
      title="Claims"
      data={collection.rows}
      keyExtractor={(row) => row.claim_id}
      renderItem={({ item }) => (
        <ClaimRow
          row={item}
          onPress={() => router.push(`/claim/${item.claim_id}` as never)}
        />
      )}
      header={header}
      empty={empty}
      footer={footer}
      refreshing={collection.refreshing || summary.refreshing}
      onRefresh={() => void refreshAll()}
      onEndReached={() => void collection.loadMore()}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function ClaimRow({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  const status = humanize(row.current_status || row.claim_state);
  const vehiclePolicy = [row.vehicle_no || 'Vehicle not linked', row.policy_no || 'External policy'].join(' · ');
  return (
    <PartnerOperationalRow
      title={row.claim_no || 'Claim'}
      subtitle={`${row.customer_name} · ${row.insurer_name || 'Insurer not recorded'}`}
      detail={vehiclePolicy}
      value={claimAmount(row)}
      meta={formatDate(row.accident_at || row.created_at)}
      status={<PartnerStatusBadge label={status} tone={row.claim_state === 'completed' ? 'success' : 'warning'} />}
      leading={
        <View style={styles.claimIcon}>
          <Ionicons name="shield-outline" size={17} color={partnerTheme.colors.accent} />
        </View>
      }
      onPress={onPress}
      accessibilityLabel={`Open claim ${row.claim_no || ''} for ${row.customer_name}`}
      divider={false}
    />
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

const styles = StyleSheet.create({
  banner: { marginTop: 9 },
  inlineBanner: { marginBottom: 8 },
  search: { marginTop: 10 },
  tabs: { marginTop: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: partnerTheme.colors.line },
  claimIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.accentSoft,
  },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
