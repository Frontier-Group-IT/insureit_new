import { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { StoryRail } from '@/components/story-rail';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerSkeleton } from '@/components/ui/partner-skeleton';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { getPartnerStories, type PartnerStory } from '@/lib/stories';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function PartnerHomeScreen() {
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
  const role = identity.actor_kind === 'employee' ? humanize(identity.role) : humanize(identity.intermediary_type);

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

          <PartnerSectionHeader
            title="Needs your attention"
            meta={attentionMeta(data)}
          />

          {data.today.length ? (
            <View style={styles.todayList}>
              {data.today.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.subtitle}`}
                  key={item.kind}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [styles.todayRow, pressed && styles.pressed]}
                >
                  <View style={[styles.todayIcon, todayIconTone(item.kind)]}>
                    <Ionicons name={todayIcon(item.kind)} size={20} color={todayIconColor(item.kind)} />
                  </View>
                  <View style={styles.todayBody}>
                    <View style={styles.todayTitleRow}>
                      <Text style={styles.todayTitle}>{item.title}</Text>
                      {item.count > 0 ? <Text style={styles.todayCount}>{item.count}</Text> : null}
                    </View>
                    <Text style={styles.todaySubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color="#A0A8B6" />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.clearCard}>
              <View style={styles.clearIcon}>
                <Ionicons name="checkmark-circle-outline" size={24} color={partnerTheme.colors.success} />
              </View>
              <View style={styles.clearBody}>
                <Text style={styles.clearTitle}>You are clear for now</Text>
                <Text style={styles.clearText}>No urgent renewal, claim or Policy Intake action is waiting.</Text>
              </View>
            </View>
          )}

          <PartnerSectionHeader title="Quick actions" />
          <View style={styles.quickGrid}>
            <QuickAction icon="add-circle-outline" label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />
            <QuickAction icon="refresh-outline" label="Renewals" onPress={() => router.push('/renewals')} />
            <QuickAction icon="shield-outline" label="Claims" onPress={() => router.push('/(tabs)/claims')} />
            <QuickAction icon="people-outline" label="Customers" onPress={() => router.push('/customers')} />
          </View>

          <PartnerSectionHeader
            title="My business"
            meta="This month"
            action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View business"
                onPress={() => router.push('/(tabs)/business')}
                hitSlop={6}
              >
                <Text style={styles.sectionAction}>View business</Text>
              </Pressable>
            }
          />

          <View style={styles.businessCard}>
            <View style={styles.businessMain}>
              <Text style={styles.businessEyebrow}>GROSS PREMIUM</Text>
              <Text style={styles.businessPremium}>
                {formatMoney(data.business.premium_this_month)}
              </Text>
              <Trend
                value={Number(data.business.premium_change_percent || 0)}
                hasPrevious={Number(data.business.premium_last_month || 0) > 0}
              />
            </View>

            <View style={styles.businessStats}>
              <BusinessStat
                value={data.business.policies_this_month}
                label="Policies"
              />
              <BusinessStat
                value={data.business.total_customers}
                label="Customers"
              />
              <BusinessStat
                value={data.business.renewals_30_days}
                label="Renewals"
              />
              <BusinessStat
                value={data.service.active_claims}
                label="Claims"
              />
            </View>
          </View>

          <PartnerSectionHeader title="Business pulse" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open business pulse. ${pulseTitle(data)}`}
            onPress={() => router.push('/pulse')}
            style={({ pressed }) => [styles.pulseCard, pressed && styles.pressed]}
          >
            <View style={styles.pulseTop}>
              <View style={styles.pulseHeading}>
                <Text style={styles.pulseEyebrow}>YOUR PULSE</Text>
                <Text style={styles.pulseTitle}>{pulseTitle(data)}</Text>
              </View>
              <View style={styles.pulseOrb}>
                <Ionicons name="pulse-outline" size={24} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.pulseSignals}>
              <Signal label="Business" value={humanize(data.pulse.business_momentum)} />
              <Signal label="Renewals" value={data.business.renewals_7_days ? `${data.business.renewals_7_days} due` : 'Clear'} />
              <Signal label="Service" value={data.service.claims_need_attention ? `${data.service.claims_need_attention} attention` : 'Steady'} />
            </View>

            <View style={styles.pulseFooter}>
              <Text style={styles.pulseFooterText}>See what is shaping today</Text>
              <Ionicons name="arrow-forward" size={15} color="#D8D6FF" />
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open impact. ${impactTitle(data)}`}
            onPress={() => router.push('/impact')}
            style={({ pressed }) => [styles.characterCard, pressed && styles.pressed]}
          >
            <View style={styles.characterIcon}>
              <Ionicons name="heart-outline" size={21} color={partnerTheme.colors.accent} />
            </View>
            <View style={styles.characterBody}>
              <Text style={styles.characterEyebrow}>YOUR IMPACT</Text>
              <Text style={styles.characterTitle}>{impactTitle(data)}</Text>
              <Text style={styles.characterText}>{impactText(data)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#7F9896" />
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
      <View style={styles.skeletonHeader}>
        <PartnerSkeleton width="58%" height={18} />
        <PartnerSkeleton width={74} height={14} />
      </View>
      <View style={styles.skeletonList}>
        <PartnerSkeleton height={78} radius={16} />
        <PartnerSkeleton height={78} radius={16} />
      </View>
      <View style={styles.skeletonHeader}>
        <PartnerSkeleton width="35%" height={18} />
      </View>
      <View style={styles.quickGrid}>
        <PartnerSkeleton width="23%" height={88} radius={16} />
        <PartnerSkeleton width="23%" height={88} radius={16} />
        <PartnerSkeleton width="23%" height={88} radius={16} />
        <PartnerSkeleton width="23%" height={88} radius={16} />
      </View>
      <View style={styles.skeletonHeader}>
        <PartnerSkeleton width="42%" height={18} />
      </View>
      <PartnerSkeleton height={160} radius={22} />
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
        <Ionicons name={icon} size={22} color={partnerTheme.colors.brand} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signal}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.signalValue}>{value}</Text>
    </View>
  );
}

function BusinessStat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.businessStat}>
      <Text style={styles.businessStatValue}>{value}</Text>
      <Text style={styles.businessStatLabel}>{label}</Text>
    </View>
  );
}

function Trend({ value, hasPrevious, comparisonLabel = 'last month' }: { value: number; hasPrevious: boolean; comparisonLabel?: string }) {
  if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison period</Text>;
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Ionicons
        name={positive ? 'trending-up' : 'trending-down'}
        size={14}
        color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning}
      />
      <Text style={[styles.trendText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {Math.abs(value).toFixed(1)}% {positive ? 'above' : 'below'} {comparisonLabel}
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

function impactText(data: PartnerHomeData) {
  const parts = [];
  if (data.impact.customers_served > 0) parts.push(`${data.impact.customers_served} customers served`);
  if (data.impact.claims_assisted > 0) parts.push(`${data.impact.claims_assisted} claims assisted`);
  return parts.length ? parts.join(' · ') : 'Business and service milestones will appear here as they happen.';
}

function todayIcon(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return 'document-text-outline' as const;
  if (kind === 'renewal') return 'refresh-outline' as const;
  return 'shield-outline' as const;
}

function todayIconColor(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return '#9A5B12';
  if (kind === 'renewal') return partnerTheme.colors.brand;
  return partnerTheme.colors.accent;
}

function todayIconTone(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return styles.todayIconWarn;
  if (kind === 'renewal') return styles.todayIconBrand;
  return styles.todayIconAccent;
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

function attentionMeta(data: PartnerHomeData) {
  const count = data.today.reduce((sum, item) => sum + Math.max(item.count || 0, 1), 0);
  if (!count) return 'All clear';
  return `${count} ${count === 1 ? 'item' : 'items'}`;
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
  refreshWarning: { marginBottom: 2 },
  pressed: { opacity: 0.78 },

  todayList: { gap: 8 },
  todayRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  todayIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  todayIconWarn: { backgroundColor: partnerTheme.colors.warningSoft },
  todayIconBrand: { backgroundColor: partnerTheme.colors.brandSoft },
  todayIconAccent: { backgroundColor: partnerTheme.colors.accentSoft },
  todayBody: { flex: 1 },
  todayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayTitle: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  todayCount: {
    minWidth: 24,
    overflow: 'hidden',
    borderRadius: partnerTheme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    color: partnerTheme.colors.brandStrong,
    backgroundColor: partnerTheme.colors.brandSoft,
    textAlign: 'center',
    ...partnerTheme.typography.meta,
  },
  todaySubtitle: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  clearCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: '#F6FCF8',
    borderWidth: 1,
    borderColor: '#D7ECDC',
  },
  clearIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6ED' },
  clearBody: { flex: 1 },
  clearTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  clearText: { marginTop: 3, color: '#5F7967', ...partnerTheme.typography.caption },

  quickGrid: { flexDirection: 'row', gap: 8 },
  quickAction: {
    flex: 1,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 4,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  quickLabel: { marginTop: 5, color: partnerTheme.colors.ink, textAlign: 'center', ...partnerTheme.typography.meta },

  sectionAction: { color: partnerTheme.colors.brand, ...partnerTheme.typography.caption },
  businessCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: partnerTheme.radius.xl,
    padding: 14,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  businessMain: {
    width: '46%',
    paddingRight: 13,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: partnerTheme.colors.line,
  },
  businessEyebrow: { color: partnerTheme.colors.brand, letterSpacing: 0.8, ...partnerTheme.typography.meta },
  businessPremium: { marginTop: 6, color: partnerTheme.colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '800' },
  trend: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { flex: 1, ...partnerTheme.typography.meta },
  trendNeutral: { marginTop: 9, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  businessStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  businessStat: { width: '50%' },
  businessStatValue: { color: partnerTheme.colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  businessStatLabel: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },

  pulseCard: { borderRadius: partnerTheme.radius.xl, padding: 14, backgroundColor: partnerTheme.colors.nav },
  pulseTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  pulseHeading: { flex: 1 },
  pulseEyebrow: { color: '#AAA5FF', letterSpacing: 1.1, ...partnerTheme.typography.meta },
  pulseTitle: { marginTop: 5, color: '#FFFFFF', fontSize: 19, lineHeight: 25, fontWeight: '800' },
  pulseOrb: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#343D52' },
  pulseSignals: { marginTop: 12, flexDirection: 'row', gap: 7 },
  signal: { flex: 1, minHeight: 56, borderRadius: 13, padding: 10, backgroundColor: '#1C2637' },
  signalLabel: { color: '#A6B0C0', ...partnerTheme.typography.meta },
  signalValue: { marginTop: 4, color: '#FFFFFF', ...partnerTheme.typography.caption },
  pulseFooter: {
    marginTop: 14,
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3B4659',
  },
  pulseFooterText: { color: '#D8D6FF', ...partnerTheme.typography.caption },

  characterCard: {
    marginTop: 10,
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: partnerTheme.radius.lg,
    padding: 12,
    backgroundColor: partnerTheme.colors.accentSoft,
  },
  characterIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  characterBody: { flex: 1 },
  characterEyebrow: { color: '#3C7B78', letterSpacing: 0.8, ...partnerTheme.typography.meta },
  characterTitle: { marginTop: 4, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  characterText: { marginTop: 3, color: '#56716F', ...partnerTheme.typography.caption },
  stories: { marginTop: partnerTheme.spacing.md },

  skeletonHeader: {
    marginTop: partnerTheme.spacing.xl,
    marginBottom: partnerTheme.spacing.sm,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skeletonList: { gap: 8 },
});
