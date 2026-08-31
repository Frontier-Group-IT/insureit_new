import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerContactActions } from '@/components/ui/partner-contact-actions';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import {
  getPartnerCustomerSummary,
  listPartnerCustomers,
  type PartnerCustomerRow,
  type PartnerCustomerSummary,
} from '@/lib/customers';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPagedQuery } from '@/lib/use-partner-paged-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

const PAGE_SIZE = 25;
let savedCustomerQuery = '';

export default function CustomersScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const [query, setQuery] = useState(savedCustomerQuery);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    savedCustomerQuery = query;
  }, [query]);

  const fetchSummary = useCallback(() => getPartnerCustomerSummary(), []);
  const summary = usePartnerQuery<PartnerCustomerSummary>({
    scopeKey: cacheScopeKey,
    key: 'customers:summary',
    fetcher: fetchSummary,
    staleTimeMs: 2 * 60_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerCustomers({ limit, offset, search: debouncedSearch });
    return {
      rows: nextRows,
      total: nextRows[0]?.total_count ?? 0,
    };
  }, [debouncedSearch]);

  const collection = usePartnerPagedQuery<PartnerCustomerRow>({
    scopeKey: cacheScopeKey,
    key: `customers:list:${debouncedSearch || 'all'}`,
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
        <PartnerStateView state="loading" title="Loading customer summary" />
      ) : (
        <View style={styles.summaryGrid}>
          <SummaryCard label="Customers" value={summary.data?.total_customers ?? 0} />
          <SummaryCard label="Active" value={summary.data?.active_customers ?? 0} />
          <SummaryCard label="With phone" value={summary.data?.with_phone ?? 0} />
          <SummaryCard label="With email" value={summary.data?.with_email ?? 0} />
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
          placeholder="Search name, code, phone, email or city"
        />
      </View>

      <PartnerSectionHeader
        title="Customer book"
        meta={collection.loading ? 'Searching…' : `${collection.total} records`}
      />

      {collection.error && collection.rows.length && !collection.stale ? (
        <View style={styles.inlineBanner}>
          <PartnerBanner
            tone="warning"
            message={collection.error}
          />
        </View>
      ) : null}
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding customers" />
  ) : collection.error ? (
    <PartnerStateView
      state="error"
      title="Customers could not be loaded"
      message={collection.error}
      actionLabel="Try again"
      onAction={() => void refreshAll()}
    />
  ) : (
    <PartnerStateView
      state="empty"
      icon="people-outline"
      title="No customers found"
      message={debouncedSearch ? 'Try a different name, code, phone, email or city.' : 'Customers in your authorized business scope will appear here.'}
    />
  );

  const footer = collection.rows.length ? (
    <View style={styles.listFooter}>
      {collection.loadingMore ? (
        <View style={styles.loadingMore}>
          <ActivityIndicator color={partnerTheme.colors.brand} />
          <Text style={styles.loadingMoreText}>Loading more customers…</Text>
        </View>
      ) : collection.rows.length >= collection.total ? (
        <Text style={styles.endText}>End of customer book</Text>
      ) : null}
    </View>
  ) : null;

  return (
    <PartnerListScreen
      eyebrow="BUSINESS"
      title="Customers"
      action={<PartnerIconButton icon="close" label="Close customers" onPress={() => router.back()} />}
      data={collection.rows}
      keyExtractor={(row) => row.customer_id}
      renderItem={({ item }) => (
        <CustomerRow
          row={item}
          onPress={() => router.push(`/customer/${item.customer_id}` as never)}
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

function CustomerRow({ row, onPress }: { row: PartnerCustomerRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open customer ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.customerRow, pressed && styles.pressed]}
    >
      <View style={styles.customerTop}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.customer_name)}</Text></View>
        <View style={styles.customerIdentity}>
          <Text style={styles.customerName}>{row.customer_name}</Text>
          <Text style={styles.customerCode}>{row.customer_code || 'No customer code'}</Text>
        </View>
        {row.customer_status ? <PartnerStatusBadge label={humanize(row.customer_status)} tone={statusTone(row.customer_status)} /> : null}
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Phone" value={row.phone || 'Not recorded'} />
        <Meta label="Email" value={row.email || 'Not recorded'} />
        <Meta label="Location" value={[row.city, row.state].filter(Boolean).join(', ') || 'Not recorded'} />
        <Meta label="Intermediary" value={row.intermediary_code || 'Organization / unassigned'} />
      </View>

      <View style={styles.footer}>
        <PartnerContactActions phone={row.phone} email={row.email} compact />
        <View style={styles.openRow}>
          <Text style={styles.openText}>Open customer</Text>
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

function statusTone(value: string): 'success' | 'warning' | 'neutral' {
  const normalized = value.toLowerCase();
  if (normalized.includes('active')) return 'success';
  if (normalized.includes('pending') || normalized.includes('hold')) return 'warning';
  return 'neutral';
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CU';
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
  summaryValue: { color: partnerTheme.colors.ink, ...partnerTheme.typography.display },
  summaryLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  banner: { marginTop: 10 },
  inlineBanner: { marginBottom: 10 },
  search: { marginTop: partnerTheme.spacing.md },
  separator: { height: 10 },
  customerRow: {
    borderRadius: partnerTheme.radius.lg,
    padding: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  pressed: { opacity: 0.82 },
  customerTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  customerIdentity: { flex: 1 },
  customerName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.cardTitle },
  customerCode: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  metaGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', rowGap: 9 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: {
    color: '#8A94A6',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    ...partnerTheme.typography.meta,
  },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  footer: {
    minHeight: partnerTheme.control.minTouchTarget,
    marginTop: 7,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
  },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
