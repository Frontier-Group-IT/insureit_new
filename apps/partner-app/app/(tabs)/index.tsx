import { useCallback, useMemo, useState } from 'react';
import { Animated, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { StoryRail } from '@/components/story-rail';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerEnter } from '@/components/ui/partner-enter';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerListRow } from '@/components/ui/partner-list-row';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerSkeleton } from '@/components/ui/partner-skeleton';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatBlock } from '@/components/ui/partner-stat-block';
import { PartnerStatusIndicator } from '@/components/ui/partner-status-indicator';
import { PartnerTopTabs, type PartnerTopTab } from '@/components/ui/partner-top-tabs';
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

  const workTabs = useMemo<PartnerTopTab[]>(() => {
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
                <Text style={styles.businessPremium}>{formatIndianCurrency(data.business.premium_this_month)}</Text>
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
            <View style={styles.workHeader}>
              <Text style={styles.workTitle}>My work</Text>
              <PartnerStatusIndicator
                label={attentionCount(data) ? `${attentionCount(data)} need attention` : 'All clear'}
                tone={attentionCount(data) ? 'warning' : 'success'}
              />
            </View>

            <View style={styles.tabsWrap}>
              <PartnerTopTabs
                activeKey={workTab}
                onChange={(key) => setWorkTab(key as WorkTab)}
                tabs={workTabs}
              />
            </View>

            <View style={styles.workList}>
              {visibleWork.length ? (
                visibleWork.map((item) => (
                  <PartnerListRow
                    accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.count} items`}
                    divider
                    key={item.kind}
                    leading={
                      <View style={[styles.workIcon, workIconTone(item.kind)]}>
                        <Ionicons
                          name={workIcon(item.kind)}
                          size={18}
                          color={workIconColor(item.kind)}
                        />
                      </View>
                    }
                    meta={item.count ? String(item.count) : undefined}
                    onPress={() => router.push(item.route as never)}
                    subtitle={item.subtitle}
                    title={item.title}
                  />
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
                <Text style={styles.impactValue}>{formatIndianCurrency(data.impact.active_motor_idv)}</Text>
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

function workIcon(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return 'document-text-outline' as const;
  if (kind === 'renewal') return 'refresh-outline' as const;
  return 'shield-outline' as const;
}

function workIconColor(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return partnerTheme.colors.warning;
  if (kind === 'renewal') return partnerTheme.colors.brand;
  return partnerTheme.colors.accent;
}

function workIconTone(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return styles.workIconWarn;
  if (kind === 'renewal') return styles.workIconBrand;
  return styles.workIconAccent;
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

function formatIndianCurrency(value: number | string) {
  const amount = Number(value || 0);
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(amount >= 100000000 ? 0 : 1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
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
    color: partnerTheme.colors.brand,
    letterSpacing: 0.7,
    ...partnerTheme.typography.meta,
  },
  businessPremium: {
    marginTop: 4,
    color: partnerTheme.colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
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
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
    borderRadius: 18,
    backgroundColor: partnerTheme.colors.surface,
  },
  workHeader: {
    minHeight: 34,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  workTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  tabsWrap: {
    marginHorizontal: -14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  workList: { paddingHorizontal: 0 },
  workIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workIconWarn: { backgroundColor: partnerTheme.colors.warningSoft },
  workIconBrand: { backgroundColor: partnerTheme.colors.brandSoft },
  workIconAccent: { backgroundColor: partnerTheme.colors.accentSoft },
  clearRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
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
    fontWeight: '800',
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
