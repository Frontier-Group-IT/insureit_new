import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerContactActions } from '@/components/ui/partner-contact-actions';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
import { PartnerOperationalRow } from '@/components/ui/partner-operational-row';
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
import { PartnerAssets } from '@/lib/partner-assets';
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
        <PartnerListSummaryStrip
          items={[
            { key: 'customers', label: 'Customers', value: summary.data?.total_customers ?? 0 },
            { key: 'active', label: 'Active', value: summary.data?.active_customers ?? 0, tone: 'success' },
            { key: 'phone', label: 'Phone', value: summary.data?.with_phone ?? 0 },
            { key: 'email', label: 'Email', value: summary.data?.with_email ?? 0 },
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
      asset={PartnerAssets.emptyStates.noCustomers}
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
      onBack={() => router.back()}
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

function CustomerRow({ row, onPress }: { row: PartnerCustomerRow; onPress: () => void }) {
  const location = [row.city, row.state].filter(Boolean).join(', ');
  const secondary = [row.customer_code, location || row.phone].filter(Boolean).join(' · ');
  return (
    <PartnerOperationalRow
      title={row.customer_name}
      subtitle={secondary || 'Customer record'}
      detail={`${row.intermediary_code || 'Direct / unassigned'}${row.phone ? ` · ${row.phone}` : ''}`}
      status={row.customer_status ? <PartnerStatusBadge label={humanize(row.customer_status)} tone={statusTone(row.customer_status)} /> : undefined}
      leading={
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(row.customer_name)}</Text>
        </View>
      }
      trailing={<PartnerContactActions phone={row.phone} email={row.email} compact />}
      onPress={onPress}
      accessibilityLabel={`Open customer ${row.customer_name}`}
      divider={false}
      dense
    />
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
  banner: { marginTop: 9 },
  inlineBanner: { marginBottom: 8 },
  search: { marginTop: 8 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: partnerTheme.colors.line },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});