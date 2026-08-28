import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
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
  }, [appliedSearch]);

  return (
    <PartnerScreen
      eyebrow="BUSINESS"
      title="Customers"
      action={
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Customers" value={summary?.total_customers ?? 0} />
            <SummaryCard label="Active" value={summary?.active_customers ?? 0} />
            <SummaryCard label="With phone" value={summary?.with_phone ?? 0} />
            <SummaryCard label="With email" value={summary?.with_email ?? 0} />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color="#8A94A6" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setAppliedSearch(query.trim())}
              placeholder="Search name, code, phone, email or city"
              placeholderTextColor="#9AA3B2"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query || appliedSearch ? (
              <Pressable onPress={() => { setQuery(''); setAppliedSearch(''); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9AA3B2" />
              </Pressable>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Customer book</Text>
            <Text style={styles.listCount}>{rows[0]?.total_count ?? 0} records</Text>
          </View>

          {rows.length ? (
            <View style={styles.list}>{rows.map((row) => <CustomerRow key={row.customer_id} row={row} />)}</View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={30} color="#9AA3B2" />
              <Text style={styles.emptyTitle}>No customers found</Text>
            </View>
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

function CustomerRow({ row }: { row: PartnerCustomerRow }) {
  return (
    <View style={styles.customerRow}>
      <View style={styles.customerTop}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(row.customer_name)}</Text></View>
        <View style={styles.customerIdentity}>
          <Text style={styles.customerName}>{row.customer_name}</Text>
          <Text style={styles.customerCode}>{row.customer_code || 'No customer code'}</Text>
        </View>
        {row.customer_status ? <Text style={styles.status}>{humanize(row.customer_status)}</Text> : null}
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Phone" value={row.phone || 'Not recorded'} />
        <Meta label="Email" value={row.email || 'Not recorded'} />
        <Meta label="Location" value={[row.city, row.state].filter(Boolean).join(', ') || 'Not recorded'} />
        <Meta label="Intermediary" value={row.intermediary_code || 'Organization / unassigned'} />
      </View>
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

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join('') || 'CU';
}

function humanize(value: string) {
  return value.replaceAll('_',' ').replace(/\b\w/g,(letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  back: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { width: '48%', minHeight: 88, justifyContent: 'center', borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, fontWeight: '700' },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  searchWrap: { height: 48, marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: partnerTheme.radius.md, paddingHorizontal: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  searchInput: { flex: 1, color: partnerTheme.colors.ink, fontSize: 11 },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 10 },
  listHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  listTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  listCount: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '600' },
  list: { gap: 10 },
  customerRow: { borderRadius: partnerTheme.radius.lg, padding: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  customerTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  avatarText: { color: partnerTheme.colors.brandStrong, fontSize: 11, fontWeight: '800' },
  customerIdentity: { flex: 1 },
  customerName: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  customerCode: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, color: partnerTheme.colors.success, backgroundColor: '#E9F7EF', fontSize: 8, fontWeight: '800' },
  metaGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 11 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '600' },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '700' },
});
