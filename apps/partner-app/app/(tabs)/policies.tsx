import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { PartnerTopTabs } from '@/components/ui/partner-top-tabs';
import {
  getPartnerPolicySummary,
  listPartnerPolicies,
  type PartnerPolicyLifecycle,
  type PartnerPolicyRow,
  type PartnerPolicySummary,
} from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
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
        <PartnerListSummaryStrip
          items={[
            { key: 'total', label: 'Policies', value: summary.data?.total_policies ?? 0 },
            { key: 'force', label: 'In force', value: summary.data?.in_force_policies ?? 0, tone: 'success' },
            { key: 'expiring', label: 'Expiring', value: summary.data?.expiring_30_days ?? 0, tone: 'warning' },
            { key: 'premium', label: 'Premium', value: formatIndianCurrency(summary.data?.total_premium ?? 0) },
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
          placeholder="Search policy, customer, vehicle or insurer"
        />
      </View>

      <View style={styles.tabs}>
        <PartnerTopTabs
          activeKey={lifecycle}
          onChange={(key) => setLifecycle(key as PartnerPolicyLifecycle)}
          tabs={filters.map((filter) => ({ key: filter.value, label: filter.label }))}
        />
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

function PolicyRow({ row, onPress }: { row: PartnerPolicyRow; onPress: () => void }) {
  const category = policyCategory(row);
  const risk = row.vehicle_no || row.policy_product || 'Risk not linked';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${category} policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.policyRow, pressed && styles.pressed]}
    >
      <View style={styles.policyIcon}>
        <Ionicons
          name={category === 'Motor' ? 'car-outline' : category === 'Health' ? 'medkit-outline' : category === 'Life' ? 'heart-outline' : 'business-outline'}
          size={18}
          color={partnerTheme.colors.brand}
        />
      </View>

      <View style={styles.policyIdentity}>
        <View style={styles.policyTitleLine}>
          <Text numberOfLines={1} style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
          <PartnerStatusBadge label={humanize(row.lifecycle_status)} tone={lifecycleTone(row.lifecycle_status)} />
        </View>
        <Text numberOfLines={1} style={styles.policyCustomer}>{row.customer_name} · {row.insurer_name || 'Insurer not recorded'}</Text>
        <Text numberOfLines={1} style={styles.policyRisk}>{risk} · {category}</Text>
        <View style={styles.policyBottom}>
          <Text style={styles.policyPremium}>{formatIndianCurrency(row.premium_amount)}</Text>
          <Text style={styles.policyDates}>{formatDate(row.end_date)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={17} color="#9CA6B5" />
    </Pressable>
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
  policyRow: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    backgroundColor: partnerTheme.colors.surface,
  },
  pressed: { opacity: 0.78 },
  policyIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  policyIdentity: { flex: 1, minWidth: 0 },
  policyTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  policyNo: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  policyCustomer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  policyRisk: { marginTop: 3, color: '#8A94A6', ...partnerTheme.typography.meta },
  policyBottom: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  policyPremium: { color: partnerTheme.colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  policyDates: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
