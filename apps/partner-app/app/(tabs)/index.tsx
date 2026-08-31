import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { StoryRail } from '@/components/story-rail';
import { PartnerBanner } from '@/components/ui/partner-banner';
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

          <View style={styles.businessBlock}>
            <View style={styles.businessHeading}>
              <View>
                <Text style={styles.businessLabel}>MY BUSINESS · THIS MONTH</Text>
                <Text style={styles.businessPremium}>{formatMoney(data.business.premium_this_month)}</Text>
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

          <PartnerSectionHeader title="Quick actions" />
          <View style={styles.quickGrid}>
            <QuickAction icon="add-circle-outline" label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />
            <QuickAction icon="refresh-outline" label="Renewals" onPress={() => router.push('/renewals')} />
            <QuickAction icon="shield-outline" label="Claims" onPress={() => router.push('/(tabs)/claims')} />
            <QuickAction icon="people-outline" label="Customers" onPress={() => router.push('/customers')} />
          </View>

          <PartnerSectionHeader
            title="Business pulse"
            action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open business pulse"
                hitSlop={8}
                onPress={() => router.push('/pulse')}
              >
                <Text style={styles.sectionAction}>View</Text>
              </Pressable>
            }
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open business pulse. ${pulseTitle(data)}`}
            onPress={() => router.push('/pulse')}
            style={({ pressed }) => [styles.pulseRow, pressed && styles.pressed]}
          >
            <View style={styles.pulseMain}>
              <Text style={styles.pulseTitle}>{pulseTitle(data)}</Text>
              <View style={styles.pulseSignals}>
                <PartnerStatusIndicator
                  label={`Business ${humanize(data.pulse.business_momentum)}`}
                  tone={data.pulse.business_momentum === 'rising' ? 'success' : 'neutral'}
                />
                <PartnerStatusIndicator
                  label={data.business.renewals_7_days ? `${data.business.renewals_7_days} renewals due` : 'Renewals clear'}
                  tone={data.business.renewals_7_days ? 'warning' : 'success'}
                />
                <PartnerStatusIndicator
                  label={data.service.claims_need_attention ? `${data.service.claims_need_attention} claims` : 'Claims steady'}
                  tone={data.service.claims_need_attention ? 'warning' : 'success'}
                />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA6B5" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open impact. ${impactTitle(data)}`}
            onPress={() => router.push('/impact')}
            style={({ pressed }) => [styles.impactRow, pressed && styles.pressed]}
          >
            <View style={styles.impactIcon}>
              <Ionicons name="heart-outline" size={19} color={partnerTheme.colors.accent} />
            </View>
            <View style={styles.impactCopy}>
              <Text style={styles.impactEyebrow}>YOUR IMPACT</Text>
              <Text numberOfLines={1} style={styles.impactTitle}>{impactTitle(data)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#9CA6B5" />
          </Pressable>

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

function QuickAction({ icon, label, onPress }: {
  icon: 'add-circle-outline' | 'refresh-outline' | 'shield-outline' | 'people-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={partnerTheme.colors.brand} />
      </View>
      <Text numberOfLines={1} style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
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

function pulseTitle(data: PartnerHomeData) {
  const attention = data.service.intakes_need_attention + data.service.claims_need_attention + data.business.renewals_7_days;
  if (attention === 0 && data.pulse.business_momentum === 'rising') return 'Strong momentum';
  if (attention > 3) return 'Action-focused day';
  if (attention > 0) return 'A few things need you';
  return 'Steady and clear';
}

function impactTitle(data: PartnerHomeData) {
  if (data.impact.active_vehicles > 0) return `${data.impact.active_vehicles} vehicles currently protected`;
  if (data.impact.customers_served > 0) return `${data.impact.customers_served} customers in your authorized book`;
  return 'Your impact starts with every customer you help';
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

function formatMoney(value: number | string) {
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
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

  workSection: { marginTop: 14 },
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
    marginHorizontal: -16,
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

  quickGrid: { flexDirection: 'row', gap: 6 },
  quickAction: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  quickLabel: {
    marginTop: 5,
    color: partnerTheme.colors.ink,
    textAlign: 'center',
    ...partnerTheme.typography.meta,
  },

  sectionAction: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  pulseRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: partnerTheme.colors.line,
  },
  pulseMain: { flex: 1 },
  pulseTitle: { color: partnerTheme.colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  pulseSignals: {
    marginTop: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 4,
  },

  impactRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  impactIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.accentSoft,
  },
  impactCopy: { flex: 1 },
  impactEyebrow: {
    color: partnerTheme.colors.accent,
    letterSpacing: 0.6,
    ...partnerTheme.typography.meta,
  },
  impactTitle: {
    marginTop: 2,
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.bodyStrong,
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
