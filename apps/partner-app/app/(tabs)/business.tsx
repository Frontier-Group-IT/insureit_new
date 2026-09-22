import { useCallback, useMemo, useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerBusinessRangeSummaryCard } from '@/components/partner-business-range-summary';
import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { getPartnerClaimSummary, type PartnerClaimSummary } from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';
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
  const { context, cacheScopeKey } = usePartnerSession();
  const [showRange, setShowRange] = useState(false);

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
  const profileInitials = initials(context?.identity.display_name ?? 'Partner');

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
            <Image
              source={require('../../assets/partner/banners/business-growth-11.png')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroTopRow}>
              <View style={styles.heroBrand}>
                <Image
                  source={require('../../assets/insureit-partner-official.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
                <View style={styles.heroBrandCopy} accessibilityLabel="insureit Partner">
                  <Text style={styles.heroBrandInsureit}>insureit</Text>
                  <Text style={styles.heroBrandPartner}>Partner</Text>
                </View>
              </View>
              <View style={styles.heroActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                  onPress={() => router.push('/(tabs)/more')}
                  style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
                >
                  <Feather name="bell" size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile"
                  onPress={() => router.push('/profile')}
                  style={({ pressed }) => [styles.heroAvatar, pressed && styles.pressed]}
                >
                  <Text style={styles.heroAvatarText}>{profileInitials}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Business</Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/search')} style={({ pressed }) => [styles.searchBox, pressed && styles.pressed]}>
              <Ionicons name="search-outline" size={21} color="#3156B8" />
              <Text numberOfLines={1} style={styles.searchText}>Search customer, vehicle number or policy number...</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setShowRange((value) => !value)} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <Ionicons name="filter-outline" size={18} color="#3156B8" />
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
                <Text style={styles.periodText}>{showRange ? 'Custom' : 'This Month'}</Text>
                <Ionicons name="chevron-down" size={12} color="#3156B8" />
              </Pressable>
            )}
          />

          {showRange ? (
            <View style={styles.rangeWrap}>
              <PartnerBusinessRangeSummaryCard />
            </View>
          ) : null}

          <View style={styles.overviewGrid}>
            <OverviewCard
              icon="cash-outline"
              value={formatCompactCurrency(performance.premium_this_month)}
              label="Premium Generated"
              changeLabel={changeText(Number(performance.premium_change_percent || 0), Number(performance.premium_last_month || 0) > 0)}
            />
            <OverviewCard
              icon="document-text-outline"
              value={String(performance.policies_this_month)}
              label="Policies Sold"
              changeLabel={policiesChange === null ? 'Current month' : changeText(policiesChange, true)}
            />
            <OverviewCard
              icon="wallet-outline"
              value={payout?.available ? formatCompactCurrency(payout.paid_amount) : '—'}
              label="Commission Earned"
              changeLabel={payout?.available ? `${payout.paid_count} paid` : 'Restricted'}
            />
            <OverviewCard
              icon="people-outline"
              value={String(performance.total_customers)}
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
          const height = Math.max(4, Math.round((premium / max) * 96));
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

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function formatCacheTime(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  heroBanner: {
    height: 158,
    marginHorizontal: -16,
    marginTop: -14,
    overflow: 'hidden',
    backgroundColor: '#0755A8',
  },
  heroImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  heroTopRow: {
    position: 'absolute',
    zIndex: 3,
    top: 30,
    left: 15,
    right: 15,
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '60%',
  },
  heroLogo: {
    width: 30,
    height: 35,
    tintColor: '#FFFFFF',
  },
  heroBrandCopy: {
    justifyContent: 'center',
  },
  heroBrandInsureit: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.08,
  },
  heroBrandPartner: {
    color: '#F5AB2E',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: -0.08,
  },
  heroActions: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroIconButton: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,33,78,0.72)',
    borderWidth: 1.25,
    borderColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#001B42',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroAvatar: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#001B42',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroAvatarText: {
    color: '#144E98',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '800',
  },
  heroCopy: {
    position: 'absolute',
    zIndex: 3,
    left: 18,
    bottom: 24,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  searchRow: {
    zIndex: 5,
    marginTop: -10,
    marginHorizontal: 0,
    marginBottom: 10,
    height: 49,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DFEA',
    shadowColor: '#102449',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: 'hidden',
  },
  searchBox: {
    flex: 1,
    height: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
  },
  searchText: {
    flex: 1,
    color: '#8B95A8',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  filterButton: {
    height: 49,
    minWidth: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#D9DFEA',
  },
  filterText: {
    color: '#3156B8',
    ...partnerTheme.typography.caption,
    fontWeight: '700',
  },

  feedback: { marginBottom: 8 },
  sectionHeader: {
    minHeight: 32,
    marginTop: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    color: partnerTheme.colors.inkMuted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  periodButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  periodText: {
    color: '#3156B8',
    ...partnerTheme.typography.caption,
    fontWeight: '700',
  },
  smallSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#F6F8FC',
  },
  smallSelectText: {
    color: '#3156B8',
    ...partnerTheme.typography.meta,
    fontWeight: '700',
  },
  viewAll: {
    color: '#3156B8',
    ...partnerTheme.typography.caption,
    fontWeight: '700',
  },
  rangeWrap: { marginBottom: 8 },

  overviewGrid: {
    flexDirection: 'row',
    gap: 5,
    borderRadius: 16,
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6F1',
    ...partnerTheme.shadowSoft,
  },
  overviewCard: {
    flex: 1,
    minHeight: 126,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    backgroundColor: '#F5F9FF',
  },
  overviewIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#E7F0FF',
  },
  overviewValue: {
    width: '100%',
    marginTop: 7,
    color: '#112C69',
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  overviewLabel: {
    minHeight: 30,
    marginTop: 2,
    color: partnerTheme.colors.inkMuted,
    textAlign: 'center',
    ...partnerTheme.typography.caption,
  },
  growthRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  growthText: {
    maxWidth: 72,
    color: '#16A34A',
    ...partnerTheme.typography.meta,
    fontWeight: '800',
  },
  vsText: {
    marginTop: 1,
    color: '#9AA7B8',
    ...partnerTheme.typography.meta,
    fontWeight: '500',
  },

  chartCard: {
    minHeight: 168,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6F1',
    ...partnerTheme.shadowSoft,
  },
  chartYAxis: {
    width: 24,
    height: 128,
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  axisText: {
    color: '#8795A9',
    ...partnerTheme.typography.meta,
  },
  chart: {
    flex: 1,
    height: 142,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barValue: {
    width: '100%',
    minHeight: 16,
    color: '#3156B8',
    textAlign: 'center',
    ...partnerTheme.typography.meta,
    fontWeight: '700',
  },
  barTrack: {
    height: 102,
    width: '78%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: '#EEF3FA',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    backgroundColor: '#2298E8',
  },
  barMonth: {
    marginTop: 5,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.meta,
  },

  productGrid: {
    flexDirection: 'row',
    gap: 5,
    borderRadius: 16,
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6F1',
    ...partnerTheme.shadowSoft,
  },
  productTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 8,
    backgroundColor: '#F5F9FF',
  },
  productIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIcon: { width: 36, height: 36 },
  productLabel: {
    width: '94%',
    marginTop: 3,
    color: '#14367B',
    textAlign: 'center',
    ...partnerTheme.typography.meta,
    fontWeight: '700',
  },
  productShare: {
    marginTop: 1,
    color: '#3156B8',
    ...partnerTheme.typography.meta,
    fontWeight: '800',
  },
  emptyCompact: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCompactText: {
    color: '#8795A9',
    ...partnerTheme.typography.caption,
  },

  insurerCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6F1',
    ...partnerTheme.shadowSoft,
  },
  insurerEmptyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#F1F6FF',
  },
  insurerEmptyBody: { flex: 1 },
  insurerEmptyTitle: {
    color: '#14367B',
    ...partnerTheme.typography.cardTitle,
  },
  insurerEmptyText: {
    marginTop: 2,
    color: '#8795A9',
    ...partnerTheme.typography.caption,
  },

  quickGrid: {
    flexDirection: 'row',
    gap: 5,
    borderRadius: 16,
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6F1',
    ...partnerTheme.shadowSoft,
  },
  quickTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingVertical: 8,
    backgroundColor: '#F5F9FF',
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: { width: 36, height: 36 },
  quickLabel: {
    marginTop: 3,
    color: '#14367B',
    textAlign: 'center',
    ...partnerTheme.typography.meta,
    fontWeight: '800',
  },
  quickMeta: {
    marginTop: 1,
    color: '#718198',
    textAlign: 'center',
    ...partnerTheme.typography.meta,
    fontWeight: '500',
  },

  networkGrid: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 8,
  },
  networkTile: {
    flex: 1,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE6F1',
    ...partnerTheme.shadowSoft,
  },
  networkIcon: { width: 38, height: 38 },
  networkBody: { flex: 1, minWidth: 0 },
  networkValue: {
    color: '#14367B',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  networkLabel: {
    marginTop: 1,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
    fontWeight: '700',
  },
  networkMeta: {
    marginTop: 1,
    color: '#8795A9',
    ...partnerTheme.typography.meta,
  },
  pressed: { opacity: 0.75 },
});
