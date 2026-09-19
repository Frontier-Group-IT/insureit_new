import { useCallback, useMemo, useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerBusinessDateFilterCompat } from '@/components/partner-business-date-filter-compat';
import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { getPartnerClaimSummary, type PartnerClaimSummary } from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';
import { type PartnerBusinessRangeSummary } from '@/lib/home';
import { getPartnerNetwork, type PartnerNetworkData } from '@/lib/network';
import { PartnerAssets } from '@/lib/partner-assets';
import { getPartnerPayoutSummary, type PartnerPayoutSummary } from '@/lib/payout';
import { getPartnerRenewalSummary, type PartnerRenewalSummary } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type OverviewCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  changeLabel?: string;
};

export default function BusinessScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const [showRange, setShowRange] = useState(false);
  const [rangeSelection, setRangeSelection] = useState<{ summary: PartnerBusinessRangeSummary; label: string } | null>(null);

  const fetchBusinessWorkspace = useCallback(async (): Promise<{
    performance: PartnerBusinessPerformance;
    network: PartnerNetworkData;
    renewals: PartnerRenewalSummary | null;
    claims: PartnerClaimSummary | null;
    payout: PartnerPayoutSummary | null;
    secondaryWarning: boolean;
  }> => {
    const [performanceResult, networkResult, renewalResult, claimResult, payoutResult] = await Promise.allSettled([
      getPartnerBusinessPerformance(),
      getPartnerNetwork(),
      getPartnerRenewalSummary(),
      getPartnerClaimSummary(),
      getPartnerPayoutSummary(),
    ]);

    if (performanceResult.status === 'rejected') throw performanceResult.reason;
    if (networkResult.status === 'rejected') throw networkResult.reason;

    return {
      performance: performanceResult.value,
      network: networkResult.value,
      renewals: renewalResult.status === 'fulfilled' ? renewalResult.value : null,
      claims: claimResult.status === 'fulfilled' ? claimResult.value : null,
      payout: payoutResult.status === 'fulfilled' ? payoutResult.value : null,
      secondaryWarning: renewalResult.status === 'rejected'
        || claimResult.status === 'rejected'
        || payoutResult.status === 'rejected',
    };
  }, []);

  const workspace = usePartnerQuery({
    scopeKey: cacheScopeKey,
    key: 'business:workspace',
    fetcher: fetchBusinessWorkspace,
    staleTimeMs: 90_000,
  });

  useFocusEffect(useCallback(() => {
    void workspace.ensureFresh();
  }, [workspace.ensureFresh]));

  const performance = workspace.data?.performance ?? null;
  const network = workspace.data?.network ?? null;
  const renewals = workspace.data?.renewals ?? null;
  const claims = workspace.data?.claims ?? null;
  const payout = workspace.data?.payout ?? null;

  const policiesChange = useMemo(() => {
    if (!performance || !performance.policies_last_month) return null;
    return ((performance.policies_this_month - performance.policies_last_month) / performance.policies_last_month) * 100;
  }, [performance]);

  const productMix = useMemo(() => {
    if (!performance) return [];
    const total = Math.max(1, Number(performance.premium_this_month || 0));
    return performance.business_mix.slice(0, 6).map((item, index) => ({
      ...item,
      share: Math.max(0, Math.round((Number(item.premium || 0) / total) * 100)),
      asset: productAsset(item.label, index),
    }));
  }, [performance]);

  return (
    <PartnerScreen
      title=""
      hideTopBar
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={workspace.refreshing}
            onRefresh={() => void workspace.refresh()}
            tintColor={partnerTheme.colors.brand}
            colors={[partnerTheme.colors.brand]}
          />
        ),
      }}
    >
      {workspace.loading && (!performance || !network) ? (
        <PartnerStateView state="loading" title="Loading business workspace" />
      ) : !performance || !network ? (
        <PartnerStateView
          state="error"
          title="Business workspace unavailable"
          message={workspace.error || 'Business data could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void workspace.refresh()}
        />
      ) : (
        <>
          <View style={styles.heroBanner}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Business</Text>
              <Text style={styles.heroSubtitle}>Track, Analyse, Grow.</Text>
              <Text style={styles.heroSubtitle}>Good Morning,</Text>
              <Text style={styles.heroName}>Partner</Text>
            </View>
            <Image source={PartnerAssets.banners.businessGrowth01} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroWords}>
              <Text style={styles.heroWord}>MORE</Text>
              <Text style={styles.heroWord}>POLICIES</Text>
              <Text style={styles.heroWord}>STRONGER</Text>
              <Text style={styles.heroWord}>RELATIONSHIPS</Text>
              <Text style={styles.heroWord}>BRIGHTER</Text>
              <Text style={styles.heroWord}>TOMORROW</Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/search')} style={({ pressed }) => [styles.searchBox, pressed && styles.pressed]}>
              <Ionicons name="search-outline" size={15} color="#4966B6" />
              <Text numberOfLines={1} style={styles.searchText}>Search customer, vehicle number or policy number...</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowRange((value) => !value)} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <Ionicons name="filter-outline" size={15} color="#3156B8" />
              <Text style={styles.filterText}>Filter</Text>
            </Pressable>
          </View>

          {workspace.stale || workspace.error || workspace.data?.secondaryWarning ? (
            <View style={styles.feedback}>
              <PartnerBanner
                tone="warning"
                title={workspace.offline ? "You're offline" : workspace.stale ? 'Showing cached information' : undefined}
                message={workspace.stale
                  ? `Last refreshed ${formatCacheTime(workspace.updatedAt)}. Pull down to try again.`
                  : workspace.error || 'Some secondary business information could not be refreshed.'}
              />
            </View>
          ) : null}

          <SectionHeader
            title="Business Overview"
            action={(
              <Pressable accessibilityRole="button" onPress={() => setShowRange((value) => !value)} style={styles.periodButton}>
                <Text style={styles.periodText}>{rangeSelection?.label ?? (showRange ? 'Custom' : 'This Month')}</Text>
                <Ionicons name="chevron-down" size={12} color="#3156B8" />
              </Pressable>
            )}
          />

          {showRange ? (
            <View style={styles.rangeWrap}>
              <PartnerBusinessDateFilterCompat onChange={setRangeSelection} />
            </View>
          ) : null}

          <View style={styles.overviewGrid}>
            <OverviewCard
              icon="cash-outline"
              value={formatCompactCurrency(rangeSelection?.summary.premium ?? performance.premium_this_month)}
              label="Premium Generated"
              changeLabel={changeText(Number(rangeSelection?.summary.premium_change_percent ?? performance.premium_change_percent ?? 0), Number(rangeSelection?.summary.premium_previous_period ?? performance.premium_last_month ?? 0) > 0)}
            />
            <OverviewCard
              icon="document-text-outline"
              value={String(rangeSelection?.summary.policies ?? performance.policies_this_month)}
              label="Policies Sold"
              changeLabel={rangeSelection ? 'Selected range' : policiesChange === null ? 'Current month' : changeText(policiesChange, true)}
            />
            <OverviewCard
              icon="wallet-outline"
              value={payout?.available ? formatCompactCurrency(payout.paid_amount) : '—'}
              label="Commission Earned"
              changeLabel={payout?.available ? `${payout.paid_count} paid` : 'Restricted'}
            />
            <OverviewCard
              icon="people-outline"
              value={String(rangeSelection?.summary.customers ?? performance.total_customers)}
              label="Customers"
              changeLabel="Current portfolio"
            />
          </View>

          <SectionHeader
            title="Month-wise Trend"
            action={(
              <View style={styles.sectionActions}>
                <View style={styles.smallSelect}>
                  <Text style={styles.smallSelectText}>Last 6 Months</Text>
                  <Ionicons name="chevron-down" size={10} color="#3156B8" />
                </View>
                <Text style={styles.viewAll}>View Report</Text>
                <Ionicons name="chevron-forward" size={10} color="#3156B8" />
              </View>
            )}
          />
          <TrendChart data={performance.trend} />

          <SectionHeader
            title="Business by Product"
            action={<Text style={styles.viewAll}>View All ›</Text>}
          />
          <View style={styles.productGrid}>
            {productMix.length ? productMix.map((item) => (
              <ProductTile key={item.label} asset={item.asset} label={humanize(item.label)} share={item.share} />
            )) : (
              <View style={styles.emptyCompact}><Text style={styles.emptyCompactText}>No product mix recorded this month.</Text></View>
            )}
          </View>

          <SectionHeader title="Top Insurers" action={<Text style={styles.viewAll}>View All ›</Text>} />
          <View style={styles.insurerCard}>
            <View style={styles.insurerEmptyIcon}>
              <Ionicons name="business-outline" size={18} color="#3156B8" />
            </View>
            <View style={styles.insurerEmptyBody}>
              <Text style={styles.insurerEmptyTitle}>Insurer mix</Text>
              <Text style={styles.insurerEmptyText}>Insurer-wise totals are not included in the current Business data.</Text>
            </View>
          </View>

          <SectionHeader title="Quick Actions" />
          <View style={styles.quickGrid}>
            <QuickAction
              asset={PartnerAssets.actions.renewals}
              label="Renewals"
              meta={`${renewals?.due_30_count ?? 0} due`}
              onPress={() => router.push('/renewals')}
            />
            <QuickAction
              asset={PartnerAssets.navigation.claims}
              label="Claims"
              meta={`${claims?.active_claims ?? 0} active`}
              onPress={() => router.push('/(tabs)/claims')}
            />
            <PayoutQuickAction payout={payout} onPress={() => router.push('/(tabs)/more')} />
            <QuickAction
              asset={PartnerAssets.actions.addCustomer}
              label="Add Customer"
              meta="Create new"
              onPress={() => router.push('/customers')}
            />
          </View>

          <SectionHeader title="My Network" action={<Pressable onPress={() => router.push('/network')}><Text style={styles.viewAll}>View All ›</Text></Pressable>} />
          <View style={styles.networkGrid}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/network')} style={({ pressed }) => [styles.networkTile, pressed && styles.pressed]}>
              <Image source={PartnerAssets.actions.businessPerformance} style={styles.networkIcon} resizeMode="contain" />
              <View style={styles.networkBody}>
                <Text style={styles.networkValue}>{network.total_partners}</Text>
                <Text style={styles.networkLabel}>Partner Family</Text>
                <Text style={styles.networkMeta}>{network.total_groups} active group{network.total_groups === 1 ? '' : 's'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#3156B8" />
            </Pressable>

            <Pressable accessibilityRole="button" onPress={() => router.push('/customers')} style={({ pressed }) => [styles.networkTile, pressed && styles.pressed]}>
              <Image source={PartnerAssets.navigation.customers} style={styles.networkIcon} resizeMode="contain" />
              <View style={styles.networkBody}>
                <Text style={styles.networkValue}>{performance.total_customers}</Text>
                <Text style={styles.networkLabel}>Customers</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#3156B8" />
            </Pressable>
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

function OverviewCard({ icon, value, label, changeLabel }: OverviewCardProps) {
  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewIcon}>
        <Ionicons name={icon} size={17} color="#1951AE" />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.overviewValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.overviewLabel}>{label}</Text>
      <View style={styles.growthRow}>
        <Ionicons name="trending-up" size={9} color="#16A34A" />
        <Text numberOfLines={1} style={styles.growthText}>{changeLabel}</Text>
      </View>
      <Text style={styles.vsText}>vs last month</Text>
    </View>
  );
}

function TrendChart({ data }: { data: PartnerBusinessPerformance['trend'] }) {
  const max = Math.max(1, ...data.map((item) => Number(item.premium || 0)));
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartYAxis}>
        <Text style={styles.axisText}>3L</Text>
        <Text style={styles.axisText}>2L</Text>
        <Text style={styles.axisText}>1L</Text>
        <Text style={styles.axisText}>0</Text>
      </View>
      <View style={styles.chart}>
        {data.slice(-6).map((item) => {
          const premium = Number(item.premium || 0);
          const height = Math.max(4, Math.round((premium / max) * 68));
          return (
            <View key={item.month} style={styles.barColumn}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.barValue}>{formatCompactCurrency(premium)}</Text>
              <View style={styles.barTrack}><View style={[styles.bar, { height }]} /></View>
              <Text style={styles.barMonth}>{shortMonth(item.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProductTile({ asset, label, share }: { asset: ImageSourcePropType; label: string; share: number }) {
  return (
    <View style={styles.productTile}>
      <View style={styles.productIconWrap}><Image source={asset} style={styles.productIcon} resizeMode="contain" /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.productLabel}>{label}</Text>
      <Text style={styles.productShare}>{share}%</Text>
    </View>
  );
}

function PayoutQuickAction({ payout, onPress }: { payout: PartnerPayoutSummary | null; onPress: () => void }) {
  if (!payout) {
    return <QuickAction asset={PartnerAssets.actions.payoutGrowth} label="Payout" meta="Unavailable" onPress={onPress} />;
  }

  if (!payout.available) {
    return <QuickAction asset={PartnerAssets.actions.payoutGrowth} label="Payout" meta="Restricted" onPress={onPress} />;
  }

  return (
    <QuickAction
      asset={PartnerAssets.actions.payoutGrowth}
      label="Payout"
      meta={`${payout.pending_count} pending`}
      onPress={onPress}
    />
  );
}

function QuickAction({ asset, label, meta, onPress }: { asset: ImageSourcePropType; label: string; meta: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}>
      <View style={styles.quickIconWrap}><Image source={asset} style={styles.quickIcon} resizeMode="contain" /></View>
      <Text numberOfLines={1} style={styles.quickLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.quickMeta}>{meta}</Text>
    </Pressable>
  );
}

function productAsset(label: string, index: number): ImageSourcePropType {
  const value = label.toLowerCase();
  if (value.includes('motor') || value.includes('package') || value.includes('third')) return PartnerAssets.products.motorInsurance;
  if (value.includes('health')) return PartnerAssets.products.healthInsurance;
  if (value.includes('life') || value.includes('family')) return PartnerAssets.products.familyInsurance;
  if (value.includes('travel') || value.includes('home') || value.includes('property')) return PartnerAssets.products.propertyTravelInsurance;
  return [
    PartnerAssets.products.commercialInsurance,
    PartnerAssets.products.motorInsurance,
    PartnerAssets.products.healthInsurance,
    PartnerAssets.products.familyInsurance,
    PartnerAssets.products.propertyTravelInsurance,
  ][index % 5];
}

function changeText(value: number, hasPrevious: boolean) {
  if (!hasPrevious) return 'New baseline';
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function formatCompactCurrency(value: number | string) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '₹0';
  if (Math.abs(amount) >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(amount % 10_000_000 === 0 ? 0 : 1)}Cr`;
  if (Math.abs(amount) >= 100_000) return `₹${(amount / 100_000).toFixed(amount % 100_000 === 0 ? 0 : 1)}L`;
  if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}k`;
  return formatIndianCurrency(amount);
}

function shortMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(year, month - 1, 1));
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCacheTime(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  heroBanner: {
    minHeight: 114,
    marginHorizontal: -16,
    marginTop: -14,
    overflow: 'hidden',
    backgroundColor: '#0B4A9E',
  },
  heroCopy: { position: 'absolute', zIndex: 3, left: 16, top: 10 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 23, fontWeight: '800' },
  heroSubtitle: { marginTop: 1, color: '#D8E8FF', fontSize: 9, lineHeight: 12, fontWeight: '500' },
  heroName: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  heroImage: { position: 'absolute', right: 39, bottom: 0, width: 174, height: 114, opacity: 0.96 },
  heroWords: { position: 'absolute', zIndex: 3, right: 8, top: 15, width: 38 },
  heroWord: { color: '#EAF3FF', fontSize: 6.2, lineHeight: 8.5, fontWeight: '800' },
  searchRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchBox: { flex: 1, minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 7, paddingHorizontal: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E4F3' },
  searchText: { flex: 1, color: '#8190A5', fontSize: 8.5, lineHeight: 12, fontWeight: '500' },
  filterButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E4F3' },
  filterText: { color: '#3156B8', fontSize: 9, fontWeight: '700' },
  feedback: { marginTop: 7 },
  sectionHeader: { minHeight: 29, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: '#14367B', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  periodButton: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 5 },
  periodText: { color: '#3156B8', fontSize: 8, lineHeight: 11, fontWeight: '700' },
  smallSelect: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 3, backgroundColor: '#F6F8FC' },
  smallSelectText: { color: '#3156B8', fontSize: 6.8, lineHeight: 9, fontWeight: '700' },
  viewAll: { color: '#3156B8', fontSize: 7.2, lineHeight: 10, fontWeight: '700' },
  rangeWrap: { marginBottom: 5 },
  overviewGrid: { flexDirection: 'row', gap: 4 },
  overviewCard: { flex: 1, minHeight: 94, alignItems: 'center', borderRadius: 8, paddingHorizontal: 3, paddingVertical: 7, backgroundColor: '#F7FAFF', borderWidth: 1, borderColor: '#E2EAF5' },
  overviewIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#E7F0FF' },
  overviewValue: { width: '100%', marginTop: 4, color: '#112C69', textAlign: 'center', fontSize: 12.5, lineHeight: 15, fontWeight: '800' },
  overviewLabel: { minHeight: 18, marginTop: 2, color: '#53647C', textAlign: 'center', fontSize: 6.9, lineHeight: 9, fontWeight: '600' },
  growthRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 1 },
  growthText: { maxWidth: 58, color: '#16A34A', fontSize: 6.5, lineHeight: 8, fontWeight: '800' },
  vsText: { marginTop: 1, color: '#9AA7B8', fontSize: 5.7, lineHeight: 7 },
  chartCard: { minHeight: 128, flexDirection: 'row', borderRadius: 9, padding: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6F1' },
  chartYAxis: { width: 15, height: 96, justifyContent: 'space-between', paddingVertical: 4 },
  axisText: { color: '#8795A9', fontSize: 5.8, lineHeight: 7 },
  chart: { flex: 1, height: 108, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { width: '100%', height: 12, color: '#3156B8', textAlign: 'center', fontSize: 6, lineHeight: 8, fontWeight: '700' },
  barTrack: { height: 74, width: '72%', justifyContent: 'flex-end', overflow: 'hidden', borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#EEF3FA' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#2298E8' },
  barMonth: { marginTop: 4, color: '#53647C', fontSize: 6.6, lineHeight: 9, fontWeight: '600' },
  productGrid: { flexDirection: 'row', gap: 4, borderRadius: 9, padding: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6F1' },
  productTile: { flex: 1, minWidth: 0, alignItems: 'center', borderRadius: 7, paddingVertical: 6, backgroundColor: '#F7FAFF' },
  productIconWrap: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center' },
  productIcon: { width: 26, height: 26 },
  productLabel: { width: '94%', marginTop: 2, color: '#14367B', textAlign: 'center', fontSize: 6.2, lineHeight: 8, fontWeight: '700' },
  productShare: { marginTop: 1, color: '#3156B8', fontSize: 6.1, lineHeight: 8, fontWeight: '800' },
  emptyCompact: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  emptyCompactText: { color: '#8795A9', fontSize: 8, lineHeight: 11 },
  insurerCard: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, padding: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6F1' },
  insurerEmptyIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#F1F6FF' },
  insurerEmptyBody: { flex: 1 },
  insurerEmptyTitle: { color: '#14367B', fontSize: 8.5, lineHeight: 11, fontWeight: '800' },
  insurerEmptyText: { marginTop: 2, color: '#8795A9', fontSize: 6.6, lineHeight: 9 },
  quickGrid: { flexDirection: 'row', gap: 4, borderRadius: 9, padding: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6F1' },
  quickTile: { flex: 1, minWidth: 0, alignItems: 'center', borderRadius: 7, paddingVertical: 6, backgroundColor: '#F7FAFF' },
  quickIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  quickIcon: { width: 27, height: 27 },
  quickLabel: { marginTop: 2, color: '#14367B', textAlign: 'center', fontSize: 6.6, lineHeight: 9, fontWeight: '800' },
  quickMeta: { marginTop: 1, color: '#718198', textAlign: 'center', fontSize: 5.8, lineHeight: 8 },
  networkGrid: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  networkTile: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6F1' },
  networkIcon: { width: 30, height: 30 },
  networkBody: { flex: 1, minWidth: 0 },
  networkValue: { color: '#14367B', fontSize: 13, lineHeight: 15, fontWeight: '800' },
  networkLabel: { marginTop: 1, color: '#53647C', fontSize: 6.7, lineHeight: 9, fontWeight: '700' },
  networkMeta: { marginTop: 1, color: '#8795A9', fontSize: 5.6, lineHeight: 7 },
  pressed: { opacity: 0.75 },
});
