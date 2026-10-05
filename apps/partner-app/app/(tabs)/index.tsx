import { useCallback, useState, type ComponentProps } from 'react';
import { Animated, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { StoryRail } from '@/components/story-rail';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerEnter } from '@/components/ui/partner-enter';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerSkeleton } from '@/components/ui/partner-skeleton';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessRange, getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { getPartnerStories, type PartnerStory } from '@/lib/stories';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

type BusinessPeriod = 'all' | 'last6' | 'mtd' | 'month';
type IoniconName = ComponentProps<typeof Ionicons>['name'];

const BUSINESS_PERIODS: { key: BusinessPeriod; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'last6', label: 'Last 6 Months' },
  { key: 'mtd', label: 'MTD' },
  { key: 'month', label: 'This Month' },
];

export default function PartnerHomeScreen() {
  const router = useRouter();
  const { context, cacheScopeKey } = usePartnerSession();
  const [businessPeriod, setBusinessPeriod] = useState<BusinessPeriod>('month');
  const [periodOpen, setPeriodOpen] = useState(false);

  const fetchHomeWorkspace = useCallback(async (): Promise<{ home: PartnerHomeData; stories: PartnerStory[] }> => {
    const [homeResult, storiesResult] = await Promise.allSettled([getPartnerHome(), getPartnerStories()]);
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

  const businessRange = businessDateRange(businessPeriod);
  const fetchBusinessRange = useCallback(
    () => getPartnerBusinessRange(businessRange.from, businessRange.to),
    [businessRange.from, businessRange.to],
  );
  const business = usePartnerQuery({
    scopeKey: cacheScopeKey,
    key: `home:business:${businessPeriod}:${businessRange.from}:${businessRange.to}`,
    fetcher: fetchBusinessRange,
    staleTimeMs: 60_000,
  });

  useFocusEffect(
    useCallback(() => {
      void workspace.ensureFresh();
      void business.ensureFresh();
    }, [workspace.ensureFresh, business.ensureFresh]),
  );

  if (!context) return null;

  const data = workspace.data?.home ?? null;
  const stories = workspace.data?.stories ?? [];
  const { identity } = context;
  const periodLabel = BUSINESS_PERIODS.find((item) => item.key === businessPeriod)?.label ?? 'This Month';
  const rangeData = business.data;

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
            refreshing={workspace.refreshing || business.refreshing}
            onRefresh={() => {
              void workspace.refresh();
              void business.refresh();
            }}
            tintColor={partnerTheme.colors.brand}
            colors={[partnerTheme.colors.brand]}
          />
        ),
      }}
    >
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
                message={
                  workspace.stale
                    ? `Last refreshed ${formatCacheTime(workspace.updatedAt)}. Pull down to try again.`
                    : workspace.error
                }
              />
            </View>
          ) : null}

          <PartnerEnter delay={20}>
            <View style={styles.businessCard}>
              <View style={styles.businessTopRow}>
                <View style={styles.periodWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Business period: ${periodLabel}`}
                    onPress={() => setPeriodOpen((value) => !value)}
                    style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.periodButtonText}>{periodLabel}</Text>
                    <Ionicons
                      name={periodOpen ? 'chevron-up' : 'chevron-down'}
                      size={12}
                      color="#17366C"
                    />
                  </Pressable>
                  {periodOpen ? (
                    <View style={styles.periodMenu}>
                      {BUSINESS_PERIODS.map((item) => (
                        <Pressable
                          key={item.key}
                          onPress={() => {
                            setBusinessPeriod(item.key);
                            setPeriodOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.periodOption,
                            item.key === businessPeriod && styles.periodOptionActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.periodOptionText,
                              item.key === businessPeriod && styles.periodOptionTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.key === businessPeriod ? (
                            <Ionicons name="checkmark" size={14} color={partnerTheme.colors.brand} />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View business report"
                  hitSlop={8}
                  onPress={() => router.push('/(tabs)/business')}
                  style={({ pressed }) => [styles.viewReport, pressed && styles.pressed]}
                >
                  <Text style={styles.viewReportText}>View Report</Text>
                  <Ionicons name="chevron-forward" size={12} color="#5F38CF" />
                </Pressable>
              </View>

              <View style={styles.businessMainRow}>
                <View style={styles.businessMainCopy}>
                  <Text style={styles.businessPremium}>{formatIndianCurrency(rangeData?.net_premium ?? 0)}</Text>
                  <Text style={styles.businessCaption}>Net Premium</Text>
                  {business.loading && !rangeData ? (
                    <Text style={styles.trendNeutral}>Updating business figures…</Text>
                  ) : business.error ? (
                    <Text style={styles.rangeError}>Unable to refresh selected period</Text>
                  ) : (
                    <Trend
                      value={Number(rangeData?.premium_change_percent ?? data.business.premium_change_percent ?? 0)}
                      hasPrevious={Number(rangeData?.premium_previous_period ?? data.business.premium_last_month ?? 0) > 0}
                      isMonth={businessPeriod === 'month'}
                    />
                  )}
                </View>

                <View style={styles.chartTile} accessibilityLabel="Business performance">
                  <Ionicons name="stats-chart" size={38} color="#0B82E6" />
                  <View style={styles.chartArrowBadge}>
                    <Ionicons name="arrow-up" size={14} color="#0B82E6" />
                  </View>
                </View>
              </View>

              <View style={styles.businessDivider} />
              <View style={styles.businessBottomRow}>
                <MetricCell
                  icon="documents"
                  value={String(rangeData?.policies ?? data.business.policies_this_month)}
                  label="Policies Sold"
                />
                <View style={styles.metricDivider} />
                <MetricCell
                  icon="cash"
                  value={rangeData?.commission_available ? formatIndianCurrency(rangeData.commission_earned ?? 0) : '—'}
                  label="Commission Earned"
                />
              </View>
            </View>
          </PartnerEnter>

          <PartnerEnter delay={70}>
            <View style={styles.quickCard}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickGrid}>
                <QuickAction
                  icon="document-text"
                  badgeIcon="add-circle"
                  label="Policy Intake"
                  onPress={() => router.push('/policy-intake-new')}
                />
                <QuickAction
                  icon="document-text"
                  badgeIcon="refresh-circle"
                  label="Renewals"
                  onPress={() => router.push('/renewals')}
                />
                <QuickAction
                  icon="document-text"
                  badgeIcon="checkmark-circle"
                  label="Claims"
                  onPress={() => router.push('/(tabs)/claims')}
                />
                <QuickAction
                  icon="people"
                  badgeIcon="person-add"
                  label="Customers"
                  onPress={() => router.push('/customers')}
                />
              </View>
            </View>
          </PartnerEnter>

          <PartnerEnter delay={120}>
            <PendingTasksCard data={data} onOpenClaims={() => router.push('/(tabs)/claims')} />
          </PartnerEnter>

          {stories.length ? (
            <PartnerEnter delay={170}>
              <View style={styles.storiesWrap}>
                <StoryRail stories={stories} />
              </View>
            </PartnerEnter>
          ) : null}
        </>
      )}
    </PartnerScreen>
  );
}

function PendingTasksCard({ data, onOpenClaims }: { data: PartnerHomeData; onOpenClaims: () => void }) {
  const claimTask = data.today.find((item) => item.kind === 'claim');
  const count = claimTask?.count ?? data.service.active_claims;
  const title = count > 0 ? `${count} active ${count === 1 ? 'claim' : 'claims'}` : 'No active claims';
  const subtitle = count > 0 ? 'Keep an eye on service progress.' : 'Nothing needs your attention right now.';

  return (
    <View style={styles.pendingCard}>
      <View style={styles.pendingHeadingRow}>
        <View style={styles.pendingHeadingCopy}>
          <Text style={styles.pendingTitle}>Pending Tasks</Text>
          <Text style={styles.pendingHint}>Keep up with important actions.</Text>
        </View>
        <View style={styles.pendingDecor} pointerEvents="none">
          <Ionicons name="clipboard-outline" size={55} color="#92CAE9" />
          <View style={styles.pendingDecorCheck}>
            <Ionicons name="checkmark-circle" size={22} color="#B4DCF2" />
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={onOpenClaims}
        style={({ pressed }) => [styles.pendingRow, pressed && styles.pressed]}
      >
        <View style={styles.pendingIconBox}>
          <Ionicons name="clipboard" size={20} color="#147DD8" />
        </View>
        <View style={styles.pendingCountBadge}>
          <Text style={styles.pendingCountText}>{count}</Text>
        </View>
        <View style={styles.pendingCopy}>
          <Text style={styles.pendingRowTitle}>{title}</Text>
          <Text style={styles.pendingRowSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#2C56A2" />
      </Pressable>
    </View>
  );
}

function MetricCell({ icon, value, label }: { icon: IoniconName; value: string; label: string }) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricIconBox}>
        <Ionicons name={icon} size={20} color="#147DD8" />
      </View>
      <View style={styles.metricCopy}>
        <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  badgeIcon,
  label,
  onPress,
}: {
  icon: IoniconName;
  badgeIcon: IoniconName;
  label: string;
  onPress: () => void;
}) {
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
        <View style={styles.quickIcon}>
          <View style={styles.quickIconGlow} />
          <Ionicons name={icon} size={26} color="#087DD9" />
          <View style={styles.quickBadge}>
            <Ionicons name={badgeIcon} size={13} color="#0A77CE" />
          </View>
        </View>
        <Text numberOfLines={2} style={styles.quickLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function Trend({ value, hasPrevious, isMonth }: { value: number; hasPrevious: boolean; isMonth: boolean }) {
  if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison period</Text>;
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Ionicons
        name={positive ? 'trending-up' : 'trending-down'}
        size={11}
        color={positive ? '#1D9C60' : '#C27A11'}
      />
      <Text style={[styles.trendText, { color: positive ? '#1D9C60' : '#C27A11' }]}>
        {Math.abs(value).toFixed(1)}% {positive ? 'above' : 'below'} {isMonth ? 'last month' : 'previous period'}
      </Text>
    </View>
  );
}

function businessDateRange(period: BusinessPeriod) {
  const now = new Date();
  const today = localDate(now);
  if (period === 'all') return { from: '2000-01-01', to: today };
  if (period === 'mtd') return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (period === 'last6') return { from: localDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: today };
  return {
    from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function localDate(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function greeting(name: string) {
  const displayName = name.trim() || 'Partner';
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  return `${prefix} ${displayName}`;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IP';
}

function formatCacheTime(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function HomeSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <PartnerSkeleton height={164} radius={16} />
      <PartnerSkeleton height={104} radius={16} />
      <PartnerSkeleton height={88} radius={16} />
      <PartnerSkeleton height={82} radius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarTouch: { borderRadius: 18 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D5DEEB',
  },
  avatarText: { color: '#40359E', fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  refreshWarning: { marginBottom: 9 },
  skeletonWrap: { gap: 10 },

  businessCard: {
    position: 'relative',
    zIndex: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE5EE',
    shadowColor: '#16345E',
    shadowOpacity: 0.055,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  businessTopRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodWrap: { position: 'relative', zIndex: 10 },
  periodButton: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 2 },
  periodButtonText: { color: '#17366C', fontSize: 11.5, fontWeight: '800' },
  periodMenu: {
    position: 'absolute',
    top: 27,
    left: 0,
    width: 150,
    overflow: 'hidden',
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE4EF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#16345E',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  periodOption: {
    minHeight: 40,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodOptionActive: { backgroundColor: '#F0F6FF' },
  periodOptionText: { color: partnerTheme.colors.inkMuted, fontSize: 12, fontWeight: '600' },
  periodOptionTextActive: { color: partnerTheme.colors.brand, fontWeight: '800' },
  viewReport: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 1 },
  viewReportText: { color: '#5F38CF', fontSize: 9.2, fontWeight: '800' },
  businessMainRow: {
    marginTop: 2,
    minHeight: 77,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  businessMainCopy: { flex: 1, minWidth: 0 },
  businessPremium: {
    color: '#172239',
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.65,
  },
  businessCaption: { marginTop: 0, color: '#4F5D71', fontSize: 9.3, fontWeight: '600' },
  chartTile: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7FF',
  },
  chartArrowBadge: {
    position: 'absolute',
    right: 7,
    top: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7FF',
  },
  trend: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  trendText: { fontSize: 8.2, fontWeight: '700' },
  trendNeutral: { marginTop: 6, color: '#8691A2', fontSize: 8.2, fontWeight: '600' },
  rangeError: { marginTop: 6, color: partnerTheme.colors.danger, fontSize: 8.2, fontWeight: '600' },
  businessDivider: { height: StyleSheet.hairlineWidth, marginTop: 5, backgroundColor: '#BFD3E9' },
  businessBottomRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  metricCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  metricDivider: { width: 1, height: 31, marginHorizontal: 9, backgroundColor: '#C5D1E0' },
  metricIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7FF',
  },
  metricCopy: { flex: 1, minWidth: 0 },
  metricValue: { color: '#17366C', fontSize: 13.5, lineHeight: 16, fontWeight: '800' },
  metricLabel: { marginTop: 1, color: '#78859A', fontSize: 7.5, lineHeight: 9, fontWeight: '600' },

  quickCard: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 9,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E9F0',
  },
  sectionTitle: { marginBottom: 7, color: '#17233A', fontSize: 11.5, lineHeight: 14, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', gap: 6 },
  quickActionTouch: { flex: 1, minWidth: 0 },
  quickAction: {
    height: 61,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FAFE',
  },
  quickIcon: {
    position: 'relative',
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EAF7FF',
    shadowColor: '#2A9BE8',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7FF',
  },
  quickLabel: {
    marginTop: 3,
    color: '#21304A',
    fontSize: 7.6,
    lineHeight: 9.2,
    fontWeight: '700',
    textAlign: 'center',
  },

  pendingCard: {
    position: 'relative',
    marginBottom: 6,
    paddingHorizontal: 11,
    paddingTop: 9,
    paddingBottom: 8,
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#E3F3FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D5EAFB',
  },
  pendingHeadingRow: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pendingHeadingCopy: { paddingRight: 74 },
  pendingTitle: { color: '#17366C', fontSize: 11.5, lineHeight: 14, fontWeight: '800' },
  pendingHint: { marginTop: 1, color: '#68809B', fontSize: 8.1, lineHeight: 10, fontWeight: '500' },
  pendingDecor: {
    position: 'absolute',
    right: 1,
    top: -6,
    width: 64,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.72,
  },
  pendingDecorCheck: { position: 'absolute', right: 2, bottom: 5 },
  pendingRow: {
    minHeight: 42,
    marginTop: 1,
    paddingRight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  pendingIconBox: {
    width: 27,
    height: 27,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6FBFF',
  },
  pendingCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  pendingCountText: { color: '#E05050', fontSize: 10.2, fontWeight: '800' },
  pendingCopy: { flex: 1, minWidth: 0 },
  pendingRowTitle: { color: '#25344C', fontSize: 9.4, lineHeight: 12, fontWeight: '800' },
  pendingRowSubtitle: { marginTop: 1, color: '#728198', fontSize: 7.4, lineHeight: 9.2, fontWeight: '500' },

  storiesWrap: { marginTop: 5, marginBottom: 4 },
});
