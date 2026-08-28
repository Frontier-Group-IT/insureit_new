import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PartnerScreen } from '@/components/partner-screen';
import {
  getPartnerPolicySummary,
  listPartnerPolicies,
  type PartnerPolicyLifecycle,
  type PartnerPolicyRow,
  type PartnerPolicySummary,
} from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

const filters: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_force', label: 'In force' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
];

export default function PoliciesScreen() {
  const [summary, setSummary] = useState<PartnerPolicySummary | null>(null);
  const [rows, setRows] = useState<PartnerPolicyRow[]>([]);
  const [lifecycle, setLifecycle] = useState<PartnerPolicyLifecycle>('all');
  const [query, setQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const nextRows = await listPartnerPolicies({ lifecycle, search: appliedSearch, limit: 25 });
      setRows(nextRows);
    } catch {
      setRows([]);
      setError('Policy data could not be loaded for this account.');
    } finally {
      setListLoading(false);
    }
  }, [appliedSearch, lifecycle]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextSummary, nextRows] = await Promise.all([
          getPartnerPolicySummary(),
          listPartnerPolicies({ lifecycle: 'all', limit: 25 }),
        ]);
        if (cancelled) return;
        setSummary(nextSummary);
        setRows(nextRows);
      } catch {
        if (!cancelled) setError('Policy data could not be loaded for this account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) void loadList();
  }, [lifecycle, appliedSearch, loadList, loading]);

  function applySearch() {
    setAppliedSearch(query.trim());
  }

  return (
    <PartnerScreen eyebrow="BUSINESS" title="Policies">
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Total policies" value={summary?.total_policies ?? 0} />
            <SummaryCard label="In force" value={summary?.in_force_policies ?? 0} />
            <SummaryCard label="Expiring in 30 days" value={summary?.expiring_30_days ?? 0} />
            <SummaryCard label="Premium booked" value={formatMoney(summary?.total_premium ?? 0)} compact />
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color="#8A94A6" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={applySearch}
              placeholder="Search policy, customer, vehicle or insurer"
              placeholderTextColor="#9AA3B2"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query || appliedSearch ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setAppliedSearch('');
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color="#9AA3B2" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filters}>
            {filters.map((filter) => {
              const active = lifecycle === filter.value;
              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setLifecycle(filter.value)}
                  style={[styles.filter, active && styles.filterActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Policy book</Text>
            <Text style={styles.listCount}>{rows[0]?.total_count ?? 0} records</Text>
          </View>

          {listLoading ? (
            <View style={styles.listLoading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
          ) : rows.length ? (
            <View style={styles.list}>
              {rows.map((row) => <PolicyRow key={row.policy_id} row={row} />)}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={28} color="#9AA3B2" />
              <Text style={styles.emptyTitle}>No policies found</Text>
              <Text style={styles.emptyText}>Try another search or lifecycle filter.</Text>
            </View>
          )}
        </>
      )}
    </PartnerScreen>
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

function PolicyRow({ row }: { row: PartnerPolicyRow }) {
  return (
    <View style={styles.policyRow}>
      <View style={styles.policyTop}>
        <View style={styles.policyIdentity}>
          <Text style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
          <Text style={styles.policyCustomer}>{row.customer_name}</Text>
        </View>
        <LifecycleBadge value={row.lifecycle_status} />
      </View>

      <View style={styles.policyMetaGrid}>
        <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
        <Meta label="Vehicle" value={row.vehicle_no || 'Non-motor / not linked'} />
        <Meta label="Policy type" value={row.policy_product || row.policy_type || row.business_line || 'Not recorded'} />
        <Meta label="Premium" value={formatMoney(row.premium_amount)} />
      </View>

      <View style={styles.policyFooter}>
        <Text style={styles.policyDates}>{formatDate(row.start_date)} → {formatDate(row.end_date)}</Text>
        <Text style={styles.policyIntermediary}>{row.intermediary_code || 'Direct'}</Text>
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

function LifecycleBadge({ value }: { value: PartnerPolicyRow['lifecycle_status'] }) {
  const tone = value === 'expired'
    ? styles.badgeExpired
    : value === 'expiring'
      ? styles.badgeExpiring
      : value === 'upcoming'
        ? styles.badgeUpcoming
        : styles.badgeActive;
  return <Text style={[styles.badge, tone]}>{humanize(value)}</Text>;
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

const styles = StyleSheet.create({
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: '48%',
    minHeight: 92,
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.lg,
    padding: 15,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, fontWeight: '700' },
  summaryValueCompact: { fontSize: 18 },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 14 },
  searchWrap: {
    height: 48,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: partnerTheme.radius.md,
    paddingHorizontal: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  searchInput: { flex: 1, color: partnerTheme.colors.ink, fontSize: 11 },
  filters: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: partnerTheme.colors.surfaceMuted },
  filterActive: { backgroundColor: partnerTheme.colors.brandStrong },
  filterText: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '700' },
  filterTextActive: { color: partnerTheme.colors.white },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 10, lineHeight: 15 },
  listHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  listCount: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '600' },
  listLoading: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  policyRow: {
    borderRadius: partnerTheme.radius.lg,
    padding: 16,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  policyTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  policyIdentity: { flex: 1 },
  policyNo: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  policyCustomer: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '800' },
  badgeActive: { color: '#18794E', backgroundColor: '#E9F7EF' },
  badgeExpiring: { color: '#9A5B12', backgroundColor: '#FFF2DD' },
  badgeExpired: { color: '#A7372D', backgroundColor: '#FCEDEC' },
  badgeUpcoming: { color: '#315E9C', backgroundColor: '#EAF1FB' },
  policyMetaGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 11 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', fontSize: 7.5, fontWeight: '800', letterSpacing: 0.65, textTransform: 'uppercase' },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '600' },
  policyFooter: { marginTop: 14, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  policyDates: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  policyIntermediary: { color: partnerTheme.colors.brand, fontSize: 8.5, fontWeight: '700' },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '700' },
  emptyText: { marginTop: 4, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
});
