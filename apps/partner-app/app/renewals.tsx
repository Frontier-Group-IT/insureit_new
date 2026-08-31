import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerFilterChip } from '@/components/ui/partner-filter-chip';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
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
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroMain}>
              <Text style={styles.heroEyebrow}>NEXT 30 DAYS</Text>
              <Text style={styles.heroPremium}>{formatIndianCurrency(summary.data?.due_30_premium ?? 0)}</Text>
              <Text style={styles.heroLabel}>gross premium in renewal window</Text>
            </View>
            <View style={styles.heroCount}>
              <Text style={styles.heroCountValue}>{summary.data?.due_30_count ?? 0}</Text>
              <Text style={styles.heroCountLabel}>policies</Text>
            </View>
          </View>

          <View style={styles.heroBins}>
            <HeroBin label="0–7d" count={summary.data?.due_0_7_count ?? 0} />
            <HeroBin label="8–15d" count={summary.data?.due_8_15_count ?? 0} />
            <HeroBin label="16–30d" count={summary.data?.due_16_30_count ?? 0} />
            <HeroBin label="Overdue" count={summary.data?.overdue_count ?? 0} danger />
          </View>
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
        <PartnerFilterChip label="Upcoming" active={mode === 'expiring'} onPress={() => { setMode('expiring'); setWindow('all'); }} />
        <PartnerFilterChip label="Overdue" active={mode === 'expired'} onPress={() => { setMode('expired'); setWindow('all'); }} />
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
      action={<PartnerIconButton icon="close" label="Close renewals" onPress={() => router.back()} />}
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
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open renewal policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
        onPress={onOpenPolicy}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardIdentity}>
            <Text style={styles.customer}>{row.customer_name}</Text>
            <Text style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
          </View>
          <PartnerStatusBadge label={renewalLabel(row.end_date)} tone={mode === 'expired' ? 'danger' : renewalTone(row.end_date)} />
        </View>

        <View style={styles.vehicleLine}>
          <Ionicons name={row.vehicle_no ? 'car-outline' : 'document-text-outline'} size={16} color={partnerTheme.colors.brand} />
          <Text style={styles.vehicleText}>{row.vehicle_no || row.policy_product || 'Non-motor / vehicle not linked'}</Text>
        </View>

        <View style={styles.metaRow}>
          <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
          <Meta label="Current premium" value={formatIndianCurrency(row.premium_amount)} />
        </View>
      </Pressable>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>EXPIRY</Text>
          <Text style={styles.date}>{formatDate(row.end_date)}</Text>
        </View>
        <View style={styles.actions}>
          {onOpenCustomer ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Open customer ${row.customer_name}`} onPress={onOpenCustomer} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
              <Ionicons name="person-outline" size={16} color={partnerTheme.colors.brand} />
              <Text style={styles.smallActionText}>Customer</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Open policy" onPress={onOpenPolicy} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}>
            <Text style={styles.smallActionText}>Policy</Text>
            <Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.brand} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function HeroBin({ label, count, danger = false }: { label: string; count: number; danger?: boolean }) {
  return (
    <View style={styles.heroBin}>
      <Text style={[styles.heroBinValue, danger && styles.heroBinDanger]}>{count}</Text>
      <Text style={styles.heroBinLabel}>{label}</Text>
    </View>
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
  hero: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroMain: { flex: 1 },
  heroEyebrow: { color: '#AAA5FF', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  heroPremium: { marginTop: 4, color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '900' },
  heroLabel: { marginTop: 2, color: '#AEB7C5', ...partnerTheme.typography.meta },
  heroCount: { minWidth: 58, alignItems: 'center', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#263246' },
  heroCountValue: { color: '#FFFFFF', fontSize: 18, lineHeight: 23, fontWeight: '900' },
  heroCountLabel: { marginTop: 2, color: '#99A5B7', ...partnerTheme.typography.meta },
  heroBins: { marginTop: 11, paddingTop: 10, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3B4658' },
  heroBin: { flex: 1, alignItems: 'center' },
  heroBinValue: { color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  heroBinDanger: { color: '#F2B6AF' },
  heroBinLabel: { marginTop: 3, color: '#97A3B5', ...partnerTheme.typography.meta },
  banner: { marginTop: 10 },
  inlineBanner: { marginBottom: 10 },
  modeTabs: { marginTop: 9, flexDirection: 'row', gap: 8 },
  windowRow: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  search: { marginTop: 9 },
  separator: { height: 9 },
  card: { borderRadius: 17, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardIdentity: { flex: 1 },
  customer: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  policyNo: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  vehicleLine: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  vehicleText: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  metaRow: { marginTop: 8, flexDirection: 'row' },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  footer: { marginTop: 9, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  date: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  actions: { flexDirection: 'row', gap: 6 },
  smallAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 10, backgroundColor: partnerTheme.colors.brandSoft },
  smallActionText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.meta },
  pressed: { opacity: 0.78 },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
