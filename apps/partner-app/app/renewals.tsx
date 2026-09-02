import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerFilterChip } from '@/components/ui/partner-filter-chip';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { PartnerOperationalRow } from '@/components/ui/partner-operational-row';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { PartnerTopTabs } from '@/components/ui/partner-top-tabs';
import {
  getPartnerRenewalSummary,
  listPartnerPolicies,
  type PartnerPolicyRow,
  type PartnerRenewalSummary,
} from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type RenewalMode = 'expiring' | 'expired';
type RenewalWindow = 'all' | '0_7' | '8_15' | '16_30';

const PAGE_SIZE = 25;
let savedRenewalMode: RenewalMode = 'expiring';
let savedRenewalWindow: RenewalWindow = 'all';
let savedRenewalQuery = '';

export default function RenewalsScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const [mode, setMode] = useState<RenewalMode>(savedRenewalMode);
  const [window, setWindow] = useState<RenewalWindow>(savedRenewalWindow);
  const [query, setQuery] = useState(savedRenewalQuery);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    savedRenewalMode = mode;
    savedRenewalWindow = window;
    savedRenewalQuery = query;
  }, [mode, query, window]);

  const fetchSummary = useCallback(() => getPartnerRenewalSummary(), []);
  const summary = usePartnerQuery<PartnerRenewalSummary>({
    scopeKey: cacheScopeKey,
    key: 'renewals:summary',
    fetcher: fetchSummary,
    staleTimeMs: 90_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerPolicies({
      lifecycle: mode,
      search: debouncedSearch,
      limit,
      offset,
    });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch, mode]);

  const collection = usePartnerPagedQuery<PartnerPolicyRow>({
    scopeKey: cacheScopeKey,
    key: `renewals:list:${mode}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const visibleRows = useMemo(() => {
    if (mode === 'expired' || window === 'all') return collection.rows;
    return collection.rows.filter((row) => {
      const days = daysUntil(row.end_date);
      if (window === '0_7') return days >= 0 && days <= 7;
      if (window === '8_15') return days >= 8 && days <= 15;
      return days >= 16 && days <= 30;
    });
  }, [collection.rows, mode, window]);

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const header = (
    <View>
      {summary.loading && !summary.data ? (
        <PartnerStateView state="loading" title="Loading renewal summary" />
      ) : (
        <View style={styles.summaryPanel}>
          <View style={styles.summaryLead}>
            <View>
              <Text style={styles.summaryEyebrow}>NEXT 30 DAYS</Text>
              <Text style={styles.summaryPremium}>{formatIndianCurrency(summary.data?.due_30_premium ?? 0)}</Text>
              <Text style={styles.summaryLabel}>gross premium</Text>
            </View>
            <View style={styles.summaryCount}>
              <Text style={styles.summaryCountValue}>{summary.data?.due_30_count ?? 0}</Text>
              <Text style={styles.summaryCountLabel}>policies</Text>
            </View>
          </View>
          <PartnerListSummaryStrip
            items={[
              { key: '0_7', label: '0–7d', value: summary.data?.due_0_7_count ?? 0, tone: 'warning' },
              { key: '8_15', label: '8–15d', value: summary.data?.due_8_15_count ?? 0 },
              { key: '16_30', label: '16–30d', value: summary.data?.due_16_30_count ?? 0 },
              { key: 'overdue', label: 'Overdue', value: summary.data?.overdue_count ?? 0, tone: 'danger' },
            ]}
          />
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

      <View style={styles.modeTabs}>
        <PartnerTopTabs
          activeKey={mode}
          onChange={(key) => {
            setMode(key as RenewalMode);
            setWindow('all');
          }}
          tabs={[
            { key: 'expiring', label: 'Upcoming', badge: summary.data?.due_30_count ?? 0 },
            { key: 'expired', label: 'Overdue', badge: summary.data?.overdue_count ?? 0 },
          ]}
        />
      </View>

      {mode === 'expiring' ? (
        <View style={styles.windowRow}>
          <PartnerFilterChip label="All 30d" active={window === 'all'} onPress={() => setWindow('all')} />
          <PartnerFilterChip label="0–7d" active={window === '0_7'} onPress={() => setWindow('0_7')} />
          <PartnerFilterChip label="8–15d" active={window === '8_15'} onPress={() => setWindow('8_15')} />
          <PartnerFilterChip label="16–30d" active={window === '16_30'} onPress={() => setWindow('16_30')} />
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

      <PartnerSectionHeader
        title={mode === 'expired' ? 'Overdue policies' : 'Renewal opportunities'}
        meta={collection.loading ? 'Loading…' : `${visibleRows.length} shown · ${collection.total} total`}
      />

      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.inlineBanner}>
          <PartnerBanner tone="warning" message={collection.error} />
        </View>
      ) : null}
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding renewal opportunities" />
  ) : collection.error ? (
    <PartnerStateView
      state="error"
      title="Renewals could not be loaded"
      message={collection.error}
      actionLabel="Try again"
      onAction={() => void refreshAll()}
    />
  ) : (
    <PartnerStateView
      state="empty"
      icon="checkmark-circle-outline"
      title={mode === 'expiring' ? 'No policies in this renewal window' : 'No overdue policies found'}
      message="The queue is derived from your authorized policy book and policy expiry dates."
    />
  );

  const footer = collection.rows.length ? (
    <View style={styles.listFooter}>
      {collection.loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator color={partnerTheme.colors.brand} />
          <Text style={styles.loadingMoreText}>Loading more renewal records…</Text>
        </View>
      ) : collection.rows.length >= collection.total ? (
        <Text style={styles.endText}>End of renewal queue</Text>
      ) : null}
    </View>
  ) : null;

  return (
    <PartnerListScreen
      eyebrow="RENEWALS"
      title="Renewal work queue"
      onBack={() => router.back()}
      data={visibleRows}
      keyExtractor={(row) => row.policy_id}
      renderItem={({ item }) => (
        <RenewalCard
          row={item}
          mode={mode}
          onOpenPolicy={() => router.push(`/policy/${item.policy_id}` as never)}
          onOpenCustomer={() => item.customer_id ? router.push(`/customer/${item.customer_id}` as never) : undefined}
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

function RenewalCard({
  row,
  mode,
  onOpenPolicy,
  onOpenCustomer,
}: {
  row: PartnerPolicyRow;
  mode: RenewalMode;
  onOpenPolicy: () => void;
  onOpenCustomer?: () => void;
}) {
  return (
    <PartnerOperationalRow
      title={row.customer_name}
      subtitle={`${row.policy_no || row.policy_code || 'Policy'} · ${row.insurer_name || 'Insurer not recorded'}`}
      detail={row.vehicle_no || row.policy_product || 'Non-motor / risk not linked'}
      value={formatIndianCurrency(row.premium_amount)}
      meta={`Ends ${formatDate(row.end_date)}`}
      status={<PartnerStatusBadge label={renewalLabel(row.end_date)} tone={mode === 'expired' ? 'danger' : renewalTone(row.end_date)} />}
      leading={
        <View style={styles.renewalMarker}>
          <Ionicons name={row.vehicle_no ? 'car-outline' : 'document-text-outline'} size={17} color={partnerTheme.colors.brandStrong} />
        </View>
      }
      trailing={onOpenCustomer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open customer ${row.customer_name}`}
          onPress={(event) => {
            event.stopPropagation();
            onOpenCustomer();
          }}
          style={({ pressed }) => [styles.customerAction, pressed && styles.actionPressed]}
        >
          <Ionicons name="person-outline" size={16} color={partnerTheme.colors.brand} />
        </Pressable>
      ) : undefined}
      onPress={onOpenPolicy}
      accessibilityLabel={`Open renewal policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      divider={false}
    />
  );
}

function daysUntil(value: string | null) {
  if (!value) return 9999;
  const end = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function renewalLabel(value: string | null) {
  const days = daysUntil(value);
  if (days === 9999) return 'No expiry';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}

function renewalTone(value: string | null): 'warning' | 'info' {
  const days = daysUntil(value);
  return days <= 7 ? 'warning' : 'info';
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatUpdatedAt(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  summaryPanel: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: partnerTheme.colors.surface,
  },
  summaryLead: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryEyebrow: { color: partnerTheme.colors.inkMuted, letterSpacing: 1, ...partnerTheme.typography.meta },
  summaryPremium: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  summaryLabel: { marginTop: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  summaryCount: { alignItems: 'flex-end' },
  summaryCountValue: { color: partnerTheme.colors.ink, fontSize: 18, lineHeight: 22, fontWeight: '600' },
  summaryCountLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  banner: { marginTop: 9 },
  inlineBanner: { marginBottom: 8 },
  modeTabs: { marginTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  windowRow: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  search: { marginTop: 9 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: partnerTheme.colors.line },
  renewalMarker: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  customerAction: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.pill,
  },
  actionPressed: { backgroundColor: partnerTheme.colors.pressed },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
