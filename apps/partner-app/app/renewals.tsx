import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerListScreen } from '@/components/partner-list-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerOperationalRow } from '@/components/ui/partner-operational-row';
import { PartnerSearchField } from '@/components/ui/partner-search-field';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { PartnerPagination } from '@/components/ui/partner-pagination';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import {
  getPartnerRenewalSummary,
  listPartnerRenewals,
  type PartnerRenewalBucket,
  type PartnerRenewalMode,
  type PartnerRenewalRow,
  type PartnerRenewalSummary,
} from '@/lib/policies';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePartnerPageQuery } from '@/lib/use-partner-page-query';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type DueDateSort = 'asc' | 'desc';

type SummarySelection = {
  eyebrow: string;
  premium: number | string;
  count: number;
};

const PAGE_SIZE = 25;
let savedRenewalMode: PartnerRenewalMode = 'expiring';
let savedRenewalQuery = '';

export default function RenewalsScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const [mode, setMode] = useState<PartnerRenewalMode>(savedRenewalMode);
  const [bucket, setBucket] = useState<PartnerRenewalBucket>(savedRenewalMode === 'expired' ? 'overdue' : 'all');
  const [query, setQuery] = useState(savedRenewalQuery);
  const [sortDirection, setSortDirection] = useState<DueDateSort>('asc');
  const [sortOpen, setSortOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    savedRenewalMode = mode;
    savedRenewalQuery = query;
  }, [mode, query]);

  const fetchSummary = useCallback(() => getPartnerRenewalSummary(), []);
  const summary = usePartnerQuery<PartnerRenewalSummary>({
    scopeKey: cacheScopeKey,
    key: 'renewals:summary',
    fetcher: fetchSummary,
    staleTimeMs: 90_000,
  });

  const fetchPage = useCallback(async ({ limit, offset }: { limit: number; offset: number }) => {
    const nextRows = await listPartnerRenewals({ mode, bucket, search: debouncedSearch, limit, offset });
    return { rows: nextRows, total: nextRows[0]?.total_count ?? 0 };
  }, [bucket, debouncedSearch, mode]);

  const collection = usePartnerPageQuery<PartnerRenewalRow>({
    scopeKey: cacheScopeKey,
    key: `renewals:list:${mode}:${bucket}:${debouncedSearch || 'all'}`,
    pageSize: PAGE_SIZE,
    fetchPage,
    staleTimeMs: 60_000,
  });

  const sortedRows = useMemo(() => [...collection.rows].sort((a, b) => {
    const aTime = expirySortValue(a.end_date, sortDirection);
    const bTime = expirySortValue(b.end_date, sortDirection);
    return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
  }), [collection.rows, sortDirection]);

  const selectedSummary = useMemo(
    () => resolveSummarySelection(summary.data, mode, bucket),
    [bucket, mode, summary.data],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([summary.refresh(), collection.refresh()]);
  }, [collection, summary]);

  const selectMode = (nextMode: PartnerRenewalMode) => {
    setMode(nextMode);
    setBucket(nextMode === 'expired' ? 'overdue' : 'all');
    setSortOpen(false);
  };

  const selectBucket = (nextBucket: PartnerRenewalBucket) => {
    setMode(nextBucket === 'overdue' ? 'expired' : 'expiring');
    setBucket(nextBucket);
    setSortOpen(false);
  };

  const selectSort = (direction: DueDateSort) => {
    setSortDirection(direction);
    setSortOpen(false);
  };

  const header = (
    <View>
      {summary.loading && !summary.data ? (
        <PartnerStateView state="loading" title="Loading renewal summary" />
      ) : (
        <View style={styles.summaryPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show ${mode === 'expired' ? 'all overdue' : 'all next 30 day'} renewal policies`}
            onPress={() => selectBucket(mode === 'expired' ? 'overdue' : 'all')}
            style={({ pressed }) => [styles.summaryLead, pressed && styles.summaryPressed]}
          >
            <View>
              <Text style={styles.summaryEyebrow}>{selectedSummary.eyebrow}</Text>
              <Text style={styles.summaryPremium}>{formatIndianCurrency(selectedSummary.premium)}</Text>
              <Text style={styles.summaryLabel}>Net Premium</Text>
            </View>
            <View style={styles.summaryCount}>
              <Text style={styles.summaryCountValue}>{selectedSummary.count}</Text>
              <Text style={styles.summaryCountLabel}>Policies</Text>
            </View>
          </Pressable>
          <View style={styles.metricRow}>
            <Metric icon="time-outline" value={summary.data?.due_0_7_count ?? 0} label="0 – 7d" tone="amber" active={bucket === '0_7'} onPress={() => selectBucket('0_7')} />
            <Metric icon="time-outline" value={summary.data?.due_8_15_count ?? 0} label="8 – 15d" tone="blue" active={bucket === '8_15'} onPress={() => selectBucket('8_15')} />
            <Metric icon="time-outline" value={summary.data?.due_16_30_count ?? 0} label="16 – 30d" tone="purple" active={bucket === '16_30'} onPress={() => selectBucket('16_30')} />
            <Metric icon="alert-circle-outline" value={summary.data?.overdue_count ?? 0} label="Overdue" tone="red" active={bucket === 'overdue'} onPress={() => selectBucket('overdue')} last />
          </View>
        </View>
      )}

      {(collection.stale || summary.stale) ? (
        <View style={styles.banner}>
          <PartnerBanner tone="warning" title={collection.offline || summary.offline ? "You're offline" : 'Showing cached information'} message={`Last refreshed ${formatUpdatedAt(collection.updatedAt || summary.updatedAt)}. Pull down to try again.`} />
        </View>
      ) : null}

      <View style={styles.modeTabs}>
        <ModeTab label="Upcoming" count={summary.data?.due_30_count ?? 0} active={mode === 'expiring'} onPress={() => selectMode('expiring')} />
        <ModeTab label="Overdue" count={summary.data?.overdue_count ?? 0} active={mode === 'expired'} danger onPress={() => selectMode('expired')} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchGrow}>
          <PartnerSearchField
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search policy, customer or insurer..."
            containerStyle={styles.searchField}
          />
        </View>
      </View>

      <View style={styles.opportunitiesHeader}>
        <View style={styles.opportunitiesLeft}>
          <Ionicons name="list-outline" size={23} color="#3326D9" />
          <View>
            <Text style={styles.opportunitiesTitle}>{mode === 'expired' ? 'OVERDUE POLICIES' : 'RENEWAL OPPORTUNITIES'}</Text>
            <Text style={styles.opportunitiesMeta}>{collection.loading ? 'Loading…' : `${collection.rows.length} policies · ${collection.total} total`}</Text>
          </View>
        </View>
        <View style={styles.sortArea}>
          <Pressable accessibilityRole="button" accessibilityLabel="Sort renewals by due date" onPress={() => setSortOpen((open) => !open)} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
            <Text style={styles.sortText}>Due Date</Text>
            <Ionicons name={sortOpen ? 'chevron-up' : 'chevron-down'} size={14} color="#42516A" />
          </Pressable>
          {sortOpen ? (
            <View style={styles.sortMenu}>
              <Pressable accessibilityRole="button" onPress={() => selectSort('asc')} style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}>
                <Text style={[styles.sortOptionText, sortDirection === 'asc' && styles.sortOptionTextActive]}>Earliest first</Text>
                {sortDirection === 'asc' ? <Ionicons name="checkmark" size={15} color={partnerTheme.colors.brand} /> : null}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => selectSort('desc')} style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}>
                <Text style={[styles.sortOptionText, sortDirection === 'desc' && styles.sortOptionTextActive]}>Latest first</Text>
                {sortDirection === 'desc' ? <Ionicons name="checkmark" size={15} color={partnerTheme.colors.brand} /> : null}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {collection.error && collection.rows.length && !collection.stale ? <View style={styles.inlineBanner}><PartnerBanner tone="warning" message={collection.error} /></View> : null}
    </View>
  );

  const empty = collection.loading ? (
    <PartnerStateView state="loading" title="Finding renewal opportunities" />
  ) : collection.error ? (
    <PartnerStateView state="error" title="Renewals could not be loaded" message={collection.error} actionLabel="Try again" onAction={() => void refreshAll()} />
  ) : (
    <View style={styles.emptyCard}>
      <Image source={PartnerAssets.emptyStates.noRenewals} style={styles.emptyArtwork} resizeMode="contain" />
      <Text style={styles.emptyTitle}>{mode === 'expiring' ? 'No policies in this renewal window' : 'No overdue policies found'}</Text>
      <Text style={styles.emptyMessage}>The queue is derived from your authorized policy book{`\n`}and policy expiry dates.</Text>
    </View>
  );

  const footer = collection.rows.length ? (
    <PartnerPagination
      page={collection.page}
      totalPages={collection.totalPages}
      total={collection.total}
      pageSize={PAGE_SIZE}
      rowCount={collection.rows.length}
      onPrevious={collection.previousPage}
      onNext={collection.nextPage}
      disabled={collection.changingPage}
    />
  ) : null;

  return (
    <PartnerListScreen
      key={`renewals-page-${collection.page}`}
      title="Renewal Work Queue"
      onBack={() => router.back()}
      showArtwork={false}
      data={sortedRows}
      keyExtractor={(row) => row.policy_id}
      renderItem={({ item }) => <RenewalCard row={item} mode={mode} onOpenPolicy={() => router.push(`/policy/${item.policy_id}` as never)} />}
      header={header}
      empty={empty}
      footer={footer}
      refreshing={collection.refreshing || summary.refreshing}
      onRefresh={() => void refreshAll()}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function Metric({ icon, value, label, tone, active, onPress, last = false }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string; tone: 'amber' | 'blue' | 'purple' | 'red'; active: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Show ${label} renewal policies`} onPress={onPress} style={({ pressed }) => [styles.metric, !last && styles.metricDivider, active && styles.metricActive, pressed && styles.summaryPressed]}>
      <View style={[styles.metricIcon, styles[`${tone}Bg`]]}><Ionicons name={icon} size={18} color={toneColor(tone)} /></View>
      <View><Text style={[styles.metricValue, tone === 'red' && styles.redValue]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
    </Pressable>
  );
}

function ModeTab({ label, count, active, danger = false, onPress }: { label: string; count: number; active: boolean; danger?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.modeTab, active && styles.modeTabActive]}><Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{label}</Text><View style={[styles.tabBadge, danger ? styles.tabBadgeDanger : styles.tabBadgeBlue]}><Text style={[styles.tabBadgeText, danger ? styles.tabBadgeDangerText : styles.tabBadgeBlueText]}>{count}</Text></View></Pressable>;
}

function resolveSummarySelection(data: PartnerRenewalSummary | null | undefined, mode: PartnerRenewalMode, bucket: PartnerRenewalBucket): SummarySelection {
  if (bucket === '0_7') return { eyebrow: 'DUE IN 0 – 7 DAYS', premium: data?.due_0_7_premium ?? 0, count: data?.due_0_7_count ?? 0 };
  if (bucket === '8_15') return { eyebrow: 'DUE IN 8 – 15 DAYS', premium: data?.due_8_15_premium ?? 0, count: data?.due_8_15_count ?? 0 };
  if (bucket === '16_30') return { eyebrow: 'DUE IN 16 – 30 DAYS', premium: data?.due_16_30_premium ?? 0, count: data?.due_16_30_count ?? 0 };
  if (bucket === 'overdue' || mode === 'expired') return { eyebrow: 'OVERDUE', premium: data?.overdue_premium ?? 0, count: data?.overdue_count ?? 0 };
  return { eyebrow: 'NEXT 30 DAYS', premium: data?.due_30_premium ?? 0, count: data?.due_30_count ?? 0 };
}

function toneColor(tone: 'amber' | 'blue' | 'purple' | 'red') { return tone === 'amber' ? '#F59E0B' : tone === 'blue' ? '#1687F8' : tone === 'purple' ? '#7048F5' : '#F04444'; }

function RenewalCard({ row, mode, onOpenPolicy }: { row: PartnerRenewalRow; mode: PartnerRenewalMode; onOpenPolicy: () => void }) {
  return (
    <PartnerOperationalRow
      title={row.customer_name}
      subtitle={row.policy_no || row.policy_code || 'Policy'}
      value={formatIndianCurrency(row.net_premium)}
      leading={<View style={styles.renewalArtwork}><PartnerInsurerLogo name={row.insurer_name} fallback={PartnerAssets.actions.renewals} style={styles.renewalArtworkImage} /></View>}
      trailing={<PartnerStatusBadge label={renewalLabel(row.end_date)} tone={mode === 'expired' ? 'danger' : renewalTone(row.end_date)} />}
      onPress={onOpenPolicy}
      accessibilityLabel={`Open renewal policy ${row.policy_no || row.policy_code || ''} for ${row.customer_name}`}
      divider={false}
      showChevron={false}
    />
  );
}

function expirySortValue(value: string | null, direction: DueDateSort) {
  if (!value) return direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? (direction === 'asc' ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER) : parsed;
}
function daysUntil(value: string | null) { if (!value) return 9999; const end = new Date(`${value}T00:00:00`); const today = new Date(); today.setHours(0, 0, 0, 0); return Math.ceil((end.getTime() - today.getTime()) / 86400000); }
function renewalLabel(value: string | null) { const days = daysUntil(value); if (days === 9999) return 'No expiry'; if (days < 0) return `${Math.abs(days)}d overdue`; if (days === 0) return 'Due today'; return `${days}d left`; }
function renewalTone(value: string | null): 'warning' | 'info' { return daysUntil(value) <= 7 ? 'warning' : 'info'; }
function formatUpdatedAt(value: number | null) { if (!value) return 'earlier'; return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

const styles = StyleSheet.create({
  summaryPanel: { marginTop: -4, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7ECF4', shadowColor: '#0A285F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  summaryLead: { paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF0F5' },
  summaryPressed: { opacity: 0.72 },
  summaryEyebrow: { color: '#68758A', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 1.4 },
  summaryPremium: { marginTop: 2, color: '#0C1830', fontSize: 22, lineHeight: 27, fontWeight: '800' },
  summaryLabel: { marginTop: 1, color: '#657086', fontSize: 10 },
  summaryCount: { alignItems: 'flex-end' },
  summaryCountValue: { color: '#0C1830', fontSize: 23, lineHeight: 27, fontWeight: '800' },
  summaryCountLabel: { marginTop: 3, color: '#657086', fontSize: 10 },
  metricRow: { paddingTop: 10, flexDirection: 'row' },
  metric: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  metricActive: { backgroundColor: '#F4F6FF' },
  metricDivider: { borderRightWidth: 1, borderRightColor: '#EDF0F5' },
  metricIcon: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  amberBg: { backgroundColor: '#FFF4DA' }, blueBg: { backgroundColor: '#E8F4FF' }, purpleBg: { backgroundColor: '#F0EAFE' }, redBg: { backgroundColor: '#FFE8E8' },
  metricValue: { color: '#101A31', fontSize: 16, lineHeight: 20, fontWeight: '800' }, redValue: { color: '#E43C3C' },
  metricLabel: { marginTop: 3, color: '#657086', fontSize: 9 },
  banner: { marginTop: 9 }, inlineBanner: { marginBottom: 8 },
  modeTabs: { marginTop: 14, flexDirection: 'row', gap: 20, borderBottomWidth: 1, borderBottomColor: '#E3E8F0' },
  modeTab: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 5, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  modeTabActive: { borderBottomColor: '#3E28F5' }, modeLabel: { color: '#29344B', fontSize: 12, fontWeight: '700' }, modeLabelActive: { color: '#111B31' },
  tabBadge: { minWidth: 23, height: 23, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, tabBadgeBlue: { backgroundColor: '#EAF0FF' }, tabBadgeDanger: { backgroundColor: '#FFE9E9' },
  tabBadgeText: { fontSize: 10, fontWeight: '800' }, tabBadgeBlueText: { color: '#4434F4' }, tabBadgeDangerText: { color: '#EF4444' },
  searchRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' }, searchGrow: { flex: 1 },
  searchField: { borderColor: '#D8E0EB', backgroundColor: '#FFFFFF' },
  opportunitiesHeader: { position: 'relative', zIndex: 20, marginTop: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, opportunitiesLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  opportunitiesTitle: { color: '#17233B', fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 0.25 }, opportunitiesMeta: { marginTop: 1, color: '#7A8598', fontSize: 9 },
  sortArea: { position: 'relative', zIndex: 30, flexDirection: 'row', alignItems: 'center' }, sortButton: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F1' }, sortText: { color: '#263249', fontSize: 10, fontWeight: '700' },
  sortMenu: { position: 'absolute', top: 39, right: 0, zIndex: 40, width: 148, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E9F1', shadowColor: '#0C2856', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 10 },
  sortOption: { minHeight: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sortOptionPressed: { backgroundColor: '#F6F8FC' }, sortOptionText: { color: '#42516A', fontSize: 10.5, fontWeight: '600' }, sortOptionTextActive: { color: partnerTheme.colors.brand, fontWeight: '800' },
  emptyCard: { minHeight: 205, marginTop: 2, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DCE4EF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  emptyArtwork: { width: 122, height: 82, marginBottom: 8 }, emptyTitle: { color: '#101A31', fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'center' }, emptyMessage: { marginTop: 7, color: '#69758A', fontSize: 10, lineHeight: 17, textAlign: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: partnerTheme.colors.line }, renewalArtwork: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, renewalArtworkImage: { width: 36, height: 36 },
  pressed: { opacity: 0.65 },
  listFooter: { minHeight: 58, alignItems: 'center', justifyContent: 'center' }, loadingMore: { flexDirection: 'row', alignItems: 'center', gap: 8 }, loadingMoreText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption }, endText: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.meta },
});