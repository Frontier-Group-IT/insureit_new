import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Image, type ImageSourcePropType, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { PartnerBusinessRangeSummaryCard } from '@/components/partner-business-range-summary';
import { PartnerScreen } from '@/components/partner-screen';
import { PartnerAnchoredDropdown } from '@/components/ui/partner-anchored-dropdown';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { getPartnerClaimSummary, type PartnerClaimSummary } from '@/lib/claims';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerBusinessRange, type PartnerBusinessRangeSummary } from '@/lib/home';
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
  compareLabel?: string;
  onPress?: () => void;
};

type OverviewRange = 'mtd' | 'last_month' | 'last_6_months' | 'custom';
type TrendRange = 'mtd' | 'last_month' | 'last_6_months' | 'custom';
type TrendPoint = { month: string; premium: number | string; policies: number };

const OVERVIEW_OPTIONS: Array<{ value: OverviewRange; label: string }> = [
  { value: 'mtd', label: 'MTD' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'custom', label: 'Custom' },
];

const TREND_OPTIONS: Array<{ value: TrendRange; label: string }> = [
  { value: 'mtd', label: 'MTD' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'custom', label: 'Custom' },
];

export default function BusinessScreen() {
  const router = useRouter();
  const { context, cacheScopeKey } = usePartnerSession();
  const [overviewRange, setOverviewRange] = useState<OverviewRange>('mtd');
  const [overviewMenuOpen, setOverviewMenuOpen] = useState(false);
  const [overviewPreset, setOverviewPreset] = useState<PartnerBusinessRangeSummary | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [trendRange, setTrendRange] = useState<TrendRange>('last_6_months');
  const [trendMenuOpen, setTrendMenuOpen] = useState(false);
  const [trendPreset, setTrendPreset] = useState<PartnerBusinessRangeSummary | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

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
      icon: productIcon(item.label, index),
    }));
  }, [performance]);

  const selectOverviewRange = useCallback(async (next: OverviewRange) => {
    setOverviewRange(next);
    setOverviewMenuOpen(false);
    setOverviewError(null);
    setOverviewPreset(null);
    if (next === 'mtd' || next === 'custom') return;
    const range = presetDateRange(next);
    setOverviewLoading(true);
    try {
      setOverviewPreset(await getPartnerBusinessRange(range.from, range.to));
    } catch (reason) {
      setOverviewError(reason instanceof Error ? reason.message : 'Business overview could not be loaded for this range.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const selectTrendRange = useCallback(async (next: TrendRange) => {
    setTrendRange(next);
    setTrendMenuOpen(false);
    setTrendError(null);
    setTrendPreset(null);
    if (next === 'last_6_months' || next === 'custom') return;
    const range = presetDateRange(next);
    setTrendLoading(true);
    try {
      setTrendPreset(await getPartnerBusinessRange(range.from, range.to));
    } catch (reason) {
      setTrendError(reason instanceof Error ? reason.message : 'Trend data could not be loaded for this range.');
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const overview = overviewRange === 'mtd' || !overviewPreset
    ? null
    : overviewPreset;

  const overviewChangeLabel = overview
    ? changeText(Number(overview.premium_change_percent || 0), Number(overview.premium_previous_period || 0) > 0)
    : performance
      ? changeText(Number(performance.premium_change_percent || 0), Number(performance.premium_last_month || 0) > 0)
      : '—';

  const trendData: TrendPoint[] = useMemo(() => {
    if (!performance) return [];
    if (trendRange === 'last_6_months') return performance.trend.slice(-6);
    if (trendPreset) {
      return [{
        month: trendRange === 'mtd' ? 'MTD' : trendRange === 'last_month' ? 'LAST' : 'CUSTOM',
        premium: trendPreset.premium,
        policies: trendPreset.policies,
      }];
    }
    return [];
  }, [performance, trendPreset, trendRange]);

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
            <Image source={require('../../assets/partner/banners/business-growth-11.png')} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroTopRow}>
              <View style={styles.heroBrand}>
                <Image source={require('../../assets/insureit-partner-official.png')} style={styles.heroLogo} resizeMode="contain" />
                <View style={styles.heroBrandCopy} accessibilityLabel="insureit Partner">
                  <Text style={styles.heroBrandInsureit}>insureit</Text>
                  <Text style={styles.heroBrandPartner}>Partner</Text>
                </View>
              </View>
              <View style={styles.heroActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/(tabs)/more')} style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}>
                  <Feather name="bell" size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/profile')} style={({ pressed }) => [styles.heroAvatar, pressed && styles.pressed]}>
                  <Text style={styles.heroAvatarText}>{profileInitials}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.heroCopy}><Text style={styles.heroTitle}>Business</Text></View>
          </View>

          <View style={styles.searchRow}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/search')} style={({ pressed }) => [styles.searchBox, pressed && styles.pressed]}>
              <Ionicons name="search-outline" size={21} color="#3156B8" />
              <Text numberOfLines={1} style={styles.searchText}>Search customer, vehicle number or policy number...</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open business custom range" onPress={() => void selectOverviewRange('custom')} style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
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

          <View style={styles.selectorAnchor}>
            <SectionHeader
              title="Business Overview"
              action={(
                <PartnerAnchoredDropdown
                  visible={overviewMenuOpen}
                  onDismiss={() => setOverviewMenuOpen(false)}
                  align="right"
                  menuWidth={154}
                  menu={<DropdownMenu options={OVERVIEW_OPTIONS} selected={overviewRange} onSelect={(value) => void selectOverviewRange(value)} />}
                >
                  <Pressable accessibilityRole="button" accessibilityLabel="Choose business overview period" accessibilityState={{ expanded: overviewMenuOpen }} onPress={() => setOverviewMenuOpen((value) => !value)} style={styles.periodButton}>
                    <Text style={styles.periodText}>{optionLabel(OVERVIEW_OPTIONS, overviewRange)}</Text>
                    <Ionicons name={overviewMenuOpen ? 'chevron-up' : 'chevron-down'} size={12} color="#3156B8" />
                  </Pressable>
                </PartnerAnchoredDropdown>
              )}
            />
          </View>

          {overviewRange === 'custom' ? (
            <View style={styles.rangeWrap}>
              <PartnerBusinessRangeSummaryCard onApplied={setOverviewPreset} />
            </View>
          ) : null}
          {overviewLoading ? <Text style={styles.inlineLoading}>Loading selected range…</Text> : null}
          {overviewError ? <View style={styles.feedback}><PartnerBanner tone="warning" message={overviewError} /></View> : null}

          <View style={styles.overviewGrid}>
            <OverviewCard
              icon="cash-outline"
              value={formatCompactCurrency(overview?.premium ?? performance.premium_this_month)}
              label="Premium Generated"
              changeLabel={overviewChangeLabel}
              compareLabel={overview ? 'vs previous period' : 'vs last month'}
              onPress={() => router.push('/business-report')}
            />
            <OverviewCard
              icon="document-text-outline"
              value={String(overview?.policies ?? performance.policies_this_month)}
              label="Policies Sold"
              changeLabel={overview ? `${overview.policies} in range` : policiesChange === null ? 'Current month' : changeText(policiesChange, true)}
              compareLabel={overview ? optionLabel(OVERVIEW_OPTIONS, overviewRange) : 'vs last month'}
              onPress={() => router.push('/(tabs)/policies')}
            />
            <OverviewCard
              icon="wallet-outline"
              value={overview?.commission_available
                ? formatCompactCurrency(overview.commission_earned ?? 0)
                : overview
                  ? '—'
                  : payout?.available ? formatCompactCurrency(payout.paid_amount) : '—'}
              label="Commission Earned"
              changeLabel={overview ? (overview.commission_available ? 'Selected range' : 'Restricted') : payout?.available ? `${payout.paid_count} paid` : 'Restricted'}
              compareLabel={overview ? optionLabel(OVERVIEW_OPTIONS, overviewRange) : 'vs last month'}
              onPress={() => router.push('/business-report')}
            />
            <OverviewCard
              icon="people-outline"
              value={String(overview?.customers ?? performance.total_customers)}
              label="Customers"
              changeLabel={overview ? 'Selected range' : 'Current portfolio'}
              compareLabel={overview ? optionLabel(OVERVIEW_OPTIONS, overviewRange) : 'vs last month'}
              onPress={() => router.push('/customers')}
            />
          </View>

          <View style={styles.selectorAnchor}>
            <SectionHeader
              title="Month-wise Trend"
              action={(
                <View style={styles.sectionActions}>
                  <PartnerAnchoredDropdown
                    visible={trendMenuOpen}
                    onDismiss={() => setTrendMenuOpen(false)}
                    align="right"
                    menuWidth={154}
                    menu={<DropdownMenu options={TREND_OPTIONS} selected={trendRange} onSelect={(value) => void selectTrendRange(value)} />}
                  >
                    <Pressable accessibilityRole="button" accessibilityLabel="Choose month trend period" accessibilityState={{ expanded: trendMenuOpen }} onPress={() => setTrendMenuOpen((value) => !value)} style={styles.smallSelect}>
                      <Text style={styles.smallSelectText}>{optionLabel(TREND_OPTIONS, trendRange)}</Text>
                      <Ionicons name={trendMenuOpen ? 'chevron-up' : 'chevron-down'} size={10} color="#3156B8" />
                    </Pressable>
                  </PartnerAnchoredDropdown>
                  <Pressable accessibilityRole="button" accessibilityLabel="Open business report" onPress={() => router.push('/business-report')} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                    <Text style={styles.viewAll}>View Report</Text>
                    <Ionicons name="chevron-forward" size={10} color="#3156B8" />
                  </Pressable>
                </View>
              )}
            />
          </View>

          {trendRange === 'custom' ? (
            <View style={styles.rangeWrap}>
              <PartnerBusinessRangeSummaryCard
                title="Custom trend range"
                meta="Choose a date range for the trend total"
                onApplied={setTrendPreset}
              />
            </View>
          ) : null}
          {trendLoading ? <Text style={styles.inlineLoading}>Loading selected trend…</Text> : null}
          {trendError ? <View style={styles.feedback}><PartnerBanner tone="warning" message={trendError} /></View> : null}
          <TrendChart data={trendData} emptyMessage={trendRange === 'custom' ? 'Apply a custom range to view its premium total.' : undefined} />

          <SectionHeader
            title="Business by Product"
            action={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all business products"
                onPress={() => router.push('/business-report')}
                style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}
              >
                <Text style={styles.viewAll}>View All</Text>
                <Ionicons name="chevron-forward" size={10} color="#3156B8" />
              </Pressable>
            )}
          />
          <View style={styles.productGrid}>
            {productMix.length ? productMix.map((item) => (
              <ProductTile key={item.label} icon={item.icon} label={humanize(item.label)} share={item.share} />
            )) : (
              <View style={styles.emptyCompact}><Text style={styles.emptyCompactText}>No product mix recorded this month.</Text></View>
            )}
          </View>

          <SectionHeader title="Top Insurers" action={<Text style={styles.viewAll}>View All ›</Text>} />
          <View style={styles.insurerCard}>
            <View style={styles.insurerEmptyIcon}><Ionicons name="business-outline" size={18} color="#3156B8" /></View>
            <View style={styles.insurerEmptyBody}>
              <Text style={styles.insurerEmptyTitle}>Insurer mix</Text>
              <Text style={styles.insurerEmptyText}>Insurer-wise totals are not included in the current Business data.</Text>
            </View>
          </View>

          <SectionHeader title="Quick Actions" />
          <View style={styles.quickGrid}>
            <QuickAction asset={PartnerAssets.actions.quickRenewals} label="Renewals" meta={`${renewals?.due_30_count ?? 0} due`} onPress={() => router.push('/renewals')} />
            <QuickAction asset={PartnerAssets.actions.quickClaims} label="Claims" meta={`${claims?.active_claims ?? 0} active`} onPress={() => router.push('/(tabs)/claims')} />
            <PayoutQuickAction payout={payout} onPress={() => router.push('/(tabs)/more')} />
            <QuickAction asset={PartnerAssets.actions.quickCustomers} label="Add Customer" meta="Create new" onPress={() => router.push('/customers')} />
          </View>

          <SectionHeader title="My Network" action={<Pressable onPress={() => router.push('/network')}><Text style={styles.viewAll}>View All ›</Text></Pressable>} />
          <View style={styles.networkGrid}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/network')} style={({ pressed }) => [styles.networkTile, pressed && styles.pressed]}>
              <BlueIcon icon="people" badge="+" size={38} />
              <View style={styles.networkBody}>
                <Text style={styles.networkValue}>{network.total_partners}</Text>
                <Text style={styles.networkLabel}>Partner Family</Text>
                <Text style={styles.networkMeta}>{network.total_groups} active group{network.total_groups === 1 ? '' : 's'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#3156B8" />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/customers')} style={({ pressed }) => [styles.networkTile, pressed && styles.pressed]}>
              <Image source={PartnerAssets.actions.quickCustomers} style={styles.networkIcon} resizeMode="contain" />
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

function DropdownMenu<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.dropdownMenu}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.dropdownOption, active && styles.dropdownOptionActive, pressed && styles.pressed]}
          >
            <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>{option.label}</Text>
            {active ? <Ionicons name="checkmark" size={14} color="#3156B8" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

function OverviewCard({ icon, value, label, changeLabel, compareLabel = 'vs last month', onPress }: OverviewCardProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Open ${label}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.overviewCard, pressed && onPress ? styles.pressed : null]}
    >
      <View style={styles.overviewIcon}><Ionicons name={icon} size={17} color="#1951AE" /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.overviewValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.overviewLabel}>{label}</Text>
      <View style={styles.growthRow}>
        <Ionicons name="trending-up" size={9} color="#16A34A" />
        <Text numberOfLines={1} style={styles.growthText}>{changeLabel}</Text>
      </View>
      <Text numberOfLines={1} style={styles.vsText}>{compareLabel}</Text>
    </Pressable>
  );
}

function TrendChart({ data, emptyMessage }: { data: TrendPoint[]; emptyMessage?: string }) {
  if (!data.length) {
    return <View style={styles.chartEmpty}><Text style={styles.emptyCompactText}>{emptyMessage || 'No trend data available.'}</Text></View>;
  }
  const max = Math.max(1, ...data.map((item) => Number(item.premium || 0)));
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartYAxis}>
        <Text style={styles.axisText}>High</Text>
        <Text style={styles.axisText}>Mid</Text>
        <Text style={styles.axisText}>Low</Text>
        <Text style={styles.axisText}>0</Text>
      </View>
      <View style={styles.chart}>
        {data.slice(-6).map((item, index) => {
          const premium = Number(item.premium || 0);
          const height = Math.max(4, Math.round((premium / max) * 96));
          const label = item.month === 'MTD' ? 'MTD' : item.month === 'LAST' ? 'Last' : item.month === 'CUSTOM' ? 'Custom' : shortMonth(item.month);
          return (
            <View key={`${item.month}-${index}`} style={styles.barColumn}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.barValue}>{formatCompactCurrency(premium)}</Text>
              <View style={styles.barTrack}><View style={[styles.bar, { height }]} /></View>
              <Text style={styles.barMonth}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ProductTile({ icon, label, share }: { icon: keyof typeof Ionicons.glyphMap; label: string; share: number }) {
  return (
    <View style={styles.productTile}>
      <BlueIcon icon={icon} size={40} />
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.productLabel}>{label}</Text>
      <Text style={styles.productShare}>{share}%</Text>
    </View>
  );
}

function PayoutQuickAction({ payout, onPress }: { payout: PartnerPayoutSummary | null; onPress: () => void }) {
  const meta = !payout ? 'Unavailable' : !payout.available ? 'Restricted' : `${payout.pending_count} pending`;
  return <QuickAction icon="wallet" iconBadge="₹" label="Payout" meta={meta} onPress={onPress} />;
}

function QuickAction({
  asset,
  icon,
  iconBadge,
  label,
  meta,
  onPress,
}: {
  asset?: ImageSourcePropType;
  icon?: keyof typeof Ionicons.glyphMap;
  iconBadge?: string;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}>
      <View style={styles.quickIconWrap}>
        {asset ? <Image source={asset} style={styles.quickIcon} resizeMode="contain" /> : icon ? <BlueIcon icon={icon} badge={iconBadge} size={40} /> : null}
      </View>
      <Text numberOfLines={1} style={styles.quickLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.quickMeta}>{meta}</Text>
    </Pressable>
  );
}

function BlueIcon({ icon, badge, size = 40 }: { icon: keyof typeof Ionicons.glyphMap; badge?: string; size?: number }) {
  return (
    <View style={[styles.generatedIcon, { width: size, height: size, borderRadius: Math.round(size * 0.28) }]}>
      <View style={styles.generatedIconGlow} />
      <Ionicons name={icon} size={Math.round(size * 0.58)} color="#0878E8" />
      {badge ? (
        <View style={styles.generatedIconBadge}>
          <Text style={styles.generatedIconBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

function productIcon(label: string, index: number): keyof typeof Ionicons.glyphMap {
  const value = label.toLowerCase();
  if (value.includes('third')) return 'shield-checkmark';
  if (value.includes('motor') || value.includes('package')) return 'car-sport';
  if (value.includes('health')) return 'medkit';
  if (value.includes('life') || value.includes('family')) return 'people';
  if (value.includes('travel')) return 'airplane';
  if (value.includes('home') || value.includes('property')) return 'home';
  return ['document-text', 'shield-checkmark', 'briefcase', 'layers'][index % 4] as keyof typeof Ionicons.glyphMap;
}

function presetDateRange(value: OverviewRange | TrendRange) {
  const today = startOfDay(new Date());
  if (value === 'mtd') return { from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIsoDate(today) };
  if (value === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }
  const from = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  return { from: toIsoDate(from), to: toIsoDate(today) };
}

function startOfDay(value: Date) { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
function toIsoDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function optionLabel<T extends string>(options: Array<{ value: T; label: string }>, value: T) { return options.find((option) => option.value === value)?.label ?? value; }
function changeText(value: number, hasPrevious: boolean) { if (!hasPrevious) return 'New baseline'; const sign = value >= 0 ? '+' : '-'; return `${sign}${Math.abs(value).toFixed(0)}%`; }
function formatCompactCurrency(value: number | string) { const amount = Number(value || 0); if (!Number.isFinite(amount)) return '₹0'; if (Math.abs(amount) >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(amount % 10_000_000 === 0 ? 0 : 1)}Cr`; if (Math.abs(amount) >= 100_000) return `₹${(amount / 100_000).toFixed(amount % 100_000 === 0 ? 0 : 1)}L`; if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}k`; return formatIndianCurrency(amount); }
function shortMonth(value: string) { const [year, month] = value.split('-').map(Number); return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(year, month - 1, 1)); }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP'; }
function formatCacheTime(value: number | null) { if (!value) return 'earlier'; return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

const styles = StyleSheet.create({
  heroBanner: { height: 158, marginHorizontal: -16, marginTop: -14, overflow: 'hidden', backgroundColor: '#0755A8' },
  heroImage: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0.5 },
  heroTopRow: { position: 'absolute', zIndex: 3, top: 30, left: 15, right: 15, minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '60%' },
  heroLogo: { width: 30, height: 35, tintColor: '#FFFFFF' },
  heroBrandCopy: { justifyContent: 'center' },
  heroBrandInsureit: { color: '#FFFFFF', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  heroBrandPartner: { color: '#F5AB2E', fontSize: 14, lineHeight: 16, fontWeight: '800' },
  heroActions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroIconButton: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(4,33,78,0.72)', borderWidth: 1.25, borderColor: '#FFFFFF' },
  heroAvatar: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  heroAvatarText: { color: '#144E98', fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  heroCopy: { position: 'absolute', zIndex: 3, left: 18, bottom: 24 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 23, fontWeight: '800', letterSpacing: -0.2 },
  searchRow: { zIndex: 5, marginTop: -10, marginBottom: 10, height: 49, flexDirection: 'row', alignItems: 'stretch', borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9DFEA', overflow: 'hidden' },
  searchBox: { flex: 1, height: 49, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, backgroundColor: '#FFFFFF' },
  searchText: { flex: 1, color: '#8B95A8', fontSize: 11.5, lineHeight: 16, fontWeight: '500' },
  filterButton: { height: 49, minWidth: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#D9DFEA' },
  filterText: { color: '#3156B8', ...partnerTheme.typography.caption, fontWeight: '700' },
  feedback: { marginBottom: 8 },
  selectorAnchor: { position: 'relative', zIndex: 20 },
  sectionHeader: { minHeight: 32, marginTop: 12, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: partnerTheme.colors.inkMuted, fontSize: 10, lineHeight: 14, fontWeight: '600', letterSpacing: 0.7 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  periodButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 },
  periodText: { color: '#3156B8', ...partnerTheme.typography.caption, fontWeight: '700' },
  smallSelect: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#F6F8FC' },
  smallSelectText: { color: '#3156B8', ...partnerTheme.typography.meta, fontWeight: '700' },
  reportButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 5 },
  viewAll: { color: '#3156B8', ...partnerTheme.typography.caption, fontWeight: '700' },
  dropdownMenu: { borderRadius: 12, paddingVertical: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6F1', shadowColor: '#102449', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  dropdownOption: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12 },
  dropdownOptionActive: { backgroundColor: '#F0F5FF' },
  dropdownOptionText: { color: '#506079', ...partnerTheme.typography.caption, fontWeight: '600' },
  dropdownOptionTextActive: { color: '#3156B8', fontWeight: '800' },
  rangeWrap: { marginBottom: 8 },
  inlineLoading: { marginBottom: 7, color: '#718198', ...partnerTheme.typography.caption },
  overviewGrid: { flexDirection: 'row', gap: 5, borderRadius: 16, padding: 6, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  overviewCard: { flex: 1, minHeight: 126, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 4, paddingVertical: 8, backgroundColor: '#F5F9FF' },
  overviewIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#E7F0FF' },
  overviewValue: { width: '100%', marginTop: 7, color: '#112C69', textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  overviewLabel: { minHeight: 30, marginTop: 2, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.caption },
  growthRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 2 },
  growthText: { maxWidth: 72, color: '#16A34A', ...partnerTheme.typography.meta, fontWeight: '800' },
  vsText: { marginTop: 1, maxWidth: 72, color: '#9AA7B8', textAlign: 'center', ...partnerTheme.typography.meta, fontWeight: '500' },
  chartCard: { minHeight: 168, flexDirection: 'row', borderRadius: 16, padding: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  chartEmpty: { minHeight: 120, alignItems: 'center', justifyContent: 'center', borderRadius: 16, padding: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1' },
  chartYAxis: { width: 30, height: 128, justifyContent: 'space-between', paddingVertical: 5 },
  axisText: { color: '#8795A9', ...partnerTheme.typography.meta },
  chart: { flex: 1, height: 142, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  barColumn: { flex: 1, maxWidth: 54, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { width: '100%', minHeight: 16, color: '#3156B8', textAlign: 'center', ...partnerTheme.typography.meta, fontWeight: '700' },
  barTrack: { height: 102, width: '78%', justifyContent: 'flex-end', overflow: 'hidden', borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: '#EEF3FA' },
  bar: { width: '100%', borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: '#2298E8' },
  barMonth: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  productGrid: { flexDirection: 'row', gap: 5, borderRadius: 16, padding: 6, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  productTile: { flex: 1, minWidth: 0, minHeight: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingVertical: 8, backgroundColor: '#F5F9FF' },
  productIconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  productLabel: { width: '94%', marginTop: 3, color: '#14367B', textAlign: 'center', ...partnerTheme.typography.meta, fontWeight: '700' },
  productShare: { marginTop: 1, color: '#3156B8', ...partnerTheme.typography.meta, fontWeight: '800' },
  emptyCompact: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  emptyCompactText: { color: '#8795A9', ...partnerTheme.typography.caption },
  insurerCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  insurerEmptyIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F1F6FF' },
  insurerEmptyBody: { flex: 1 },
  insurerEmptyTitle: { color: '#14367B', ...partnerTheme.typography.cardTitle },
  insurerEmptyText: { marginTop: 2, color: '#8795A9', ...partnerTheme.typography.caption },
  quickGrid: { flexDirection: 'row', gap: 5, borderRadius: 16, padding: 6, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  quickTile: { flex: 1, minWidth: 0, minHeight: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingVertical: 8, backgroundColor: '#F5F9FF' },
  quickIconWrap: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  quickIcon: { width: 36, height: 36 },
  generatedIcon: { overflow: 'hidden', position: 'relative', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D1E9FF', shadowColor: '#0A62B8', shadowOpacity: 0.14, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  generatedIconGlow: { position: 'absolute', width: '72%', height: '72%', right: -5, top: -5, borderRadius: 20, backgroundColor: 'rgba(56,176,255,0.22)' },
  generatedIconBadge: { position: 'absolute', right: 2, bottom: 2, minWidth: 14, height: 14, paddingHorizontal: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#075BC8', borderWidth: 1, borderColor: '#FFFFFF' },
  generatedIconBadgeText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '900' },
  quickLabel: { marginTop: 3, color: '#14367B', textAlign: 'center', ...partnerTheme.typography.meta, fontWeight: '800' },
  quickMeta: { marginTop: 1, color: '#718198', textAlign: 'center', ...partnerTheme.typography.meta, fontWeight: '500' },
  networkGrid: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  networkTile: { flex: 1, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE6F1', ...partnerTheme.shadowSoft },
  networkIcon: { width: 38, height: 38 },
  networkBody: { flex: 1, minWidth: 0 },
  networkValue: { color: '#14367B', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  networkLabel: { marginTop: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption, fontWeight: '700' },
  networkMeta: { marginTop: 1, color: '#8795A9', ...partnerTheme.typography.meta },
  pressed: { opacity: 0.75 },
});