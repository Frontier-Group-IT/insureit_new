import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerContactActions } from '@/components/ui/partner-contact-actions';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerListSummaryStrip } from '@/components/ui/partner-list-summary-strip';
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

function CustomerRow({ row, onPress }: { row: PartnerCustomerRow; onPress: () => void }) {
  const location = [row.city, row.state].filter(Boolean).join(', ');
  const secondary = [row.customer_code, location || row.phone].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open customer ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.customerRow, pressed && styles.pressed]}
    >
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.customer_name)}</Text></View>

      <View style={styles.customerIdentity}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={styles.customerName}>{row.customer_name}</Text>
          {row.customer_status ? (
            <PartnerStatusBadge label={humanize(row.customer_status)} tone={statusTone(row.customer_status)} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.customerCode}>{secondary || 'Customer record'}</Text>
        <Text numberOfLines={1} style={styles.customerMeta}>
          {row.intermediary_code || 'Direct / unassigned'}{row.phone ? ` · ${row.phone}` : ''}
        </Text>
      </View>

      <View style={styles.customerActions}>
        <PartnerContactActions phone={row.phone} email={row.email} compact />
        <Ionicons name="chevron-forward" size={17} color="#9CA6B5" />
      </View>
    </Pressable>
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
  search: { marginTop: 10 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: partnerTheme.colors.line },
  customerRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    backgroundColor: partnerTheme.colors.surface,
  },
  pressed: { opacity: 0.78 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  customerIdentity: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  customerName: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  customerCode: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  customerMeta: { marginTop: 3, color: '#8A94A6', ...partnerTheme.typography.meta },
  customerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' },
  loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});
