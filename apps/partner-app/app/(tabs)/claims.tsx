import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import {
  getPartnerClaimSummary,
  listPartnerClaims,
  type PartnerClaimRow,
  type PartnerClaimState,
  type PartnerClaimSummary,
} from '@/lib/claims';
import { partnerTheme } from '@/lib/theme';

const filters: Array<{ value: PartnerClaimState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export default function ClaimsScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<PartnerClaimSummary | null>(null);
  const [rows, setRows] = useState<PartnerClaimRow[]>([]);
  const [state, setState] = useState<PartnerClaimState>('all');
  const [query, setQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      setRows(await listPartnerClaims({ state, search: appliedSearch, limit: 25 }));
    } catch {
      setRows([]);
      setError('Claim data could not be loaded for this account.');
    } finally {
      setListLoading(false);
    }
  }, [appliedSearch, state]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextSummary, nextRows] = await Promise.all([
          getPartnerClaimSummary(),
          listPartnerClaims({ limit: 25 }),
        ]);
        if (cancelled) return;
        setSummary(nextSummary);
        setRows(nextRows);
      } catch {
        if (!cancelled) setError('Claim data could not be loaded for this account.');
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
  }, [loading, loadList]);

  return (
    <PartnerScreen eyebrow="SERVICE" title="Claims">
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Total claims" value={summary?.total_claims ?? 0} />
            <SummaryCard label="Active" value={summary?.active_claims ?? 0} />
            <SummaryCard label="Completed" value={summary?.completed_claims ?? 0} />
            <SummaryCard label="Assistance open" value={summary?.assistance_requested ?? 0} />
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={17} color={partnerTheme.colors.accent} />
            <Text style={styles.noticeText}>Claims appear only when the customer is commercially attributed inside your authorized Partner scope.</Text>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color="#8A94A6" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setAppliedSearch(query.trim())}
              placeholder="Search claim, customer, vehicle or policy"
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

          <View style={styles.filters}>
            {filters.map((filter) => {
              const active = state === filter.value;
              return (
                <Pressable key={filter.value} onPress={() => setState(filter.value)} style={[styles.filter, active && styles.filterActive]}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Claim book</Text>
            <Text style={styles.listCount}>{rows[0]?.total_count ?? 0} records</Text>
          </View>

          {listLoading ? (
            <View style={styles.listLoading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
          ) : rows.length ? (
            <View style={styles.list}>{rows.map((row) => <ClaimRow key={row.claim_id} row={row} onPress={() => router.push(`/claim/${row.claim_id}` as never)} />)}</View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={30} color={partnerTheme.colors.success} />
              <Text style={styles.emptyTitle}>No claims found</Text>
              <Text style={styles.emptyText}>There are no claims matching this authorized scope and filter.</Text>
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

function ClaimRow({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.claimRow}>
      <View style={styles.claimTop}>
        <View style={styles.claimIdentity}>
          <Text style={styles.claimNo}>{row.claim_no || 'Claim'}</Text>
          <Text style={styles.customer}>{row.customer_name}</Text>
        </View>
        <Text style={[styles.badge, row.claim_state === 'completed' ? styles.badgeCompleted : styles.badgeActive]}>{row.current_status || humanize(row.claim_state)}</Text>
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
        <Meta label="Vehicle" value={row.vehicle_no || 'Not linked'} />
        <Meta label="Policy" value={row.policy_no || 'External policy'} />
        <Meta label="Service mode" value={humanize(row.claim_service_mode || 'not recorded')} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.date}>{row.accident_at ? `Accident ${formatDateTime(row.accident_at)}` : `Created ${formatDateTime(row.created_at)}`}</Text>
        <View style={styles.claimOpen}><Text style={styles.amount}>{claimAmount(row)}</Text><Ionicons name="chevron-forward" size={14} color={partnerTheme.colors.brand} /></View>
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

function claimAmount(row: PartnerClaimRow) {
  const value = row.settlement_amount ?? row.approved_amount ?? row.estimated_loss;
  return value == null ? 'Amount not recorded' : formatMoney(value);
}

function formatMoney(value: number | string) {
  const amount = Number(value);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { width: '48%', minHeight: 88, justifyContent: 'center', borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, fontWeight: '700' },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  notice: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: partnerTheme.radius.md, padding: 12, backgroundColor: partnerTheme.colors.accentSoft },
  noticeText: { flex: 1, color: '#56716F', fontSize: 9.5, lineHeight: 14 },
  searchWrap: { height: 48, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: partnerTheme.radius.md, paddingHorizontal: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  searchInput: { flex: 1, color: partnerTheme.colors.ink, fontSize: 11 },
  filters: { marginTop: 12, flexDirection: 'row', gap: 7 },
  filter: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: partnerTheme.colors.surfaceMuted },
  filterActive: { backgroundColor: partnerTheme.colors.brandStrong },
  filterText: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '700' },
  filterTextActive: { color: partnerTheme.colors.white },
  error: { marginTop: 12, color: partnerTheme.colors.danger, fontSize: 10 },
  listHeader: { marginTop: 22, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  listTitle: { color: partnerTheme.colors.ink, fontSize: 14, fontWeight: '700' },
  listCount: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, fontWeight: '600' },
  listLoading: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 10 },
  claimRow: { borderRadius: partnerTheme.radius.lg, padding: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  claimTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  claimIdentity: { flex: 1 },
  claimNo: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9.5 },
  badge: { overflow: 'hidden', maxWidth: 135, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '800' },
  badgeActive: { color: '#9A5B12', backgroundColor: '#FFF2DD' },
  badgeCompleted: { color: '#18794E', backgroundColor: '#E9F7EF' },
  metaGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 11 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 9.5, fontWeight: '600' },
  footer: { marginTop: 14, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  date: { color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  claimOpen: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  amount: { color: partnerTheme.colors.brandStrong, fontSize: 8.5, fontWeight: '700' },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface },
  emptyTitle: { marginTop: 10, color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '700' },
  emptyText: { marginTop: 4, maxWidth: 260, color: partnerTheme.colors.inkMuted, fontSize: 9.5, textAlign: 'center', lineHeight: 14 },
});
