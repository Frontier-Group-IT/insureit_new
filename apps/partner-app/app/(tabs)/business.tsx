import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatusBadge } from '@/components/ui/partner-status-badge';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { getPartnerClaimSummary, type PartnerClaimSummary } from '@/lib/claims';
import { getPartnerNetwork, type PartnerNetworkData } from '@/lib/network';
import { getPartnerPayoutSummary, type PartnerPayoutSummary } from '@/lib/payout';
import { getPartnerRenewalSummary, type PartnerRenewalSummary } from '@/lib/policies';
import { partnerTheme } from '@/lib/theme';

export default function BusinessScreen() {
  const router = useRouter();
  const [performance, setPerformance] = useState<PartnerBusinessPerformance | null>(null);
  const [network, setNetwork] = useState<PartnerNetworkData | null>(null);
  const [renewals, setRenewals] = useState<PartnerRenewalSummary | null>(null);
  const [claims, setClaims] = useState<PartnerClaimSummary | null>(null);
  const [payout, setPayout] = useState<PartnerPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError('');

    const [performanceResult, networkResult, renewalResult, claimResult, payoutResult] = await Promise.allSettled([
      getPartnerBusinessPerformance(),
      getPartnerNetwork(),
      getPartnerRenewalSummary(),
      getPartnerClaimSummary(),
      getPartnerPayoutSummary(),
    ]);

    if (performanceResult.status === 'fulfilled') setPerformance(performanceResult.value);
    if (networkResult.status === 'fulfilled') setNetwork(networkResult.value);
    if (renewalResult.status === 'fulfilled') setRenewals(renewalResult.value);
    if (claimResult.status === 'fulfilled') setClaims(claimResult.value);
    if (payoutResult.status === 'fulfilled') setPayout(payoutResult.value);

    if (performanceResult.status === 'rejected' || networkResult.status === 'rejected') {
      setError('Your business workspace could not be refreshed.');
    } else if (
      renewalResult.status === 'rejected'
      || claimResult.status === 'rejected'
      || payoutResult.status === 'rejected'
    ) {
      setError('Some secondary business information could not be refreshed.');
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void load(false);
  }, [load]));

  const topPartners = useMemo(() => {
    if (!network) return [];
    return [...network.partners]
      .sort((a, b) => Number(b.metrics.premium_this_month || 0) - Number(a.metrics.premium_this_month || 0))
      .slice(0, 3);
  }, [network]);

  return (
    <PartnerScreen
      eyebrow="MY BUSINESS"
      title="Performance & network"
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={partnerTheme.colors.brand}
            colors={[partnerTheme.colors.brand]}
          />
        ),
      }}
    >
      {loading && (!performance || !network) ? (
        <PartnerStateView state="loading" title="Loading business workspace" />
      ) : !performance || !network ? (
        <PartnerStateView
          state="error"
          title="Business workspace unavailable"
          message={error || 'Business data could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load(true)}
        />
      ) : (
        <>
          <View style={styles.freshnessRow}>
            <Text style={styles.scope}>{humanize(performance.scope_mode)} scope</Text>
            <Text style={styles.updated}>{formatUpdatedAt(performance.generated_at)}</Text>
          </View>

          {error ? (
            <View style={styles.feedback}>
              <PartnerBanner tone="warning" message={error} />
            </View>
          ) : null}

          <View style={styles.hero}>
            <View style={styles.heroHeader}>
              <View>
                <Text style={styles.heroEyebrow}>{monthLabel(performance.current_month).toUpperCase()}</Text>
                <Text style={styles.heroValue}>{formatMoney(performance.premium_this_month)}</Text>
                <Text style={styles.heroLabel}>gross premium</Text>
              </View>
              <TrendBadge
                value={Number(performance.premium_change_percent || 0)}
                hasPrevious={Number(performance.premium_last_month || 0) > 0}
              />
            </View>
            <View style={styles.heroStats}>
              <HeroStat value={performance.policies_this_month} label="Policies" />
              <HeroStat value={performance.total_customers} label="Customers" />
              <HeroStat value={network.total_partners} label={network.total_partners === 1 ? 'Partner family' : 'Partner families'} />
            </View>
          </View>

          <PartnerSectionHeader title="Business & service today" />
          <View style={styles.actionGrid}>
            <ActionStat
              icon="refresh-outline"
              value={renewals?.due_30_count ?? 0}
              label="Renewals in 30d"
              meta={formatMoney(renewals?.due_30_premium ?? 0)}
              onPress={() => router.push('/renewals')}
            />
            <ActionStat
              icon="shield-outline"
              value={claims?.active_claims ?? 0}
              label="Active claims"
              meta={claims?.assistance_requested ? `${claims.assistance_requested} assistance open` : 'Service queue'}
              onPress={() => router.push('/(tabs)/claims')}
            />
          </View>

          <PartnerSectionHeader title="Business trend" meta="Last 6 months" />
          <TrendChart data={performance.trend} />

          <PartnerSectionHeader title="Business mix" meta="Current month" />
          <View style={styles.mixCard}>
            {performance.business_mix.length ? (
              performance.business_mix.slice(0, 5).map((item) => (
                <MixRow
                  key={item.label}
                  label={item.label}
                  premium={Number(item.premium || 0)}
                  policies={item.policies}
                  totalPremium={Number(performance.premium_this_month || 0)}
                />
              ))
            ) : (
              <Text style={styles.noData}>No policy mix has been recorded this month.</Text>
            )}
          </View>

          <PartnerSectionHeader title="Payout" meta={payout?.available ? 'Your intermediary payout' : 'Restricted by account'} />
          <PayoutSection payout={payout} />

          <PartnerSectionHeader
            title="My network"
            action={
              <Pressable accessibilityRole="button" onPress={() => router.push('/network')} hitSlop={8}>
                <Text style={styles.sectionAction}>Explore network</Text>
              </Pressable>
            }
          />

          <Pressable accessibilityRole="button" onPress={() => router.push('/network')} style={({ pressed }) => [styles.networkCard, pressed && styles.pressed]}>
            <View style={styles.networkVisual}>
              <View style={styles.networkRoot}><Ionicons name="git-network-outline" size={21} color="#FFFFFF" /></View>
              <View style={styles.networkLine} />
              <View style={styles.networkNodes}>
                {Array.from({ length: Math.max(1, Math.min(network.total_partners, 4)) }).map((_, index) => <View key={index} style={styles.networkNode} />)}
              </View>
            </View>
            <View style={styles.networkCopy}>
              <Text style={styles.networkTitle}>{network.total_partners} Partner {network.total_partners === 1 ? 'family' : 'families'}</Text>
              <Text style={styles.networkText}>
                {network.total_groups > 0
                  ? `${network.total_groups} active Group${network.total_groups === 1 ? '' : 's'} · tap to explore Partner → POSP/MISP relationships.`
                  : 'Tap to explore Partner → POSP/MISP relationships and standalone Partner families.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
          </Pressable>

          {topPartners.length ? (
            <>
              <PartnerSectionHeader
                title={performance.scope_mode === 'partner_family' ? 'Partner family' : 'Top contribution'}
                meta="This month"
              />
              <View style={styles.contributionList}>
                {topPartners.map((row, index) => (
                  <View key={row.partner_id} style={styles.contributionRow}>
                    <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
                    <View style={styles.contributionBody}>
                      <Text style={styles.contributionName}>{row.partner_name}</Text>
                      <Text style={styles.contributionMeta}>
                        {row.metrics.policies_this_month} policies · {row.metrics.total_customers} customers
                        {row.child_count ? ` · ${row.child_count} POSP/MISP` : ' · standalone'}
                      </Text>
                    </View>
                    <Text style={styles.contributionValue}>{formatMoney(row.metrics.premium_this_month)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </PartnerScreen>
  );
}

function PayoutSection({ payout }: { payout: PartnerPayoutSummary | null }) {
  if (!payout) {
    return <PartnerBanner tone="info" message="Payout information is not available right now." />;
  }

  if (!payout.available) {
    return (
      <View style={styles.restrictedCard}>
        <View style={styles.restrictedIcon}><Ionicons name="lock-closed-outline" size={21} color={partnerTheme.colors.brand} /></View>
        <View style={styles.restrictedBody}>
          <Text style={styles.restrictedTitle}>Commercial payout details are restricted</Text>
          <Text style={styles.restrictedText}>{payout.reason} Internal pay-in and reconciliation calculations are not exposed here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.payoutGrid}>
        <PayoutMetric label="Eligible / pending" value={payout.eligible_amount} meta={`${payout.pending_count} pending records`} tone="warning" />
        <PayoutMetric label="Paid" value={payout.paid_amount} meta={`${payout.paid_count} paid records`} tone="success" />
      </View>

      {payout.needs_review_count > 0 ? (
        <View style={styles.payoutWarning}>
          <PartnerBanner
            tone="warning"
            message={`${payout.needs_review_count} payout record${payout.needs_review_count === 1 ? '' : 's'} need commercial review before they should be treated as final.`}
          />
        </View>
      ) : null}

      {payout.recent.length ? (
        <View style={styles.payoutRecent}>
          {payout.recent.slice(0, 5).map((row) => (
            <View key={row.id} style={styles.payoutRow}>
              <View style={styles.payoutBody}>
                <Text style={styles.payoutPolicy}>{row.policy_no}</Text>
                <Text style={styles.payoutCustomer}>{row.customer_name}</Text>
              </View>
              <View style={styles.payoutRight}>
                <Text style={styles.payoutAmount}>{formatMoney(row.amount)}</Text>
                <PartnerStatusBadge
                  label={humanize(row.status || row.commercial_status || 'Recorded')}
                  tone={String(row.status).toLowerCase() === 'paid' ? 'success' : String(row.commercial_status).toLowerCase() === 'needs_review' ? 'warning' : 'info'}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <PartnerBanner tone="info" message="No payout records are currently recorded for this intermediary." />
      )}
    </View>
  );
}

function PayoutMetric({ label, value, meta, tone }: {
  label: string;
  value: number | string;
  meta: string;
  tone: 'warning' | 'success';
}) {
  return (
    <View style={[styles.payoutMetric, tone === 'success' ? styles.payoutMetricSuccess : styles.payoutMetricWarning]}>
      <Text style={styles.payoutMetricLabel}>{label}</Text>
      <Text style={styles.payoutMetricValue}>{formatMoney(value)}</Text>
      <Text style={styles.payoutMetricMeta}>{meta}</Text>
    </View>
  );
}

function ActionStat({ icon, value, label, meta, onPress }: {
  icon: 'refresh-outline' | 'shield-outline';
  value: number;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionStat, pressed && styles.pressed]}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={20} color={partnerTheme.colors.brand} /></View>
      <View style={styles.actionBody}>
        <Text style={styles.actionValue}>{value}</Text>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionMeta}>{meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#9AA3B2" />
    </Pressable>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return <View style={styles.heroStat}><Text style={styles.heroStatValue}>{value}</Text><Text style={styles.heroStatLabel}>{label}</Text></View>;
}

function TrendBadge({ value, hasPrevious }: { value: number; hasPrevious: boolean }) {
  if (!hasPrevious) return <View style={styles.trendBadgeNeutral}><Text style={styles.trendBadgeNeutralText}>New baseline</Text></View>;
  const positive = value >= 0;
  return (
    <View style={[styles.trendBadge, positive ? styles.trendBadgeGood : styles.trendBadgeWarn]}>
      <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={13} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} />
      <Text style={[styles.trendBadgeText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {Math.abs(value).toFixed(1)}%
      </Text>
    </View>
  );
}

function TrendChart({ data }: { data: PartnerBusinessPerformance['trend'] }) {
  const max = Math.max(1, ...data.map((item) => Number(item.premium || 0)));
  return (
    <View style={styles.chartCard}>
      <View style={styles.chart}>
        {data.map((item) => {
          const premium = Number(item.premium || 0);
          const height = Math.max(5, Math.round((premium / max) * 76));
          return (
            <View key={item.month} style={styles.barColumn}>
              <Text style={styles.barValue}>{compactMoney(premium)}</Text>
              <View style={styles.barTrack}><View style={[styles.bar, { height }]} /></View>
              <Text style={styles.barMonth}>{shortMonth(item.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MixRow({ label, premium, policies, totalPremium }: { label: string; premium: number; policies: number; totalPremium: number }) {
  const percent = totalPremium > 0 ? Math.min(100, (premium / totalPremium) * 100) : 0;
  return (
    <View style={styles.mixRow}>
      <View style={styles.mixTop}>
        <Text style={styles.mixLabel}>{humanize(label)}</Text>
        <Text style={styles.mixValue}>{formatMoney(premium)} · {policies} policies</Text>
      </View>
      <View style={styles.mixTrack}><View style={[styles.mixFill, { width: `${percent}%` }]} /></View>
    </View>
  );
}

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

function compactMoney(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(Math.round(value));
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function shortMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(year, month - 1, 1));
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pull down to refresh';
  return `Updated ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
}

const styles = StyleSheet.create({
  freshnessRow: { minHeight: 26, marginTop: -8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scope: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  updated: { color: '#8A94A6', ...partnerTheme.typography.meta },
  feedback: { marginBottom: 10 },
  hero: { borderRadius: partnerTheme.radius.xl, padding: 19, backgroundColor: partnerTheme.colors.nav },
  heroHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroEyebrow: { color: '#AAA5FF', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  heroValue: { marginTop: 5, color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroLabel: { marginTop: 2, color: '#AEB7C5', ...partnerTheme.typography.meta },
  trendBadge: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9 },
  trendBadgeGood: { backgroundColor: '#18382D' },
  trendBadgeWarn: { backgroundColor: '#44341E' },
  trendBadgeText: { ...partnerTheme.typography.meta },
  trendBadgeNeutral: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: '#303A4D' },
  trendBadgeNeutralText: { color: '#C7CFDC', ...partnerTheme.typography.meta },
  heroStats: { marginTop: 18, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A4558', paddingTop: 13 },
  heroStat: { flex: 1 },
  heroStatValue: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  heroStatLabel: { marginTop: 3, color: '#9EA9BA', ...partnerTheme.typography.meta },
  actionGrid: { flexDirection: 'row', gap: 9 },
  actionStat: { flex: 1, minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: partnerTheme.radius.lg, padding: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  actionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  actionBody: { flex: 1 },
  actionValue: { color: partnerTheme.colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  actionLabel: { marginTop: 2, color: partnerTheme.colors.ink, ...partnerTheme.typography.meta },
  actionMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  chartCard: { borderRadius: 18, padding: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  chart: { height: 126, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barValue: { height: 14, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  barTrack: { height: 80, width: '74%', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 7, backgroundColor: '#F0F2F7' },
  bar: { width: '100%', borderRadius: 7, backgroundColor: partnerTheme.colors.brand },
  barMonth: { marginTop: 5, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  mixCard: { borderRadius: 18, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  mixRow: { marginBottom: 13 },
  mixTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  mixLabel: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  mixValue: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  mixTrack: { height: 6, marginTop: 6, overflow: 'hidden', borderRadius: 999, backgroundColor: '#ECEFF4' },
  mixFill: { height: '100%', borderRadius: 999, backgroundColor: partnerTheme.colors.accent },
  noData: { color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.caption },
  payoutGrid: { flexDirection: 'row', gap: 9 },
  payoutMetric: { flex: 1, minHeight: 100, borderRadius: partnerTheme.radius.lg, padding: 14, borderWidth: 1 },
  payoutMetricWarning: { backgroundColor: partnerTheme.colors.warningSoft, borderColor: '#F0D8B5' },
  payoutMetricSuccess: { backgroundColor: partnerTheme.colors.successSoft, borderColor: '#CDE8D8' },
  payoutMetricLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  payoutMetricValue: { marginTop: 6, color: partnerTheme.colors.ink, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  payoutMetricMeta: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  payoutWarning: { marginTop: 9 },
  payoutRecent: { marginTop: 9, overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  payoutRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  payoutBody: { flex: 1 },
  payoutPolicy: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  payoutCustomer: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  payoutAmount: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  restrictedCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: partnerTheme.radius.lg, padding: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  restrictedIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  restrictedBody: { flex: 1 },
  restrictedTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  restrictedText: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  sectionAction: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  networkCard: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  networkVisual: { width: 58, height: 64, alignItems: 'center' },
  networkRoot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandStrong },
  networkLine: { width: 1, height: 9, backgroundColor: '#C8CFDB' },
  networkNodes: { flexDirection: 'row', gap: 3 },
  networkNode: { width: 8, height: 8, borderRadius: 4, backgroundColor: partnerTheme.colors.accent },
  networkCopy: { flex: 1 },
  networkTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  networkText: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  contributionList: { overflow: 'hidden', borderRadius: 18, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  contributionRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  rank: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  rankText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.meta },
  contributionBody: { flex: 1 },
  contributionName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  contributionMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  contributionValue: { color: partnerTheme.colors.ink, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.8 },
});
