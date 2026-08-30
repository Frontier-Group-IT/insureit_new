import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
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

export default function CustomersScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<PartnerCustomerSummary | null>(null);
  const [rows, setRows] = useState<PartnerCustomerRow[]>([]);
  const [query, setQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextSummary, nextRows] = await Promise.all([
          getPartnerCustomerSummary(),
          listPartnerCustomers({ limit: 50, search: appliedSearch }),
        ]);
        if (cancelled) return;
        setSummary(nextSummary);
        setRows(nextRows);
      } catch {
        if (!cancelled) setError('Customer data could not be loaded for this account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [appliedSearch, reloadKey]);

  return (
    <PartnerScreen
      eyebrow="BUSINESS"
      title="Customers"
      action={<PartnerIconButton icon="close" label="Close customers" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading customers" />
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
              onSubmit={() => setAppliedSearch(query.trim())}
              onClear={() => { setQuery(''); setAppliedSearch(''); }}
              placeholder="Search name, code, phone, email or city"
            />
          </View>

          {error ? (
            <PartnerStateView
              state="error"
              title="Customers could not be loaded"
              message={error}
              actionLabel="Try again"
              onAction={() => setReloadKey((value) => value + 1)}
            />
          ) : (
            <>
              <PartnerSectionHeader
                title="Customer book"
                meta={`${rows[0]?.total_count ?? 0} records`}
              />

              {rows.length ? (
                <View style={styles.list}>
                  {rows.map((row) => (
                    <CustomerRow
                      key={row.customer_id}
                      row={row}
                      onPress={() => router.push(`/customer/${row.customer_id}` as never)}
                    />
                  ))}
                </View>
              ) : (
                <PartnerStateView
                  state="empty"
                  icon="people-outline"
                  title="No customers found"
                  message={appliedSearch ? 'Try a different search term.' : 'Customers in your authorized business scope will appear here.'}
                />
              )}
            </>
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
        {row.customer_status ? <PartnerStatusBadge label={humanize(row.customer_status)} tone="success" /> : null}
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Phone" value={row.phone || 'Not recorded'} />
        <Meta label="Email" value={row.email || 'Not recorded'} />
        <Meta label="Location" value={[row.city, row.state].filter(Boolean).join(', ') || 'Not recorded'} />
        <Meta label="Intermediary" value={row.intermediary_code || 'Organization / unassigned'} />
      </View>
      <View style={styles.openRow}>
        <Text style={styles.openText}>Open customer story</Text>
        <Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.brand} />
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
  openRow: {
    minHeight: partnerTheme.control.minTouchTarget,
    marginTop: 10,
    paddingTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
  },
  openText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
});
