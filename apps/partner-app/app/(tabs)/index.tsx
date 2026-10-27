import { useCallback, useRef, useState, useEffect, type ReactNode } from 'react';
import { Animated, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, Platform, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerAnchoredDropdown } from '@/components/ui/partner-anchored-dropdown';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerCommissionEarnedIcon, PartnerPoliciesSoldIcon } from '@/components/ui/partner-home-metric-icons';
import { PartnerEnter } from '@/components/ui/partner-enter';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerProfileAvatar } from '@/components/ui/partner-profile-avatar';
import { PartnerSkeleton } from '@/components/ui/partner-skeleton';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessRange, getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { getPartnerActivity, type PartnerActivityData } from '@/lib/engagement';
import { getPartnerBusinessPerformance, type PartnerBusinessPerformance } from '@/lib/business';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { getPartnerQueryCache } from '@/lib/partner-query-cache';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { signedInPersonName } from '@/lib/signed-in-person';
import { usePartnerSession } from '@/providers/partner-session-provider';

type BusinessPeriod = 'all' | 'last6' | 'last_month' | 'mtd';

const BUSINESS_PERIODS: { key: BusinessPeriod; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'last6', label: 'Last 6 Months' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'mtd', label: 'MTD' },
];

export default function PartnerHomeScreen() {
  const router = useRouter();
  const { context, cacheScopeKey, avatarUri } = usePartnerSession();
  const [businessPeriod, setBusinessPeriod] = useState<BusinessPeriod>('mtd');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [filterSkeletonVisible, setFilterSkeletonVisible] = useState(false);
  const homeScrollY = useRef(new Animated.Value(0)).current;

  const fetchHomeWorkspace = useCallback(async (): Promise<{
    home: PartnerHomeData;
    activity: PartnerActivityData | null;
    performance: PartnerBusinessPerformance | null;
  }> => {
    const [homeResult, activityResult, performanceResult] = await Promise.allSettled([
      getPartnerHome(), getPartnerActivity(3), getPartnerBusinessPerformance(),
    ]);
    if (homeResult.status === 'rejected') throw homeResult.reason;
    return {
      home: homeResult.value,
      activity: activityResult.status === 'fulfilled' ? activityResult.value : null,
      performance: performanceResult.status === 'fulfilled' ? performanceResult.value : null,
    };
  }, []);

  const workspace = usePartnerQuery({
    scopeKey: cacheScopeKey,
    key: 'home:workspace',
    fetcher: fetchHomeWorkspace,
    staleTimeMs: 60_000,
  });

  const businessRange = businessDateRange(businessPeriod);
  const businessQueryKey = `home:business:${businessPeriod}:${businessRange.from}:${businessRange.to}`;
  const fetchBusinessRange = useCallback(
    () => getPartnerBusinessRange(businessRange.from, businessRange.to),
    [businessRange.from, businessRange.to],
  );
  const business = usePartnerQuery({
    scopeKey: cacheScopeKey,
    key: businessQueryKey,
    fetcher: fetchBusinessRange,
    staleTimeMs: 60_000,
  });

  const previousMonthMtdRange = previousMonthMtdDateRange();
  const fetchPreviousMonthMtd = useCallback(
    () => getPartnerBusinessRange(previousMonthMtdRange.from, previousMonthMtdRange.to),
    [previousMonthMtdRange.from, previousMonthMtdRange.to],
  );
  const previousMonthMtd = usePartnerQuery({
    scopeKey: cacheScopeKey,
    key: `home:business:mtd-previous-month:${previousMonthMtdRange.from}:${previousMonthMtdRange.to}`,
    fetcher: fetchPreviousMonthMtd,
    staleTimeMs: 60_000,
  });

  useFocusEffect(
    useCallback(() => {
      void workspace.ensureFresh();
      void business.ensureFresh();
      if (businessPeriod === 'mtd') void previousMonthMtd.ensureFresh();
    }, [workspace.ensureFresh, business.ensureFresh, previousMonthMtd.ensureFresh, businessPeriod]),
  );

  // Show a short visible pulse even for cached periods, without forcing a network call.
  // Uncached periods remain in the skeleton state until their own figures arrive.
  useEffect(() => {
    if (!filterSkeletonVisible) return;
    const timeout = setTimeout(() => setFilterSkeletonVisible(false), 450);
    return () => clearTimeout(timeout);
  }, [businessPeriod, filterSkeletonVisible]);

  if (!context) return null;

  const data = workspace.data?.home ?? null;
  const activity = workspace.data?.activity?.items ?? [];
  const trend = workspace.data?.performance?.trend ?? [];
  const { identity } = context;
  const periodLabel = BUSINESS_PERIODS.find((item) => item.key === businessPeriod)?.label ?? 'MTD';
  // Resolve the selected period from its own cache key. The query hook can still hold
  // figures from the previously selected period during the first render after a switch.
  const rangeData = getPartnerQueryCache<NonNullable<typeof business.data>>(cacheScopeKey, businessQueryKey)?.data ?? null;
  const showBusinessFilterSkeleton = filterSkeletonVisible || (!rangeData && (business.loading || !business.error));

  return (
    <PartnerScreen
      resetScrollOnFocus
      homeMotionScrollY={homeScrollY}
      stickyHeaderNavy
      eyebrow="INSUREIT PARTNER"
      title={greeting(signedInPersonName(identity))}
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
            <PartnerProfileAvatar
              name={signedInPersonName(identity)}
              uri={avatarUri}
              size={38}
              style={styles.avatar}
              textColor="#40359E"
            />
          </Pressable>
        </View>
      }
      scrollProps={{
        refreshControl: (
          <RefreshControl
            refreshing={workspace.refreshing || business.refreshing || (businessPeriod === 'mtd' && previousMonthMtd.refreshing)}
            onRefresh={() => {
              void workspace.refresh();
              void business.refresh();
              if (businessPeriod === 'mtd') void previousMonthMtd.refresh();
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

          <View style={styles.businessCard}>
              <View style={styles.businessTopRow}>
                <View style={styles.periodWrap}>
                  <PartnerAnchoredDropdown
                    visible={periodOpen}
                    onDismiss={() => setPeriodOpen(false)}
                    menuWidth={150}
                    menu={(
                      <View style={styles.periodMenu}>
                        {BUSINESS_PERIODS.map((item) => (
                          <Pressable
                            key={item.key}
                            onPress={() => {
                              if (item.key !== businessPeriod) {
                                setFilterSkeletonVisible(true);
                                setBusinessPeriod(item.key);
                              }
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
                    )}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Business period: ${periodLabel}`}
                      accessibilityState={{ expanded: periodOpen }}
                      onPress={() => setPeriodOpen((value) => !value)}
                      style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.periodButtonText}>{periodLabel}</Text>
                      <Ionicons
                        name={periodOpen ? 'chevron-up' : 'chevron-down'}
                        size={13}
                        color="#17366C"
                      />
                    </Pressable>
                  </PartnerAnchoredDropdown>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View business report"
                  hitSlop={8}
                  onPress={() => router.push('/(tabs)/business')}
                  style={({ pressed }) => [styles.viewReport, pressed && styles.pressed]}
                >
                  <Text style={styles.viewReportText}>View Report</Text>
                  <Ionicons name="chevron-forward" size={14} color="#5F38CF" />
                </Pressable>
              </View>

              {showBusinessFilterSkeleton ? <BusinessFilterSkeleton /> : (<>
              <View style={styles.businessMainRow}>
                <View style={styles.businessMainCopy}>
                  <Text style={styles.businessPremium}>{rangeData ? formatWholeIndianCurrency(rangeData.net_premium) : '—'}</Text>
                  <Text style={styles.businessCaption}>Business Generated (Net Premium)</Text>
                  {business.loading && !rangeData ? (
                    <Text style={styles.trendNeutral}>Updating business figures…</Text>
                  ) : business.error ? (
                    <Text style={styles.rangeError}>Unable to refresh selected period</Text>
                  ) : businessPeriod === 'mtd' && previousMonthMtd.loading && !previousMonthMtd.data ? (
                    <Text style={styles.trendNeutral}>Updating previous month comparison…</Text>
                  ) : businessPeriod === 'mtd' && previousMonthMtd.error ? (
                    <Text style={styles.rangeError}>Unable to refresh previous month comparison</Text>
                  ) : businessPeriod === 'all' && Number(rangeData?.premium_previous_period ?? data.business.premium_last_month ?? 0) <= 0 ? null : businessPeriod === 'mtd' ? (
                    <Trend
                      value={percentageChange(Number(rangeData?.net_premium ?? 0), Number(previousMonthMtd.data?.net_premium ?? 0))}
                      hasPrevious={Number(previousMonthMtd.data?.net_premium ?? 0) > 0}
                      comparisonLabel="previous month"
                    />
                  ) : (
                    <Trend
                      value={Number(rangeData?.premium_change_percent ?? data.business.premium_change_percent ?? 0)}
                      hasPrevious={Number(rangeData?.premium_previous_period ?? data.business.premium_last_month ?? 0) > 0}
                    />
                  )}
                </View>

                <View style={styles.chartSide}>
                  <MiniBusinessTrend values={trend.map((item) => Number(item.premium || 0))} />
                </View>
              </View>

              <View style={styles.businessDivider} />
              <View style={styles.businessBottomRow}>
                <MetricCell
                  icon={<PartnerPoliciesSoldIcon size={36} />}
                  value={rangeData ? String(rangeData.policies) : '—'}
                  label="Policies Sold"
                />
                <View style={styles.metricDivider} />
                <MetricCell
                  icon={<PartnerCommissionEarnedIcon size={36} />}
                  value={identity.actor_kind === 'employee'
                    ? (rangeData?.projected_retention != null ? formatWholeIndianCurrency(rangeData.projected_retention) : '—')
                    : (rangeData?.scoped_payout != null
                      ? formatIndianCurrency(rangeData.scoped_payout)
                      : rangeData?.commission_available
                        ? formatIndianCurrency(rangeData.commission_earned ?? 0)
                        : '—')}
                  label={identity.actor_kind === 'employee' ? 'Projected Retention' : 'Commission Earned'}
                />
              </View>
              </>)}
          </View>

          <PartnerEnter delay={70}>
            <View style={styles.quickCard}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="View all quick actions" onPress={() => router.push('/(tabs)/more')}>
                  <Text style={styles.sectionLink}>View All  ›</Text>
                </Pressable>
              </View>
              <QuickActionsCarousel
                actions={[
                  {
                    key: 'policy-intake',
                    asset: PartnerAssets.actions.quickPolicyIntake,
                    label: 'Policy Intake',
                    onPress: () => router.push('/policy-intake-new'),
                  },
                  {
                    key: 'renewals',
                    asset: PartnerAssets.actions.quickRenewals,
                    label: 'Renewals',
                    onPress: () => router.push('/renewals'),
                  },
                  {
                    key: 'claims',
                    asset: PartnerAssets.actions.quickClaims,
                    label: 'Claims',
                    onPress: () => router.push('/(tabs)/claims'),
                  },
                  {
                    key: 'customers',
                    asset: PartnerAssets.actions.quickCustomers,
                    label: 'Customers',
                    onPress: () => router.push('/customers'),
                  },
                ]}
              />
            </View>
          </PartnerEnter>

          <PartnerEnter delay={120}>
            <PendingTasksCard
              data={data}
              onOpenRenewals={() => router.push('/renewals')}
              onOpenClaims={() => router.push('/(tabs)/claims')}
              onOpenIntakes={() => router.push('/policy-intakes')}
              onViewAll={() => router.push('/activity')}
            />
          </PartnerEnter>

          <PartnerEnter delay={155}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View renewals due soon, ${data.business.renewals_30_days} policies in 30 days`}
              onPress={() => router.push('/renewals')}
              style={({ pressed }) => [styles.renewalCard, pressed && styles.pressed, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Image source={PartnerAssets.actions.quickRenewals} style={styles.renewalIcon} resizeMode="contain" />
              <View style={styles.renewalBody}>
                <Text style={styles.renewalTitle}>Renewals Due Soon</Text>
                <ShrinkLoopText style={styles.renewalMessage}>
                  {data.business.renewals_30_days} policies expiring within 30 days
                </ShrinkLoopText>
              </View>
              <Text style={styles.sectionLink}>View Renewals  ›</Text>
            </Pressable>
          </PartnerEnter>

          <PartnerEnter delay={185}>
            <View style={styles.activityCard}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="View all recent activity" onPress={() => router.push('/activity')}>
                  <Text style={styles.sectionLink}>View All  ›</Text>
                </Pressable>
              </View>
              {activity.length ? activity.slice(0, 3).map((item) => (
                <Pressable
                  key={`${item.kind}-${item.entity_id}-${item.event_at}`}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => router.push(item.route as never)}
                  style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
                >
                  <Ionicons name="document-text" size={25} color="#087DD6" style={styles.activityIcon} />
                  <View style={styles.activityCopy}>
                    <Text numberOfLines={1} style={styles.activityTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.activitySubtitle}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.activityDate}>{formatActivityTime(item.event_at)}</Text>
                  <Ionicons name="chevron-forward" size={12} color="#6480A5" />
                </Pressable>
              )) : (
                <Text style={styles.activityEmpty}>
                  {workspace.data?.activity ? 'No recent activity recorded.' : 'Recent activity is unavailable.'}
                </Text>
              )}
            </View>
          </PartnerEnter>
        </>
      )}
    </PartnerScreen>
  );
}

function PendingTasksCard({
  data, onOpenRenewals, onOpenClaims, onOpenIntakes, onViewAll,
}: {
  data: PartnerHomeData;
  onOpenRenewals: () => void;
  onOpenClaims: () => void;
  onOpenIntakes: () => void;
  onViewAll: () => void;
}) {
  const tasks = [
    { key: 'renewal', count: data.business.renewals_30_days, label: 'Renewals due', icon: PartnerAssets.actions.quickRenewals, open: onOpenRenewals },
    { key: 'intakes', count: data.service.intakes_need_attention, label: 'Policy intakes needing attention', icon: PartnerAssets.actions.quickPolicyIntake, open: onOpenIntakes },
    { key: 'claims', count: data.service.active_claims, label: 'Active claims', icon: PartnerAssets.actions.quickClaims, open: onOpenClaims },
  ];
  return (
    <ImageBackground
      source={require('../../assets/PT2.jpeg')}
      resizeMode="cover"
      imageStyle={styles.pendingBackgroundImage}
      style={styles.pendingCard}
    >
      <View pointerEvents="none" style={styles.pendingBackgroundOverlay} />
      <View style={styles.pendingHeadingRow}>
        <View style={styles.pendingHeadingCopy}>
          <Text style={styles.pendingTitle}>Pending Tasks</Text>
          <Text style={styles.pendingHint}>Keep up with important actions.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="View all pending tasks" onPress={onViewAll}>
          <Text style={styles.sectionLink}>View All  ›</Text>
        </Pressable>
      </View>
      <View style={styles.pendingList}>
        {tasks.map((task) => (
          <Pressable
            key={task.key}
            accessibilityRole="button"
            accessibilityLabel={`${task.count} ${task.label}`}
            onPress={task.open}
            style={({ pressed }) => [styles.pendingTaskRow, pressed && styles.pressed]}
          >
            <Image source={task.icon} style={styles.pendingTaskIcon} resizeMode="contain" />
            <Text style={[styles.pendingTaskCount, task.key === 'renewal' && task.count > 0 && styles.pendingTaskUrgent]}>
              {task.count}
            </Text>
            <Text numberOfLines={1} style={styles.pendingTaskLabel}>{task.label}</Text>
            <Ionicons name="chevron-forward" size={13} color="#193D91" />
          </Pressable>
        ))}
      </View>
    </ImageBackground>
  );
}

function MiniBusinessTrend({ values }: { values: number[] }) {
  const recent = values.slice(-6);
  const max = Math.max(1, ...recent);
  return (
    <View style={styles.miniChart} accessibilityLabel="Recent premium trend">
      {recent.length ? recent.map((value, index) => (
        <View key={index} style={[styles.miniBar, {
          height: Math.max(4, Math.round(Math.max(0, value) / max * 43)),
        }]} />
      )) : <Text style={styles.chartUnavailable}>Trend unavailable</Text>}
    </View>
  );
}

function formatActivityTime(value: string) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(time);
}

function MetricCell({
  asset,
  icon,
  value,
  label,
}: {
  asset?: number;
  icon?: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metricCell}>
      <View style={styles.metricIconBox}>
        {icon ?? (asset ? <Image source={asset} style={styles.metricImage} resizeMode="contain" /> : null)}
      </View>
      <View style={styles.metricCopy}>
        <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );
}

const QUICK_ACTION_WIDTH = 94;
const QUICK_ACTION_GAP = 7;
const QUICK_ACTION_STEP = QUICK_ACTION_WIDTH + QUICK_ACTION_GAP;

function QuickAction({
  asset, label, onPress, index, scrollX, viewportWidth,
}: {
  asset: number; label: string; onPress: () => void;
  index: number; scrollX: Animated.Value; viewportWidth: number;
}) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const animatePress = (pressed: boolean) => {
    Animated.spring(pressScale, {
      toValue: pressed ? 0.96 : 1, useNativeDriver: true,
      speed: 28, bounciness: 5,
    }).start();
  };
  // Only the icon gains focus as it crosses the carousel's fixed center point.
  const centeredOffset = index * QUICK_ACTION_STEP + QUICK_ACTION_WIDTH / 2 - viewportWidth / 2;
  const inputRange = [
    centeredOffset - QUICK_ACTION_STEP * 2,
    centeredOffset - QUICK_ACTION_STEP,
    centeredOffset,
    centeredOffset + QUICK_ACTION_STEP,
    centeredOffset + QUICK_ACTION_STEP * 2,
  ];
  const iconScale = scrollX.interpolate({
    inputRange, outputRange: [1, 1.05, 1.25, 1.05, 1], extrapolate: 'clamp',
  });
  const highlightOpacity = scrollX.interpolate({
    inputRange, outputRange: [0, 0.08, 1, 0.08, 0], extrapolate: 'clamp',
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      style={styles.quickActionTouch}
    >
      <View style={styles.quickAction}>
        <Animated.View style={{ alignItems: 'center', transform: [{ scale: pressScale }] }}>
          <Animated.View style={[styles.quickIcon, { transform: [{ scale: iconScale }] }]}>
            <Animated.View pointerEvents="none" style={[styles.quickIconFocus, { opacity: highlightOpacity }]} />
            <Image source={asset} style={styles.quickImage} resizeMode="contain" />
          </Animated.View>
          <Text numberOfLines={2} style={styles.quickLabel}>{label}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function QuickActionsCarousel({
  actions,
}: {
  actions: Array<{ key: string; asset: number; label: string; onPress: () => void }>;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [viewportWidth, setViewportWidth] = useState(0);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const draggingRef = useRef(false);
  const touchingRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      // Keep iOS carousel stationary between user gestures so its moving
      // native scroll surface cannot compete with Home button presses.
      // Android retains the existing automatic carousel motion.
      if (Platform.OS === 'ios' || draggingRef.current || touchingRef.current || loopWidthRef.current <= 0) return;
      const next = offsetRef.current + 0.75;
      offsetRef.current = next >= loopWidthRef.current ? next - loopWidthRef.current : next;
      scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
    }, 24);

    return () => {
      clearInterval(timer);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const pauseForTouch = () => {
    touchingRef.current = true;
    draggingRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const resumeAfterTouch = () => {
    touchingRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      draggingRef.current = false;
    }, 1200);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      contentContainerStyle={styles.quickGrid}
      directionalLockEnabled
      onTouchStart={pauseForTouch}
      onTouchEnd={resumeAfterTouch}
      onTouchCancel={resumeAfterTouch}
      keyboardShouldPersistTaps="always"
      scrollEventThrottle={16}
      onContentSizeChange={(width) => {
        loopWidthRef.current = width / 2;
      }}
      onScroll={(event) => {
        offsetRef.current = event.nativeEvent.contentOffset.x;
        if (loopWidthRef.current > 0 && offsetRef.current >= loopWidthRef.current) {
          offsetRef.current -= loopWidthRef.current;
          scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
        }
        scrollX.setValue(offsetRef.current);
      }}
      onScrollBeginDrag={() => { draggingRef.current = true; }}
      onScrollEndDrag={resumeAfterTouch}
      onMomentumScrollEnd={resumeAfterTouch}
    >
      {[...actions, ...actions].map((action, index) => (
        <QuickAction
          key={`${action.key}-${index}`}
          asset={action.asset}
          label={action.label}
          onPress={action.onPress}
          index={index}
          scrollX={scrollX}
          viewportWidth={viewportWidth}
        />
      ))}
    </ScrollView>
  );
}


function Trend({ value, hasPrevious, comparisonLabel = 'previous period' }: { value: number; hasPrevious: boolean; comparisonLabel?: string }) {
  if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison period</Text>;
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Ionicons
        name={positive ? 'trending-up' : 'trending-down'}
        size={13}
        color={positive ? '#1D9C60' : '#C27A11'}
      />
      <ShrinkLoopText style={[styles.trendText, { color: positive ? '#1D9C60' : '#C27A11' }]}>
        {Math.round(Math.abs(value))}% {positive ? 'above' : 'below'} {comparisonLabel}
      </ShrinkLoopText>
    </View>
  );
}

function ShrinkLoopText({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 650, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [scale]);

  return (
    <Animated.Text style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.Text>
  );
}

function formatWholeIndianCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(safeAmount)}`;
}

function percentageChange(current: number, previous: number) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  return current > 0 ? 100 : 0;
}

function previousMonthMtdDateRange() {
  const now = new Date();
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const comparableDay = Math.min(now.getDate(), previousMonthLastDay);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, comparableDay);
  return { from: localDate(previousMonthStart), to: localDate(previousMonthEnd) };
}

function businessDateRange(period: BusinessPeriod) {
  const now = new Date();
  const today = localDate(now);
  if (period === 'all') return { from: '2000-01-01', to: today };
  if (period === 'mtd') return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (period === 'last6') return { from: localDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: today };
  if (period === 'last_month') {
    return {
      from: localDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: localDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
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


function formatCacheTime(value: number | null) {
  if (!value) return 'earlier';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

// Show only when a newly selected period has no cached figures.
// The business-card header stays interactive and all other Home content stays visible.
function BusinessFilterSkeleton() {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity }}>
      <View style={styles.businessMainRow}>
        <View style={[styles.businessMainCopy, { gap: 7, justifyContent: 'center' }]}>
          <PartnerSkeleton width="78%" height={30} radius={8} />
          <PartnerSkeleton width="72%" height={12} radius={5} />
          <PartnerSkeleton width="52%" height={11} radius={5} />
        </View>
        <View style={[styles.chartSide, { flexDirection: 'row', alignItems: 'flex-end', gap: 5, justifyContent: 'flex-end' }]}>
          {[13, 20, 27, 39, 49, 34].map((height, index) => (
            <PartnerSkeleton key={index} width={11} height={height} radius={4} />
          ))}
        </View>
      </View>
      <View style={styles.businessDivider} />
      <View style={styles.businessBottomRow}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <PartnerSkeleton width={36} height={36} radius={18} />
          <View style={{ flex: 1, gap: 7 }}>
            <PartnerSkeleton width="75%" height={17} radius={6} />
            <PartnerSkeleton width="90%" height={10} radius={5} />
          </View>
        </View>
        <View style={styles.metricDivider} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <PartnerSkeleton width={36} height={36} radius={18} />
          <View style={{ flex: 1, gap: 7 }}>
            <PartnerSkeleton width="75%" height={17} radius={6} />
            <PartnerSkeleton width="90%" height={10} radius={5} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <PartnerSkeleton height={176} radius={18} />
      <PartnerSkeleton height={116} radius={18} />
      <PartnerSkeleton height={96} radius={18} />
      <PartnerSkeleton height={82} radius={18} />
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
  pressed: { opacity: 0.7 },
  refreshWarning: { marginBottom: 10 },
  skeletonWrap: { gap: 12 },

  businessCard: {
    position: 'relative',
    // iOS must not elevate the whole business card above adjacent touch targets.
    zIndex: Platform.OS === 'ios' ? 0 : 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE4EF',
    shadowColor: '#16345E',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  businessTopRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodWrap: { position: 'relative', zIndex: Platform.OS === 'ios' ? 0 : 10 },
  periodButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 3 },
  periodButtonText: { color: '#17366C', fontSize: 13, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  periodMenu: {
    overflow: 'hidden',
    borderRadius: 12,
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
  periodOptionText: { color: partnerTheme.colors.inkMuted, fontSize: 12, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  periodOptionTextActive: { color: partnerTheme.colors.brand, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  viewReport: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 1 },
  viewReportText: { color: '#5F38CF', fontSize: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  businessMainRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  businessMainCopy: { flex: 1, minWidth: 0 },
  businessPremium: {
    color: '#182338',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: Platform.OS === 'ios' ? '400' : '800',
    letterSpacing: -0.7,
  },
  businessCaption: { marginTop: 1, color: '#4F5D71', fontSize: 10.5, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  trend: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 9.5, fontWeight: Platform.OS === 'ios' ? '400' : '700' },
  trendNeutral: { marginTop: 3, color: '#8691A2', fontSize: 9.5, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  rangeError: { marginTop: 3, color: partnerTheme.colors.danger, fontSize: 9.5, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  businessDivider: { height: StyleSheet.hairlineWidth, marginTop: 6, backgroundColor: '#DCE4EF' },
  businessBottomRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center' },
  metricCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 38, marginHorizontal: 12, backgroundColor: '#C9D4E2' },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF7FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDEFFF',
  },
  metricImage: { width: 29, height: 29 },
  metricCopy: { flex: 1, minWidth: 0 },
  metricValue: { color: '#17366C', fontSize: 15, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  metricLabel: { marginTop: 1, color: '#7B8799', fontSize: 8.5, fontWeight: Platform.OS === 'ios' ? '400' : '600' },

  quickCard: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4EAF2',
  },
  sectionTitle: { marginBottom: 9, color: '#17233A', fontSize: 13, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  quickGrid: { flexDirection: 'row', gap: QUICK_ACTION_GAP, paddingRight: 2, paddingVertical: 7 },
  quickActionTouch: { width: QUICK_ACTION_WIDTH, flexShrink: 0 },
  quickAction: {
    height: 72,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFD',
  },
  quickIconFocus: { ...StyleSheet.absoluteFillObject, borderRadius: 12, backgroundColor: '#DCEBFF' },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  quickImage: { width: 31, height: 31 },
  quickLabel: {
    marginTop: 4,
    color: '#24324A',
    fontSize: 8.5,
    lineHeight: 10.5,
    fontWeight: Platform.OS === 'ios' ? '400' : '700',
    textAlign: 'center',
  },

  pendingCard: {
    position: 'relative',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#EAF5FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D3EAFB',
    minHeight: 134,
  },
  pendingBackgroundImage: { borderRadius: 15 },
  pendingBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(231,244,255,0.12)',
  },
  pendingHeadingRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pendingHeadingCopy: { flex: 1, paddingRight: 8 },
  pendingTitle: { color: '#123A8B', fontSize: 13, lineHeight: 16, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  pendingHint: { marginTop: 1, color: '#56749B', fontSize: 8.5, lineHeight: 10.5, fontWeight: Platform.OS === 'ios' ? '400' : '500' },
  pendingList: {
    position: 'relative',
    marginTop: 5,
    width: '58%',
    gap: 2,
  },
  pendingTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 23,
    paddingHorizontal: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    gap: 5,
  },
  pendingTaskIcon: { width: 15, height: 15 },
  pendingTaskCount: { color: '#153B80', fontSize: 10, fontWeight: Platform.OS === 'ios' ? '400' : '800', minWidth: 17 },
  pendingTaskUrgent: { color: '#E0444D' },
  pendingTaskLabel: { flex: 1, minWidth: 0, color: '#294872', fontSize: 8, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  sectionLink: { color: '#3156B8', fontSize: 9, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  chartSide: { width: 132, alignItems: 'flex-end', justifyContent: 'center' },
  miniChart: { height: 43, width: 130, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 5, borderBottomWidth: 1, borderColor: '#E1EAF6' },
  miniBar: { width: 14, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#A6C6ED' },
  chartUnavailable: { fontSize: 8, color: '#7A8DAA', alignSelf: 'center' },
  renewalCard: { marginBottom: 8, minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 10, backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E3EBF5' },
  renewalIcon: { width: 34, height: 34 },
  renewalBody: { flex: 1, minWidth: 0 },
  renewalTitle: { color: '#17366C', fontSize: 11, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  renewalMessage: { color: '#D34A54', fontSize: 9, marginTop: 2 },
  activityCard: { marginBottom: 12, padding: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3EBF5', borderRadius: 14 },
  activityRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E9EFF6' },
  activityIcon: { width: 26, height: 26 },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: '#17366C', fontSize: 10, fontWeight: Platform.OS === 'ios' ? '400' : '800' },
  activitySubtitle: { color: '#75869E', fontSize: 8.5, marginTop: 2 },
  activityDate: { color: '#8A98AE', fontSize: 8 },
  activityEmpty: { paddingVertical: 15, color: '#7B8DA7', fontSize: 10 },
});