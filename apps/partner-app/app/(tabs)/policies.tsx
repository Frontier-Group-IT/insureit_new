import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerFilterChip } from '@/components/ui/partner-filter-chip';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import {
  getPartnerPolicySummary,
  listPartnerPolicies,
  type PartnerPolicyLifecycle,
  type PartnerPolicyRow,
  type PartnerPolicySummary,
} from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_force', label: 'In force' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'upcoming', label: 'Upcoming' },
];

let savedPolicyQuery = '';
let savedPolicyLifecycle: PartnerPolicyLifecycle = 'all';

export default function PoliciesScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
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

  const header = (
    <View>
      {summary.loading && !summary.data ? (
        <PartnerStateView state="loading" title="Loading policy summary" />
      ) : (
        <View style={styles.summaryGrid}>
          <SummaryCard label="Total policies" value={summary.data?.total_policies ?? 0} />
          <SummaryCard label="In force" value={summary.data?.in_force_policies ?? 0} />
          <SummaryCard label="Expiring in 30 days" value={summary.data?.expiring_30_days ?? 0} />
          <SummaryCard label="Premium booked" value={formatMoney(summary.data?.total_premium ?? 0)} compact />
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
          placeholder="Search policy, customer, vehicle or insurer"
        />
      </View>

      <View style={styles.filters}>
        {filters.map((filter) => (
          <PartnerFilterChip
            key={filter.value}
            label={filter.label}
            active={lifecycle === filter.value}
            onPress={() => setLifecycle(filter.value)}
          />
        ))}
      </View>

      <PartnerSectionHeader
        title="Policy book"
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
      icon="document-text-outline"
      title="No policies found"
      message="Try another search term or policy lifecycle filter."
    />
  );

  const footer = collection.rows.length ? (
    <View style={styles.listFooter}>
      {collection.loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator color={partnerTheme.colors.brand} />
          <Text style={styles.loadingMoreText}>Loading more policies…</Text>
        </View>
      ) : collection.rows.length >= collection.total ? (
        <Text style={styles.endText}>End of policy book</Text>
      ) : null}
    </View>
  ) : null;

  return (
    <PartnerListScreen
      eyebrow="BUSINESS"
      title="Policies"
      action={
        <PartnerButton
          label="Intake"
          icon="cloud-upload-outline"
          fullWidth={false}
          onPress={() => router.push('/policy-intakes')}
        />
      }
      data={collection.rows}
      keyExtractor={(row) => row.policy_id}
      renderItem={({ item }) => (
        <PolicyRow
          row={item}
          onPress={() => router.push(`/policy/${item.policy_id}` as never)}
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

function SummaryCard({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <View style={styles.summaryCard}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue, compact && styles.summaryValueCompact]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function PolicyRow({ row, onPress }: { row: PartnerPolicyRow; onPress: () => void }) {
  const category = policyCategory(row);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${category} policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.policyRow, pressed && styles.pressed]}
    >
      <View style={styles.policyTop}>
        <View style={styles.policyIcon}>
          <Ionicons name={category === 'Motor' ? 'car-outline' : category === 'Health' ? 'medkit-outline' : category === 'Life' ? 'heart-outline' : 'business-outline'} size={19} color={partnerTheme.colors.brand} />
        </View>
        <View style={styles.policyIdentity}>
          <Text style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
          <Text style={styles.policyCustomer}>{row.customer_name}</Text>
        </View>
        <View style={styles.badges}>
          <PartnerStatusBadge label={category} tone="brand" />
          <PartnerStatusBadge label={humanize(row.lifecycle_status)} tone={lifecycleTone(row.lifecycle_status)} />
        </View>
      </View>

      <View style={styles.policyMetaGrid}>
        <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
        <Meta label="Risk / vehicle" value={row.vehicle_no || row.policy_product || 'Non-motor / not linked'} />
        <Meta label="Product" value={row.policy_product || row.policy_type || row.business_line || 'Not recorded'} />
        <Meta label="Premium" value={formatMoney(row.premium_amount)} />
      </View>

      <View style={styles.policyFooter}>
        <View>
          <Text style={styles.footerLabel}>TERM</Text>
          <Text style={styles.policyDates}>{formatDate(row.start_date)} → {formatDate(row.end_date)}</Text>
        </View>
        <View style={styles.policyOpen}>
          <Text style={styles.policyIntermediary}>{row.intermediary_code || 'Direct'}</Text>
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

function policyCategory(row: PartnerPolicyRow) {
  const value = [row.policy_type, row.policy_product, row.business_line].filter(Boolean).join(' ').toLowerCase();
  if (value.includes('health')) return 'Health';
  if (value.includes('life')) return 'Life';
  if (value.includes('motor') || row.vehicle_id || row.vehicle_no) return 'Motor';
  return 'Non-Motor';
}

function lifecycleTone(value: PartnerPolicyRow['lifecycle_status']): 'success' | 'warning' | 'danger' | 'info' {
  if (value === 'expired') return 'danger';
  if (value === 'expiring') return 'warning';
  if (value === 'upcoming') return 'info';
  return 'success';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function formatMoney(value: number | string | null) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

function formatUpdatedAt(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: '48%',
    minHeight: 76,
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.lg,
    padding: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  summaryValueCompact: { fontSize: 18 },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  banner: { marginTop: 10 },
  inlineBanner: { marginBottom: 10 },
  search: { marginTop: 12 },
  filters: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  separator: { height: 10 },
  policyRow: {
    borderRadius: partnerTheme.radius.lg,
    padding: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  pressed: { opacity: 0.82 },
  policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  policyIdentity: { flex: 1 },
  policyNo: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  policyCustomer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  badges: { alignItems: 'flex-end', gap: 5 },
  policyMetaGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', rowGap: 9 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', letterSpacing: 0.65, textTransform: 'uppercase', ...partnerTheme.typography.meta },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  policyFooter: { marginTop: 9, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  policyDates: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  policyOpen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyIntermediary: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
