import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerFilterChip } from '@/components/ui/partner-filter-chip';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import {
  getPartnerClaimSummary,
  listPartnerClaims,
  type PartnerClaimRow,
  type PartnerClaimState,
  type PartnerClaimSummary,
} from '@/lib/claims';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerClaimState; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

let savedClaimQuery = '';
let savedClaimState: PartnerClaimState = 'all';

export default function ClaimsScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<PartnerClaimSummary | null>(null);
  const [rows, setRows] = useState<PartnerClaimRow[]>([]);
  const [state, setState] = useState<PartnerClaimState>(savedClaimState);
  const [query, setQuery] = useState(savedClaimQuery);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    savedClaimQuery = query;
    savedClaimState = state;
  }, [query, state]);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      try {
        const nextSummary = await getPartnerClaimSummary();
        if (!cancelled) setSummary(nextSummary);
      } catch {
        if (!cancelled) setError('Claim summary could not be loaded for this account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSummary();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const loadFirstPage = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const nextRows = await listPartnerClaims({
        state,
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setRows(nextRows);
      setTotal(nextRows[0]?.total_count ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
      setError('Claim data could not be loaded for this account.');
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, state]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, reloadKey]);

  async function loadMore() {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextRows = await listPartnerClaims({
        state,
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: rows.length,
      });
      setRows((current) => [...current, ...nextRows]);
      if (nextRows[0]?.total_count != null) setTotal(nextRows[0].total_count);
    } catch {
      setError('More claims could not be loaded. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PartnerScreen eyebrow="SERVICE" title="Claims">
      {loading ? (
        <PartnerStateView state="loading" title="Loading claim book" />
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Total claims" value={summary?.total_claims ?? 0} />
            <SummaryCard label="Active" value={summary?.active_claims ?? 0} />
            <SummaryCard label="Completed" value={summary?.completed_claims ?? 0} />
            <SummaryCard label="Assistance open" value={summary?.assistance_requested ?? 0} />
          </View>

          <View style={styles.notice}>
            <Ionicons name="shield-checkmark-outline" size={18} color={partnerTheme.colors.accent} />
            <Text style={styles.noticeText}>Only claims within your authorized Partner scope are shown here.</Text>
          </View>

          <View style={styles.search}>
            <PartnerSearchField
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search claim, customer, vehicle or policy"
            />
            <Text style={styles.searchHint}>Search updates automatically as you type.</Text>
          </View>

          <View style={styles.filters}>
            {filters.map((filter) => (
              <PartnerFilterChip
                key={filter.value}
                label={filter.label}
                active={state === filter.value}
                onPress={() => setState(filter.value)}
              />
            ))}
          </View>

          <PartnerSectionHeader title="Claim book" meta={listLoading ? 'Searching…' : `${total} records`} />

          {error && !rows.length ? (
            <PartnerStateView
              state="error"
              title="Claims could not be loaded"
              message={error}
              actionLabel="Try again"
              onAction={() => setReloadKey((value) => value + 1)}
            />
          ) : listLoading ? (
            <PartnerStateView state="loading" title="Finding claims" />
          ) : rows.length ? (
            <>
              <View style={styles.list}>
                {rows.map((row) => (
                  <ClaimRow
                    key={row.claim_id}
                    row={row}
                    onPress={() => router.push(`/claim/${row.claim_id}` as never)}
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
                <Text style={styles.endText}>End of claim book</Text>
              )}
            </>
          ) : (
            <PartnerStateView
              state="empty"
              icon="shield-checkmark-outline"
              title="No claims found"
              message="There are no claims matching this authorized scope and filter."
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

function ClaimRow({ row, onPress }: { row: PartnerClaimRow; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open claim ${row.claim_no || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.claimRow, pressed && styles.pressed]}
    >
      <View style={styles.claimTop}>
        <View style={styles.claimIcon}>
          <Ionicons name="shield-outline" size={19} color={partnerTheme.colors.accent} />
        </View>
        <View style={styles.claimIdentity}>
          <Text style={styles.claimNo}>{row.claim_no || 'Claim'}</Text>
          <Text style={styles.customer}>{row.customer_name}</Text>
        </View>
        <PartnerStatusBadge
          label={humanize(row.current_status || row.claim_state)}
          tone={row.claim_state === 'completed' ? 'success' : 'warning'}
        />
      </View>

      <View style={styles.metaGrid}>
        <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
        <Meta label="Vehicle" value={row.vehicle_no || 'Not linked'} />
        <Meta label="Policy" value={row.policy_no || 'External policy'} />
        <Meta label="Service mode" value={humanize(row.claim_service_mode || 'not recorded')} />
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{row.accident_at ? 'ACCIDENT' : 'CREATED'}</Text>
          <Text style={styles.date}>{formatDate(row.accident_at || row.created_at)}</Text>
        </View>
        <View style={styles.claimOpen}>
          <Text style={styles.amount}>{claimAmount(row)}</Text>
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

function claimAmount(row: PartnerClaimRow) {
  const value = row.settlement_amount ?? row.approved_amount ?? row.estimated_loss;
  return value == null ? 'Amount not recorded' : formatMoney(value);
}

function formatMoney(value: number | string) {
  const amount = Number(value);
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).format(date);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { width: '48%', minHeight: 88, justifyContent: 'center', borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  notice: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: partnerTheme.radius.md, padding: 12, backgroundColor: partnerTheme.colors.accentSoft },
  noticeText: { flex: 1, color: '#56716F', ...partnerTheme.typography.caption },
  search: { marginTop: 14 },
  searchHint: { marginTop: 6, marginLeft: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  filters: { marginTop: 12, flexDirection: 'row', gap: 7 },
  list: { gap: 10 },
  claimRow: { borderRadius: partnerTheme.radius.lg, padding: 16, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  claimTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  claimIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.accentSoft },
  claimIdentity: { flex: 1 },
  claimNo: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  customer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.82 },
  metaGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 11 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', textTransform: 'uppercase', letterSpacing: 0.6, ...partnerTheme.typography.meta },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  footer: { marginTop: 14, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  date: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  claimOpen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.caption },
  loadMore: { marginTop: partnerTheme.spacing.md },
  endText: { marginTop: 12, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  inlineError: { marginTop: 10, color: partnerTheme.colors.danger, textAlign: 'center', ...partnerTheme.typography.caption },
});
