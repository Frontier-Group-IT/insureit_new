import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerFilterChip } from '@/components/ui/partner-filter-chip';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import {
  getPartnerClaimSummary,
  listPartnerClaims,
  type PartnerClaimRow,
  type PartnerClaimState,
  type PartnerClaimSummary,
} from '@/lib/claims';
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
        <View style={styles.summaryGrid}>
          <SummaryCard label="Total claims" value={summary.data?.total_claims ?? 0} />
          <SummaryCard label="Active" value={summary.data?.active_claims ?? 0} />
          <SummaryCard label="Completed" value={summary.data?.completed_claims ?? 0} />
          <SummaryCard label="Assistance open" value={summary.data?.assistance_requested ?? 0} />
        </View>
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

      <View style={styles.filters}>
        {filters.map((filter) => (
          <PartnerFilterChip
            key={filter.value}
            label={filter.label}
            active={state === filter.value}
            onPress={() => setState(filter.value)}
          />
        ))}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ClaimRow({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open claim ${row.claim_no || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.claimRow, pressed && styles.pressed]}
    >
      <View style={styles.claimTop}>
        <View style={styles.claimIcon}>
          <Ionicons name="shield-outline" size={19} color={partnerTheme.colors.accent} />
        </View>
        <View style={styles.claimIdentity}>
          <Text style={styles.claimNo}>{row.claim_no || 'Claim'}</Text>
          <Text style={styles.customer}>{row.customer_name}</Text>
        </View>
        <PartnerStatusBadge
          label={humanize(row.current_status || row.claim_state)}
          tone={row.claim_state === 'completed' ? 'success' : 'warning'}
        />
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
        <Meta label="Vehicle" value={row.vehicle_no || 'Not linked'} />
        <Meta label="Policy" value={row.policy_no || 'External policy'} />
        <Meta label="Service mode" value={humanize(row.claim_service_mode || 'not recorded')} />
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{row.accident_at ? 'ACCIDENT' : 'CREATED'}</Text>
          <Text style={styles.date}>{formatDate(row.accident_at || row.created_at)}</Text>
        </View>
        <View style={styles.claimOpen}>
          <Text style={styles.amount}>{claimAmount(row)}</Text>
          <Ionicons name="chevron-forward" size={16} color={partnerTheme.colors.brand} />
        </View>
      </View>
    </Pressable>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function claimAmount(row: PartnerClaimRow) {
  const value = row.settlement_amount ?? row.approved_amount ?? row.estimated_loss;
  return value == null ? 'Amount not recorded' : formatMoney(value);
}

function formatMoney(value: number | string) {
  const amount = Number(value);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)}`;
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
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { width: '48%', minHeight: 76, justifyContent: 'center', borderRadius: partnerTheme.radius.lg, padding: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  banner: { marginTop: 10 },
  inlineBanner: { marginBottom: 10 },
  search: { marginTop: 12 },
  filters: { marginTop: 8, flexDirection: 'row', gap: 7 },
  separator: { height: 10 },
  claimRow: { borderRadius: partnerTheme.radius.lg, padding: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  claimTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  claimIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.accentSoft },
  claimIdentity: { flex: 1 },
  claimNo: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.82 },
  metaGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', rowGap: 9 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.6, ...partnerTheme.typography.meta },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  footer: { marginTop: 9, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  date: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  claimOpen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.caption },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
