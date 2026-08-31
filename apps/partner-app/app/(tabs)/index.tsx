import { useCallback, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { StoryRail } from '@/components/story-rail';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerEnter } from '@/components/ui/partner-enter';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerSkeleton } from '@/components/ui/partner-skeleton';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatBlock } from '@/components/ui/partner-stat-block';
import { getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { getPartnerStories, type PartnerStory } from '@/lib/stories';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

type WorkTab = 'today' | 'renewals' | 'claims' | 'intakes';

export default function PartnerHomeScreen() {
  const router = useRouter();
  const { context, cacheScopeKey } = usePartnerSession();
  const [workTab, setWorkTab] = useState<WorkTab>('today');

  const fetchHomeWorkspace = useCallback(async (): Promise<{ home: PartnerHomeData; stories: PartnerStory[] }> => {
    const [homeResult, storiesResult] = await Promise.allSettled([
      getPartnerHome(),
      getPartnerStories(),
    ]);

    if (homeResult.status === 'rejected') throw homeResult.reason;
    return {
      home: homeResult.value,
      stories: storiesResult.status === 'fulfilled' ? storiesResult.value.items : [],
    };
  }, []);

  const workspace = usePartnerQuery({
    scopeKey: cacheScopeKey,
    key: 'home:workspace',
    fetcher: fetchHomeWorkspace,
    staleTimeMs: 60_000,
  });

  useFocusEffect(useCallback(() => {
    void workspace.ensureFresh();
  }, [workspace.ensureFresh]));

  const data = workspace.data?.home ?? null;
  const stories = workspace.data?.stories ?? [];

  const workTabs = useMemo(() => {
    if (!data) return [];
    return [
      { key: 'today', label: 'Today', badge: attentionCount(data) },
      { key: 'renewals', label: 'Renewals', badge: data.business.renewals_7_days },
      { key: 'claims', label: 'Claims', badge: data.service.claims_need_attention },
      { key: 'intakes', label: 'Intakes', badge: data.service.intakes_need_attention },
    ];
  }, [data]);

  const visibleWork = useMemo(() => {
    if (!data) return [];
    if (workTab === 'today') return data.today;
    if (workTab === 'renewals') return data.today.filter((item) => item.kind === 'renewal');
    if (workTab === 'claims') return data.today.filter((item) => item.kind === 'claim');
    return data.today.filter((item) => item.kind === 'intake_attention');
  }, [data, workTab]);

  if (!context) return null;

  const { identity } = context;
  const role = identity.actor_kind === 'employee'
    ? humanize(identity.role)
    : humanize(identity.intermediary_type);

  return (
    <PartnerScreen
      eyebrow="INSUREIT PARTNER"
      title={greeting(identity.display_name)}
      action={
        <View style={styles.headerActions}>
          <PartnerIconButton
            icon="time-outline"
            label="View recent activity"
            onPress={() => router.push('/activity')}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.avatarTouch, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(identity.display_name)}</Text>
            </View>
          </Pressable>
        </View>
      }
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
      <View style={styles.identityLine}>
        <Text style={styles.role}>{role}</Text>
        {data ? <Text style={styles.updated}>{formatUpdatedAt(data.generated_at)}</Text> : null}
      </View>

      {workspace.loading && !data ? (
        <HomeSkeleton />
      ) : !data ? (
        <PartnerStateView
          state="error"
          title="Home is unavailable"
          message={workspace.error || 'We could not load your Partner workspace.'}
          actionLabel="Try again"
          onAction={() => void workspace.refresh()}
        />
      ) : (
        <>
          {workspace.stale || workspace.error ? (
            <View style={styles.refreshWarning}>
              <PartnerBanner
                tone="warning"
                title={workspace.offline ? "You're offline" : 'Showing cached information'}
                message={workspace.stale
                  ? `Last refreshed ${formatCacheTime(workspace.updatedAt)}. Pull down to try again.`
                  : workspace.error}
              />
            </View>
          ) : null}

          <PartnerEnter delay={20}>
          <View style={styles.businessBlock}>
            <View style={styles.businessHeading}>
              <View>
                <Text style={styles.businessLabel}>MY BUSINESS · THIS MONTH</Text>
                <Text style={styles.businessPremium}>
                  {currencyParts(data.business.premium_this_month).whole}
                  {currencyParts(data.business.premium_this_month).fraction ? (
                    <Text style={styles.businessPremiumFraction}>
                      .{currencyParts(data.business.premium_this_month).fraction}
                    </Text>
                  ) : null}
                </Text>
                <Text style={styles.businessCaption}>Gross premium</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View business"
                hitSlop={8}
                onPress={() => router.push('/(tabs)/business')}
                style={({ pressed }) => [styles.businessView, pressed && styles.pressed]}
              >
                <Text style={styles.businessViewText}>View</Text>
                <Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.brand} />
              </Pressable>
            </View>

            <Trend
              value={Number(data.business.premium_change_percent || 0)}
              hasPrevious={Number(data.business.premium_last_month || 0) > 0}
            />

            <View style={styles.businessStats}>
              <View style={styles.statCell}>
                <PartnerStatBlock value={data.business.policies_this_month} label="Policies" />
              </View>
              <View style={styles.statCell}>
                <PartnerStatBlock value={data.business.total_customers} label="Customers" />
              </View>
              <View style={styles.statCell}>
                <PartnerStatBlock value={data.business.renewals_30_days} label="Renewals" />
              </View>
              <View style={styles.statCellLast}>
                <PartnerStatBlock value={data.service.active_claims} label="Claims" />
              </View>
            </View>
          </View>
          </PartnerEnter>

          <PartnerEnter delay={80}>
          <View style={styles.workSection}>
            <Text style={styles.workTitle}>MY WORK</Text>

            <View style={styles.workSelector}>
              {workTabs.map((tab) => {
                const active = tab.key === workTab;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${tab.label}. ${tab.badge} items`}
                    accessibilityState={{ selected: active }}
                    key={tab.key}
                    onPress={() => setWorkTab(tab.key as WorkTab)}
                    style={({ pressed }) => [
                      styles.workSelectorItem,
                      active && styles.workSelectorItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.workSelectorLabel, active && styles.workSelectorLabelActive]}>
                      {tab.label}
                    </Text>
                    <Text style={[styles.workSelectorCount, active && styles.workSelectorCountActive]}>
                      {tab.badge}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.workList}>
              {visibleWork.length ? (
                visibleWork.map((item, index) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.count} items`}
                    key={item.kind}
                    onPress={() => router.push(item.route as never)}
                    style={({ pressed }) => [
                      styles.workRow,
                      index < visibleWork.length - 1 && styles.workRowDivider,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.workMarker, workMarkerTone(item.kind)]} />
                    <View style={styles.workRowCopy}>
                      <Text style={styles.workRowTitle}>{item.title}</Text>
                      <Text numberOfLines={1} style={styles.workRowSubtitle}>{item.subtitle}</Text>
                    </View>
                    <View style={styles.workRowTrailing}>
                      {item.count ? <Text style={styles.workRowCount}>{item.count}</Text> : null}
                      <Ionicons name="chevron-forward" size={17} color="#A0A8B6" />
                    </View>
                  </Pressable>
                ))
              ) : (
                <View style={styles.clearRow}>
                  <Ionicons name="checkmark-circle-outline" size={19} color={partnerTheme.colors.success} />
                  <Text style={styles.clearText}>{emptyWorkLabel(workTab)}</Text>
                </View>
              )}
            </View>
          </View>
          </PartnerEnter>

          <PartnerEnter delay={140}>
          <View style={styles.quickSection}>
            <PartnerSectionHeader title="Quick actions" />
            <View style={styles.quickGrid}>
              <QuickAction icon="document-text" tone="brand" label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />
              <QuickAction icon="sync" tone="renewal" label="Renewals" onPress={() => router.push('/renewals')} />
              <QuickAction icon="shield-checkmark" tone="claim" label="Claims" onPress={() => router.push('/(tabs)/claims')} />
              <QuickAction icon="people" tone="customer" label="Customers" onPress={() => router.push('/customers')} />
            </View>
          </View>
          </PartnerEnter>

          <PartnerEnter delay={200}>
          <View style={styles.impactSection}>
            <PartnerSectionHeader
              title="Your impact"
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View impact"
                  hitSlop={8}
                  onPress={() => router.push('/impact')}
                >
                  <Text style={styles.sectionAction}>View</Text>
                </Pressable>
              }
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open impact. ${formatIndianCurrency(data.impact.active_motor_idv)} active motor IDV protected`}
              onPress={() => router.push('/impact')}
              style={({ pressed }) => [styles.impactSummary, pressed && styles.pressed]}
            >
              <View style={styles.impactPrimary}>
                <Text style={styles.impactLabel}>ACTIVE MOTOR IDV PROTECTED</Text>
                <Text style={styles.impactValue}>
                  {formatCompactIndianAmount(data.impact.active_motor_idv)}
                </Text>
              </View>

              <View style={styles.impactStats}>
                <PartnerStatBlock value={data.impact.active_vehicles} label="Vehicles" />
                <PartnerStatBlock value={data.impact.customers_served} label="Customers" />
                <PartnerStatBlock value={data.impact.claims_assisted} label="Claims assisted" />
              </View>
            </Pressable>
          </View>
          </PartnerEnter>

          {stories.length ? (
            <View style={styles.stories}>
              <StoryRail stories={stories} />
            </View>
          ) : null}
        </>
      )}
    </PartnerScreen>
  );
}

function HomeSkeleton() {
  return (
    <View>
      <PartnerSkeleton height={164} radius={16} />
      <View style={styles.skeletonHeader}>
        <PartnerSkeleton width="34%" height={18} />
        <PartnerSkeleton width={88} height={14} />
      </View>
      <PartnerSkeleton height={156} radius={14} />
      <View style={styles.skeletonHeader}>
        <PartnerSkeleton width="30%" height={18} />
      </View>
      <View style={styles.quickGrid}>
        <PartnerSkeleton width="23%" height={72} radius={14} />
        <PartnerSkeleton width="23%" height={72} radius={14} />
        <PartnerSkeleton width="23%" height={72} radius={14} />
        <PartnerSkeleton width="23%" height={72} radius={14} />
      </View>
    </View>
  );
}

function QuickAction({ icon, tone, label, onPress }: {
  icon: 'document-text' | 'sync' | 'shield-checkmark' | 'people';
  tone: 'brand' | 'renewal' | 'claim' | 'customer';
  label: string;
  onPress: () => void;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const lift = useState(() => new Animated.Value(0))[0];

  const animate = (pressed: boolean) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressed ? 0.96 : 1,
        useNativeDriver: true,
        speed: 28,
        bounciness: 5,
      }),
      Animated.spring(lift, {
        toValue: pressed ? -2 : 0,
        useNativeDriver: true,
        speed: 28,
        bounciness: 5,
      }),
    ]).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => animate(true)}
      onPressOut={() => animate(false)}
      style={styles.quickActionTouch}
    >
      <Animated.View
        style={[
          styles.quickAction,
          { transform: [{ scale }, { translateY: lift }] },
        ]}
      >
        <View style={[styles.quickIcon, styles[`quickIcon_${tone}`]]}>
          <Ionicons name={icon} size={22} color={quickActionColor(tone)} />
        </View>
        <Text numberOfLines={1} style={styles.quickLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function quickActionColor(tone: 'brand' | 'renewal' | 'claim' | 'customer') {
  if (tone === 'renewal') return partnerTheme.colors.warning;
  if (tone === 'claim') return partnerTheme.colors.accent;
  if (tone === 'customer') return partnerTheme.colors.success;
  return partnerTheme.colors.brandStrong;
}

function Trend({ value, hasPrevious }: { value: number; hasPrevious: boolean }) {
  if (!hasPrevious) {
    return <Text style={styles.trendNeutral}>First recorded comparison period</Text>;
  }
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Ionicons
        name={positive ? 'trending-up' : 'trending-down'}
        size={14}
        color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning}
      />
      <Text style={[styles.trendText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {Math.abs(value).toFixed(1)}% {positive ? 'above' : 'below'} last month
      </Text>
    </View>
  );
}

function workMarkerTone(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return styles.workMarkerWarn;
  if (kind === 'renewal') return styles.workMarkerBrand;
  return styles.workMarkerAccent;
}

function emptyWorkLabel(tab: WorkTab) {
  if (tab === 'renewals') return 'No urgent renewals.';
  if (tab === 'claims') return 'No claims need attention.';
  if (tab === 'intakes') return 'No Policy Intakes need attention.';
  return 'You are clear for now.';
}

function greeting(name: string) {
  const firstName = name.trim().split(/\s+/)[0] || 'Partner';
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${prefix}, ${firstName}`;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}


function formatCompactIndianAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0';

  const format = (scaled: number, suffix: string) => {
    const decimals = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1;
    return `₹${scaled.toFixed(decimals).replace(/\.0$/, '')}${suffix}`;
  };

  if (Math.abs(amount) >= 10000000) return format(amount / 10000000, 'Cr');
  if (Math.abs(amount) >= 100000) return format(amount / 100000, 'L');
  if (Math.abs(amount) >= 1000) return format(amount / 1000, 'K');
  return formatIndianCurrency(amount);
}

function currencyParts(value: number | string | null | undefined) {
  const formatted = formatIndianCurrency(value);
  const dot = formatted.lastIndexOf('.');
  if (dot < 0) return { whole: formatted, fraction: '' };
  return {
    whole: formatted.slice(0, dot),
    fraction: formatted.slice(dot + 1),
  };
}

function formatCacheTime(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pull down to refresh';
  return `Updated ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date)}`;
}

function attentionCount(data: PartnerHomeData) {
  return data.today.reduce((sum, item) => sum + Math.max(item.count || 0, 1), 0);
}

const styles = StyleSheet.create({
  identityLine: {
    marginTop: -10,
    marginBottom: 8,
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: partnerTheme.spacing.md,
  },
  role: { flex: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  updated: { color: '#8A94A6', ...partnerTheme.typography.meta },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarTouch: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  refreshWarning: { marginBottom: 6 },
  pressed: { opacity: 0.76 },

  businessBlock: {
    marginTop: 2,
    padding: 14,
    borderRadius: 18,
    backgroundColor: partnerTheme.colors.surface,
  },
  businessHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  businessLabel: {
    color: partnerTheme.colors.inkMuted,
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
      default: undefined,
    }),
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 1.15,
  },
  businessPremium: {
    marginTop: 4,
    color: partnerTheme.colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '600',
  },
  businessPremiumFraction: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '500',
  },
  businessCaption: {
    marginTop: 1,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  businessView: {
    minHeight: partnerTheme.control.minTouchTarget,
    minWidth: partnerTheme.control.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  businessViewText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  trend: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { ...partnerTheme.typography.meta },
  trendNeutral: { marginTop: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  businessStats: {
    marginTop: 14,
    paddingTop: 11,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
  },
  statCell: {
    flex: 1,
    paddingRight: 8,
    marginRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: partnerTheme.colors.line,
  },
  statCellLast: { flex: 1 },

  workSection: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: partnerTheme.colors.surface,
  },
  workTitle: {
    color: partnerTheme.colors.inkMuted,
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
      default: undefined,
    }),
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: 1.15,
  },
  workSelector: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  workSelectorItem: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: '#F7F8FB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  workSelectorItemActive: {
    backgroundColor: partnerTheme.colors.brandSoft,
    borderColor: '#D9D6FF',
  },
  workSelectorLabel: {
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.meta,
  },
  workSelectorLabelActive: {
    color: partnerTheme.colors.brandStrong,
    fontWeight: '700',
  },
  workSelectorCount: {
    marginTop: 3,
    color: partnerTheme.colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  workSelectorCountActive: {
    color: partnerTheme.colors.brandStrong,
  },
  workList: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
  },
  workRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
  },
  workRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  workMarker: {
    width: 4,
    height: 30,
    borderRadius: 999,
  },
  workMarkerWarn: { backgroundColor: partnerTheme.colors.warning },
  workMarkerBrand: { backgroundColor: partnerTheme.colors.brand },
  workMarkerAccent: { backgroundColor: partnerTheme.colors.accent },
  workRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  workRowTitle: {
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.bodyStrong,
  },
  workRowSubtitle: {
    marginTop: 3,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  workRowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  workRowCount: {
    minWidth: 20,
    color: partnerTheme.colors.ink,
    textAlign: 'right',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  clearRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearText: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },

  quickSection: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: partnerTheme.colors.surface,
  },
  quickGrid: { flexDirection: 'row', gap: 6 },
  quickActionTouch: {
    flex: 1,
    minHeight: 76,
  },
  quickAction: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderRadius: 14,
    backgroundColor: '#FAFBFD',
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon_brand: { backgroundColor: partnerTheme.colors.brandSoft },
  quickIcon_renewal: { backgroundColor: partnerTheme.colors.warningSoft },
  quickIcon_claim: { backgroundColor: partnerTheme.colors.accentSoft },
  quickIcon_customer: { backgroundColor: partnerTheme.colors.successSoft },
  quickLabel: {
    marginTop: 5,
    color: partnerTheme.colors.ink,
    textAlign: 'center',
    ...partnerTheme.typography.meta,
  },

  sectionAction: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },

  impactSection: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderRadius: 18,
    backgroundColor: partnerTheme.colors.surface,
  },
  impactSummary: {
    minHeight: 108,
    paddingTop: 2,
  },
  impactPrimary: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  impactLabel: {
    color: partnerTheme.colors.accent,
    letterSpacing: 0.6,
    ...partnerTheme.typography.meta,
  },
  impactValue: {
    marginTop: 3,
    color: partnerTheme.colors.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
  },
  impactStats: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  stories: { marginTop: 12 },

  skeletonHeader: {
    marginTop: partnerTheme.spacing.xl,
    marginBottom: partnerTheme.spacing.sm,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
