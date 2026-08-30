import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerContactActions } from '@/components/ui/partner-contact-actions';
import { PartnerButton } from '@/components/ui/partner-button';
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

const PAGE_SIZE = 25;
let savedCustomerQuery = '';

export default function CustomersScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<PartnerCustomerSummary | null>(null);
  const [rows, setRows] = useState<PartnerCustomerRow[]>([]);
  const [query, setQuery] = useState(savedCustomerQuery);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    savedCustomerQuery = query;
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      try {
        const nextSummary = await getPartnerCustomerSummary();
        if (!cancelled) setSummary(nextSummary);
      } catch {
        if (!cancelled) setError('Customer summary could not be loaded for this account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSummary();
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadFirstPage() {
      setListLoading(true);
      setError('');
      try {
        const nextRows = await listPartnerCustomers({ limit: PAGE_SIZE, offset: 0, search: debouncedSearch });
        if (cancelled) return;
        setRows(nextRows);
        setTotal(nextRows[0]?.total_count ?? 0);
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setError('Customer data could not be loaded for this account.');
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }
    void loadFirstPage();
    return () => { cancelled = true; };
  }, [debouncedSearch, reloadKey]);

  async function loadMore() {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextRows = await listPartnerCustomers({
        limit: PAGE_SIZE,
        offset: rows.length,
        search: debouncedSearch,
      });
      setRows((current) => [...current, ...nextRows]);
      if (nextRows[0]?.total_count != null) setTotal(nextRows[0].total_count);
    } catch {
      setError('More customers could not be loaded. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="BUSINESS"
      title="Customers"
      action={<PartnerIconButton icon="close" label="Close customers" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading customer book" />
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Customers" value={summary?.total_customers ?? 0} />
            <SummaryCard label="Active" value={summary?.active_customers ?? 0} />
            <SummaryCard label="With phone" value={summary?.with_phone ?? 0} />
            <SummaryCard label="With email" value={summary?.with_email ?? 0} />
          </View>

          <View style={styles.search}>
            <PartnerSearchField
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search name, code, phone, email or city"
            />
            <Text style={styles.searchHint}>Search updates automatically as you type.</Text>
          </View>

          <PartnerSectionHeader
            title="Customer book"
            meta={listLoading ? 'Searching…' : `${total} records`}
          />

          {error && !rows.length ? (
            <PartnerStateView
              state="error"
              title="Customers could not be loaded"
              message={error}
              actionLabel="Try again"
              onAction={() => setReloadKey((value) => value + 1)}
            />
          ) : listLoading ? (
            <PartnerStateView state="loading" title="Finding customers" />
          ) : rows.length ? (
            <>
              <View style={styles.list}>
                {rows.map((row) => (
                  <CustomerRow
                    key={row.customer_id}
                    row={row}
                    onPress={() => router.push(`/customer/${row.customer_id}` as never)}
                  />
                ))}
              </View>

              {error ? <Text style={styles.inlineError}>{error}</Text> : null}

              {rows.length < total ? (
                <View style={styles.loadMore}>
                  <PartnerButton
                    label={loadingMore ? 'Loading…' : `Load more · ${total - rows.length} remaining`}
                    variant="secondary"
                    loading={loadingMore}
                    onPress={() => void loadMore()}
                  />
                </View>
              ) : (
                <Text style={styles.endText}>{rows.length ? 'End of customer book' : ''}</Text>
              )}
            </>
          ) : (
            <PartnerStateView
              state="empty"
              icon="people-outline"
              title="No customers found"
              message={debouncedSearch ? 'Try a different name, code, phone, email or city.' : 'Customers in your authorized business scope will appear here.'}
            />
          )}
        </>
      )}
    </PartnerScreen>
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

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: '48%',
    minHeight: 92,
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.lg,
    padding: partnerTheme.spacing.lg,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  summaryValue: { color: partnerTheme.colors.ink, ...partnerTheme.typography.display },
  summaryLabel: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  search: { marginTop: partnerTheme.spacing.lg },
  searchHint: { marginTop: 6, marginLeft: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  list: { gap: 10 },
  customerRow: {
    borderRadius: partnerTheme.radius.lg,
    padding: partnerTheme.spacing.lg,
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
  metaGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
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
    marginTop: 10,
    paddingTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
  },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  loadMore: { marginTop: partnerTheme.spacing.md },
  endText: { marginTop: 12, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  inlineError: { marginTop: 10, color: partnerTheme.colors.danger, textAlign: 'center', ...partnerTheme.typography.caption },
});
