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
  getPartnerPolicySummary,
  listPartnerPolicies,
  type PartnerPolicyLifecycle,
  type PartnerPolicyRow,
  type PartnerPolicySummary,
} from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const PAGE_SIZE = 25;
const filters: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_force', label: 'In force' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'upcoming', label: 'Upcoming' },
];

let savedPolicyQuery = '';
let savedPolicyLifecycle: PartnerPolicyLifecycle = 'all';

export default function PoliciesScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<PartnerPolicySummary | null>(null);
  const [rows, setRows] = useState<PartnerPolicyRow[]>([]);
  const [lifecycle, setLifecycle] = useState<PartnerPolicyLifecycle>(savedPolicyLifecycle);
  const [query, setQuery] = useState(savedPolicyQuery);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    savedPolicyQuery = query;
    savedPolicyLifecycle = lifecycle;
  }, [lifecycle, query]);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      try {
        const nextSummary = await getPartnerPolicySummary();
        if (!cancelled) setSummary(nextSummary);
      } catch {
        if (!cancelled) setError('Policy summary could not be loaded for this account.');
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
      const nextRows = await listPartnerPolicies({
        lifecycle,
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setRows(nextRows);
      setTotal(nextRows[0]?.total_count ?? 0);
    } catch {
      setRows([]);
      setTotal(0);
      setError('Policy data could not be loaded for this account.');
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, lifecycle]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, reloadKey]);

  async function loadMore() {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextRows = await listPartnerPolicies({
        lifecycle,
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: rows.length,
      });
      setRows((current) => [...current, ...nextRows]);
      if (nextRows[0]?.total_count != null) setTotal(nextRows[0].total_count);
    } catch {
      setError('More policies could not be loaded. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="BUSINESS"
      title="Policies"
      action={
        <PartnerButton
          label="Intake"
          icon="cloud-upload-outline"
          fullWidth={false}
          onPress={() => router.push('/policy-intakes')}
        />
      }
    >
      {loading ? (
        <PartnerStateView state="loading" title="Loading policy book" />
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <SummaryCard label="Total policies" value={summary?.total_policies ?? 0} />
            <SummaryCard label="In force" value={summary?.in_force_policies ?? 0} />
            <SummaryCard label="Expiring in 30 days" value={summary?.expiring_30_days ?? 0} />
            <SummaryCard label="Premium booked" value={formatMoney(summary?.total_premium ?? 0)} compact />
          </View>

          <View style={styles.search}>
            <PartnerSearchField
              value={query}
              onChangeText={setQuery}
              onClear={() => setQuery('')}
              placeholder="Search policy, customer, vehicle or insurer"
            />
            <Text style={styles.searchHint}>Search updates automatically as you type.</Text>
          </View>

          <View style={styles.filters}>
            {filters.map((filter) => (
              <PartnerFilterChip
                key={filter.value}
                label={filter.label}
                active={lifecycle === filter.value}
                onPress={() => setLifecycle(filter.value)}
              />
            ))}
          </View>

          <PartnerSectionHeader title="Policy book" meta={listLoading ? 'Searching…' : `${total} records`} />

          {error && !rows.length ? (
            <PartnerStateView
              state="error"
              title="Policies could not be loaded"
              message={error}
              actionLabel="Try again"
              onAction={() => setReloadKey((value) => value + 1)}
            />
          ) : listLoading ? (
            <PartnerStateView state="loading" title="Finding policies" />
          ) : rows.length ? (
            <>
              <View style={styles.list}>
                {rows.map((row) => (
                  <PolicyRow
                    key={row.policy_id}
                    row={row}
                    onPress={() => router.push(`/policy/${row.policy_id}` as never)}
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
                <Text style={styles.endText}>End of policy book</Text>
              )}
            </>
          ) : (
            <PartnerStateView
              state="empty"
              icon="document-text-outline"
              title="No policies found"
              message="Try another search term or policy lifecycle filter."
            />
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

function PolicyRow({ row, onPress }: { row: PartnerPolicyRow; onPress: () => void }) {
  const category = policyCategory(row);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${category} policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.policyRow, pressed && styles.pressed]}
    >
      <View style={styles.policyTop}>
        <View style={styles.policyIcon}>
          <Ionicons name={category === 'Motor' ? 'car-outline' : category === 'Health' ? 'medkit-outline' : category === 'Life' ? 'heart-outline' : 'business-outline'} size={19} color={partnerTheme.colors.brand} />
        </View>
        <View style={styles.policyIdentity}>
          <Text style={styles.policyNo}>{row.policy_no || row.policy_code || 'Policy'}</Text>
          <Text style={styles.policyCustomer}>{row.customer_name}</Text>
        </View>
        <View style={styles.badges}>
          <PartnerStatusBadge label={category} tone="brand" />
          <PartnerStatusBadge label={humanize(row.lifecycle_status)} tone={lifecycleTone(row.lifecycle_status)} />
        </View>
      </View>

      <View style={styles.policyMetaGrid}>
        <Meta label="Insurer" value={row.insurer_name || 'Not recorded'} />
        <Meta label="Risk / vehicle" value={row.vehicle_no || row.policy_product || 'Non-motor / not linked'} />
        <Meta label="Product" value={row.policy_product || row.policy_type || row.business_line || 'Not recorded'} />
        <Meta label="Premium" value={formatMoney(row.premium_amount)} />
      </View>

      <View style={styles.policyFooter}>
        <View>
          <Text style={styles.footerLabel}>TERM</Text>
          <Text style={styles.policyDates}>{formatDate(row.start_date)} → {formatDate(row.end_date)}</Text>
        </View>
        <View style={styles.policyOpen}>
          <Text style={styles.policyIntermediary}>{row.intermediary_code || 'Direct'}</Text>
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

function policyCategory(row: PartnerPolicyRow) {
  const value = [row.policy_type, row.policy_product, row.business_line].filter(Boolean).join(' ').toLowerCase();
  if (value.includes('health')) return 'Health';
  if (value.includes('life')) return 'Life';
  if (value.includes('motor') || row.vehicle_id || row.vehicle_no) return 'Motor';
  return 'Non-Motor';
}

function lifecycleTone(value: PartnerPolicyRow['lifecycle_status']): 'success' | 'warning' | 'danger' | 'info' {
  if (value === 'expired') return 'danger';
  if (value === 'expiring') return 'warning';
  if (value === 'upcoming') return 'info';
  return 'success';
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
  summaryValue: { color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  summaryValueCompact: { fontSize: 18 },
  summaryLabel: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  search: { marginTop: 18 },
  searchHint: { marginTop: 6, marginLeft: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  filters: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  list: { gap: 10 },
  policyRow: {
    borderRadius: partnerTheme.radius.lg,
    padding: 16,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  pressed: { opacity: 0.82 },
  policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  policyIdentity: { flex: 1 },
  policyNo: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  policyCustomer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  badges: { alignItems: 'flex-end', gap: 5 },
  policyMetaGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', rowGap: 11 },
  meta: { width: '50%', paddingRight: 8 },
  metaLabel: { color: '#8A94A6', letterSpacing: 0.65, textTransform: 'uppercase', ...partnerTheme.typography.meta },
  metaValue: { marginTop: 3, color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  policyFooter: { marginTop: 14, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  footerLabel: { color: '#9AA3B2', letterSpacing: 0.5, ...partnerTheme.typography.meta },
  policyDates: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  policyOpen: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyIntermediary: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  loadMore: { marginTop: partnerTheme.spacing.md },
  endText: { marginTop: 12, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
  inlineError: { marginTop: 10, color: partnerTheme.colors.danger, textAlign: 'center', ...partnerTheme.typography.caption },
});
