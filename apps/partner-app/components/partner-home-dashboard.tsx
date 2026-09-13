import { useCallback, useState } from 'react';
import { Animated, Image, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function PartnerHomeDashboard() {
  const router = useRouter();
  const { context, cacheScopeKey } = usePartnerSession();

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

  if (!context) return null;

  const { identity } = context;
  const role = identity.actor_kind === 'employee'
    ? humanize(identity.role)
    : humanize(identity.intermediary_type);

  const pendingItems = data?.today.filter((item) => item.kind !== 'renewal').slice(0, 3) ?? [];

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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search customers, vehicles and policies"
        onPress={() => router.push('/search')}
        style={({ pressed }) => [styles.searchLauncher, pressed && styles.pressed]}
      >
        <Ionicons name="search-outline" size={20} color={partnerTheme.colors.brandStrong} />
        <Text numberOfLines={1} style={styles.searchText}>Search customers, vehicles, policies...</Text>
        <Ionicons name="chevron-forward" size={17} color={partnerTheme.colors.inkSubtle} />
      </Pressable>

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
            <View style={styles.businessCard}>
              <View style={styles.sectionTopRow}>
                <Text style={styles.periodLabel}>THIS MONTH</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View business report"
                  hitSlop={8}
                  onPress={() => router.push('/(tabs)/business')}
                  style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}
                >
                  <Text style={styles.inlineActionText}>View report</Text>
                  <Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.brand} />
                </Pressable>
              </View>

              <Text style={styles.businessPremium}>
                {currencyParts(data.business.premium_this_month).whole}
                {currencyParts(data.business.premium_this_month).fraction ? (
                  <Text style={styles.businessPremiumFraction}>.{currencyParts(data.business.premium_this_month).fraction}</Text>
                ) : null}
              </Text>
              <Text style={styles.businessCaption}>Gross premium</Text>

              <Trend
                value={Number(data.business.premium_change_percent || 0)}
                hasPrevious={Number(data.business.premium_last_month || 0) > 0}
              />

              <View style={styles.businessStats}>
                <View style={styles.statCell}>
                  <PartnerStatBlock value={data.business.policies_this_month} label="Policies" />
                </View>
                <View style={styles.statCellLast}>
                  <PartnerStatBlock value={data.business.total_customers} label="Customers" />
                </View>
              </View>
            </View>
          </PartnerEnter>

          <PartnerEnter delay={70}>
            <View style={styles.sectionBlock}>
              <PartnerSectionHeader title="Quick actions" />
              <View style={styles.quickGrid}>
                <QuickAction asset={PartnerAssets.navigation.policyIntake} label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />
                <QuickAction asset={PartnerAssets.actions.renewals} label="Renewals" onPress={() => router.push('/renewals')} />
                <QuickAction asset={PartnerAssets.navigation.claims} label="Claims" onPress={() => router.push('/(tabs)/claims')} />
                <QuickAction asset={PartnerAssets.navigation.customers} label="Customers" onPress={() => router.push('/customers')} />
              </View>
            </View>
          </PartnerEnter>

          {pendingItems.length ? (
            <PartnerEnter delay={110}>
              <View style={styles.sectionBlock}>
                <PartnerSectionHeader title="Pending tasks" />
                <Text style={styles.sectionHint}>Items that need your attention</Text>
                <View style={styles.pendingList}>
                  {pendingItems.map((item, index) => (
                    <Pressable
                      key={`${item.kind}-${item.route}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.count}`}
                      onPress={() => router.push(item.route as never)}
                      style={({ pressed }) => [
                        styles.pendingRow,
                        index < pendingItems.length - 1 && styles.rowBorder,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.pendingIconWrap}>
                        <Image source={attentionAsset(item.kind)} style={styles.pendingIcon} resizeMode="contain" />
                      </View>
                      <View style={styles.pendingCopy}>
                        <View style={styles.pendingTitleRow}>
                          <Text numberOfLines={1} style={styles.pendingTitle}>{item.title}</Text>
                          {item.count > 0 ? <Text style={styles.pendingCount}>{item.count}</Text> : null}
                        </View>
                        <Text numberOfLines={1} style={styles.pendingSubtitle}>{item.subtitle}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={17} color={partnerTheme.colors.inkSubtle} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </PartnerEnter>
          ) : null}

          {data.business.renewals_30_days > 0 ? (
            <PartnerEnter delay={145}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${data.business.renewals_30_days} renewals due within 30 days`}
                onPress={() => router.push('/renewals')}
                style={({ pressed }) => [styles.renewalStrip, pressed && styles.pressed]}
              >
                <View style={styles.renewalIconWrap}>
                  <Image source={PartnerAssets.actions.renewals} style={styles.renewalIcon} resizeMode="contain" />
                </View>
                <View style={styles.renewalCopy}>
                  <Text style={styles.renewalTitle}>Renewals due soon</Text>
                  <Text style={styles.renewalText}>{data.business.renewals_30_days} policies expiring within 30 days</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={partnerTheme.colors.brand} />
              </Pressable>
            </PartnerEnter>
          ) : null}

          <PartnerEnter delay={180}>
            <View style={styles.impactSection}>
              <PartnerSectionHeader
                title="Your impact"
                action={
                  <Pressable accessibilityRole="button" accessibilityLabel="View impact" hitSlop={8} onPress={() => router.push('/impact')}>
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
                  <Text style={styles.impactValue}>{formatCompactIndianAmount(data.impact.active_motor_idv)}</Text>
                </View>
                <View style={styles.impactStats}>
                  <PartnerStatBlock value={data.impact.active_vehicles} label="Vehicles" />
                  <PartnerStatBlock value={data.impact.customers_served} label="Customers" />
                  <PartnerStatBlock value={data.impact.claims_assisted} label="Claims assisted" />
                </View>
              </Pressable>
            </View>
          </PartnerEnter>

          {stories.length ? <View style={styles.stories}><StoryRail stories={stories} /></View> : null}
        </>
      )}
    </PartnerScreen>
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <PartnerSkeleton height={174} radius={18} />
      <View style={styles.skeletonHeader}><PartnerSkeleton width="30%" height={18} /></View>
      <View style={styles.quickGrid}>
        <PartnerSkeleton width="23%" height={82} radius={14} />
        <PartnerSkeleton width="23%" height={82} radius={14} />
        <PartnerSkeleton width="23%" height={82} radius={14} />
        <PartnerSkeleton width="23%" height={82} radius={14} />
      </View>
      <View style={styles.skeletonHeader}><PartnerSkeleton width="34%" height={18} /></View>
      <PartnerSkeleton height={126} radius={16} />
    </View>
  );
}

function QuickAction({ asset, label, onPress }: { asset: number; label: string; onPress: () => void }) {
  const scale = useState(() => new Animated.Value(1))[0];
  const animate = (pressed: boolean) => {
    Animated.spring(scale, {
      toValue: pressed ? 0.96 : 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 5,
    }).start();
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
      <Animated.View style={[styles.quickAction, { transform: [{ scale }] }]}>
        <Image source={asset} style={styles.quickImage} resizeMode="contain" />
        <Text numberOfLines={2} style={styles.quickLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function attentionAsset(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return PartnerAssets.navigation.policyIntake;
  if (kind === 'renewal') return PartnerAssets.actions.renewals;
  return PartnerAssets.navigation.claims;
}

function Trend({ value, hasPrevious }: { value: number; hasPrevious: boolean }) {
  if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison period</Text>;
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={15} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} />
      <Text style={[styles.trendText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {Math.abs(value).toFixed(1)}% {positive ? 'vs' : 'below'} last month
      </Text>
    </View>
  );
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
  return { whole: formatted.slice(0, dot), fraction: formatted.slice(dot + 1) };
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

const styles = StyleSheet.create({
  identityLine: { marginTop: -10, marginBottom: 10, minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: partnerTheme.spacing.md },
  role: { flex: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  updated: { color: '#8A94A6', ...partnerTheme.typography.meta },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarTouch: { width: partnerTheme.control.minTouchTarget, height: partnerTheme.control.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.label },
  pressed: { opacity: 0.76 },
  refreshWarning: { marginTop: 10 },

  searchLauncher: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9E4F4', backgroundColor: '#F8FBFF' },
  searchText: { flex: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },

  businessCard: { marginTop: 12, padding: 16, borderRadius: 18, backgroundColor: partnerTheme.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5EBF4' },
  sectionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  periodLabel: { color: partnerTheme.colors.brandStrong, fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: undefined }), fontSize: 12, lineHeight: 17, fontWeight: '700', letterSpacing: 0.5 },
  inlineAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 2 },
  inlineActionText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  businessPremium: { marginTop: 8, color: partnerTheme.colors.ink, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  businessPremiumFraction: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  businessCaption: { marginTop: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  trend: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  trendText: { ...partnerTheme.typography.meta },
  trendNeutral: { marginTop: 8, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  businessStats: { marginTop: 14, paddingTop: 12, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  statCell: { flex: 1, paddingRight: 14, marginRight: 14, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: partnerTheme.colors.line },
  statCellLast: { flex: 1 },

  sectionBlock: { marginTop: 12, paddingHorizontal: 14, paddingBottom: 10, borderRadius: 18, backgroundColor: partnerTheme.colors.surface },
  sectionHint: { marginTop: -5, marginBottom: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  quickGrid: { flexDirection: 'row', gap: 6 },
  quickActionTouch: { flex: 1, minHeight: 82 },
  quickAction: { flex: 1, minHeight: 82, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 3, borderRadius: 14, backgroundColor: '#F7FAFE' },
  quickImage: { width: 34, height: 34 },
  quickLabel: { width: '100%', color: partnerTheme.colors.ink, textAlign: 'center', ...partnerTheme.typography.meta },

  pendingList: { marginTop: 2 },
  pendingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  pendingIconWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pendingIcon: { width: 34, height: 34 },
  pendingCopy: { flex: 1, minWidth: 0 },
  pendingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pendingTitle: { flexShrink: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.cardTitle },
  pendingCount: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.caption },
  pendingSubtitle: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },

  renewalStrip: { marginTop: 12, minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#F4F8FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D7E5F8' },
  renewalIconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  renewalIcon: { width: 40, height: 40 },
  renewalCopy: { flex: 1, minWidth: 0 },
  renewalTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.cardTitle },
  renewalText: { marginTop: 2, color: partnerTheme.colors.warning, ...partnerTheme.typography.caption },

  sectionAction: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  impactSection: { marginTop: 12, paddingHorizontal: 14, paddingBottom: 12, borderRadius: 18, backgroundColor: partnerTheme.colors.surface },
  impactSummary: { minHeight: 108, paddingTop: 2 },
  impactPrimary: { paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  impactLabel: { color: partnerTheme.colors.accent, letterSpacing: 0.6, ...partnerTheme.typography.meta },
  impactValue: { marginTop: 3, color: partnerTheme.colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '500' },
  impactStats: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  stories: { marginTop: 12 },

  skeletonWrap: { marginTop: 12 },
  skeletonHeader: { marginTop: partnerTheme.spacing.xl, marginBottom: partnerTheme.spacing.sm, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});