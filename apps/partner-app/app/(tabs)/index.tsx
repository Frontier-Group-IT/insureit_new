import { useCallback, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryRail } from '@/components/story-rail';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerEnter } from '@/components/ui/partner-enter';
import { PartnerSkeleton } from '@/components/ui/partner-skeleton';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerStatBlock } from '@/components/ui/partner-stat-block';
import { getPartnerActivity, type PartnerActivityData } from '@/lib/engagement';
import { formatIndianCurrency } from '@/lib/format';
import { getPartnerBusinessRange, getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { getPartnerStories, type PartnerStory } from '@/lib/stories';
import { partnerTheme } from '@/lib/theme';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type CommissionRange = {
  policies: number;
  commission_available?: boolean;
  commission_earned?: number | string | null;
};

type HomeWorkspace = {
  home: PartnerHomeData;
  stories: PartnerStory[];
  activity: PartnerActivityData['items'];
  currentMonth: CommissionRange | null;
};

type DashboardIconName =
  | 'activity'
  | 'alert-circle'
  | 'bell'
  | 'chevron-down'
  | 'chevron-right'
  | 'clipboard'
  | 'credit-card'
  | 'file-plus'
  | 'file-text'
  | 'refresh-cw'
  | 'search'
  | 'shield'
  | 'trending-down'
  | 'trending-up'
  | 'upload-cloud'
  | 'users'
  | 'x-circle';

const GeneratedDashboardAssets = {
  policyAdd: require('../../assets/generated-dashboard/policy-add.png'),
  policySold: require('../../assets/generated-dashboard/policy-sold.png'),
  commissionEarned: require('../../assets/generated-dashboard/commission-earned.png'),
  renewalAdd: require('../../assets/generated-dashboard/renewal-add.png'),
  policyVerified: require('../../assets/generated-dashboard/policy-verified.png'),
  renewalDue: require('../../assets/generated-dashboard/renewal-due.png'),
  homeHeader: require('../../assets/generated-dashboard/home-header-insurance.jpg'),
  pendingTasks: require('../../assets/generated-dashboard/pending-tasks-illustration.jpg'),
  pendingDocument: require('../../assets/generated-dashboard/pending-document-alert.png'),
} as const;

export default function PartnerHomeDashboard() {
  const router = useRouter();
  const { context, cacheScopeKey } = usePartnerSession();
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHomeWorkspace = useCallback(async (): Promise<HomeWorkspace> => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [homeResult, storiesResult, activityResult, currentMonthResult] = await Promise.allSettled([
      getPartnerHome(),
      getPartnerStories(),
      getPartnerActivity(6),
      getPartnerBusinessRange(toLocalDateKey(monthStart), toLocalDateKey(today)),
    ]);

    if (homeResult.status === 'rejected') throw homeResult.reason;
    return {
      home: homeResult.value,
      stories: storiesResult.status === 'fulfilled' ? storiesResult.value.items : [],
      activity: activityResult.status === 'fulfilled' ? activityResult.value.items.slice(0, 3) : [],
      currentMonth: currentMonthResult.status === 'fulfilled'
        ? currentMonthResult.value as CommissionRange
        : null,
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
  const activity = workspace.data?.activity ?? [];
  const currentMonth = workspace.data?.currentMonth ?? null;

  if (!context) return null;

  const { identity } = context;
  const pendingItems = data?.today.filter((item) => item.kind !== 'renewal').slice(0, 3) ?? [];
  const displayName = identity.display_name.trim() || 'Partner';

  const submitSearch = () => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(query)}` as never);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={workspace.refreshing}
            onRefresh={() => void workspace.refresh()}
            tintColor="#FFFFFF"
            colors={[partnerTheme.colors.brand]}
          />
        }
      >
        <View style={styles.hero}>
          <Image
            source={GeneratedDashboardAssets.homeHeader}
            style={styles.heroBackdrop}
            resizeMode="cover"
          />
          <View style={styles.heroBackdropShade} />
          <View style={styles.heroTopRow}>
            <Image
              source={require('../../assets/insureit-partner-official.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View recent activity"
                onPress={() => router.push('/activity')}
                style={({ pressed }) => [styles.heroIconButton, pressed && styles.pressed]}
              >
                <Feather name="bell" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => router.push('/profile')}
                style={({ pressed }) => [styles.heroAvatar, pressed && styles.pressed]}
              >
                <Text style={styles.heroAvatarText}>{initials(identity.display_name)}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.heroGreeting}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={styles.heroGreetingText}
            >
              {dayGreeting()} {displayName}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.searchShell}>
            <Feather name="search" size={21} color={partnerTheme.colors.brandStrong} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={submitSearch}
              placeholder="Search customer, vehicle number or policy number..."
              placeholderTextColor="#7E8BA1"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchInput}
              accessibilityLabel="Search customers, vehicles and policies"
            />
            {searchQuery.length ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x-circle" size={18} color="#9AA7B8" />
              </Pressable>
            ) : null}
            <View style={styles.searchDivider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show search results"
              onPress={submitSearch}
              disabled={searchQuery.trim().length < 2}
              style={({ pressed }) => [styles.searchAction, pressed && styles.pressed]}
            >
              <Text style={[styles.searchActionText, searchQuery.trim().length < 2 && styles.searchActionDisabled]}>Search</Text>
              <Feather name="chevron-right" size={15} color={searchQuery.trim().length < 2 ? '#B6BFCC' : partnerTheme.colors.brand} />
            </Pressable>
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
                <View style={styles.businessCard}>
                  <View style={styles.sectionTopRow}>
                    <View style={styles.periodLabelWrap}>
                      <Text style={styles.periodLabel}>This Month</Text>
                      <Feather name="chevron-down" size={13} color="#123E83" />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View business report"
                      hitSlop={8}
                      onPress={() => router.push('/(tabs)/business')}
                      style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}
                    >
                      <Text style={styles.inlineActionText}>View Report</Text>
                      <Feather name="chevron-right" size={14} color={partnerTheme.colors.brand} />
                    </Pressable>
                  </View>

                  <View style={styles.businessMainRow}>
                    <View style={styles.businessMainCopy}>
                      <Text style={styles.businessPremium}>
                        {currencyParts(data.business.premium_this_month).whole}
                        {currencyParts(data.business.premium_this_month).fraction ? (
                          <Text style={styles.businessPremiumFraction}>.{currencyParts(data.business.premium_this_month).fraction}</Text>
                        ) : null}
                      </Text>
                      <Text style={styles.businessCaption}>Business Generated</Text>
                      <Trend
                        value={Number(data.business.premium_change_percent || 0)}
                        hasPrevious={Number(data.business.premium_last_month || 0) > 0}
                      />
                    </View>
                    <MiniBusinessChart />
                  </View>

                  <View style={styles.businessStats}>
                    <DashboardMetric
                      asset={GeneratedDashboardAssets.policySold}
                      value={currentMonth?.policies ?? data.business.policies_this_month}
                      label="Policies Sold"
                    />
                    <View style={styles.statVisualDivider} />
                    <DashboardMetric
                      asset={GeneratedDashboardAssets.commissionEarned}
                      value={currentMonth?.commission_available
                        ? formatCompactIndianAmount(currentMonth.commission_earned)
                        : '—'}
                      label="Commission Earned"
                    />
                  </View>
                </View>
              </PartnerEnter>

              <PartnerEnter delay={60}>
                <View style={styles.quickSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                  </View>
                  <View style={styles.quickGrid}>
                    <QuickAction icon="file-plus" label="Policy Intake" onPress={() => router.push('/policy-intake-new')} />
                    <QuickAction icon="refresh-cw" label="Renewals" onPress={() => router.push('/renewals')} />
                    <QuickAction icon="shield" label="Claims" onPress={() => router.push('/(tabs)/claims')} />
                    <QuickAction icon="users" label="Customers" onPress={() => router.push('/customers')} />
                  </View>
                </View>
              </PartnerEnter>

              {pendingItems.length ? (
                <PartnerEnter delay={100}>
                  <View style={styles.pendingCard}>
                    <Image
                      source={GeneratedDashboardAssets.pendingTasks}
                      style={styles.pendingBackdrop}
                      resizeMode="contain"
                    />
                    <View style={styles.sectionHeaderRow}>
                      <View>
                        <Text style={styles.sectionTitle}>Pending Tasks</Text>
                        <Text style={styles.sectionHint}>Keep up with important actions.</Text>
                      </View>
                      <View style={styles.pendingHeaderSpacer} />
                    </View>
                    <View style={styles.pendingList}>
                      {pendingItems.map((item, index) => (
                        <Pressable
                          key={`${item.kind}-${item.route}-${index}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.count}`}
                          onPress={() => router.push(item.route as never)}
                          style={({ pressed }) => [styles.pendingRow, index < pendingItems.length - 1 && styles.rowBorder, pressed && styles.pressed]}
                        >
                          <Image
                            source={attentionAsset(item.kind)}
                            style={styles.pendingRowAsset}
                            resizeMode="contain"
                          />
                          <Text style={styles.pendingCount}>{item.count}</Text>
                          <View style={styles.pendingCopy}>
                            <Text numberOfLines={1} style={styles.pendingTitle}>{item.title}</Text>
                            <Text numberOfLines={1} style={styles.pendingSubtitle}>{item.subtitle}</Text>
                          </View>
                          <Feather name="chevron-right" size={17} color={partnerTheme.colors.brandStrong} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </PartnerEnter>
              ) : null}

              {data.business.renewals_30_days > 0 ? (
                <PartnerEnter delay={135}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${data.business.renewals_30_days} renewals due within 30 days`}
                    onPress={() => router.push('/renewals')}
                    style={({ pressed }) => [styles.renewalStrip, pressed && styles.pressed]}
                  >
                    <Image
                      source={GeneratedDashboardAssets.renewalDue}
                      style={styles.renewalIconAsset}
                      resizeMode="contain"
                    />
                    <View style={styles.renewalCopy}>
                      <Text style={styles.renewalTitle}>Renewals Due Soon</Text>
                      <Text style={styles.renewalText}>{data.business.renewals_30_days} policies expiring within 30 days</Text>
                    </View>
                    <View style={styles.viewRenewals}>
                      <Text style={styles.viewRenewalsText}>View</Text>
                      <Feather name="chevron-right" size={15} color={partnerTheme.colors.brand} />
                    </View>
                  </Pressable>
                </PartnerEnter>
              ) : null}

              {activity.length ? (
                <PartnerEnter delay={165}>
                  <View style={styles.activityCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Recent Activity</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel="View all recent activity" onPress={() => router.push('/activity')} style={styles.inlineAction}>
                        <Text style={styles.inlineActionText}>View All</Text>
                        <Feather name="chevron-right" size={14} color={partnerTheme.colors.brand} />
                      </Pressable>
                    </View>
                    {activity.map((item, index) => (
                      <Pressable
                        key={`${item.kind}-${item.entity_id}-${item.event_at}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${item.title}`}
                        onPress={() => router.push(item.route as never)}
                        style={({ pressed }) => [styles.activityRow, index < activity.length - 1 && styles.rowBorder, pressed && styles.pressed]}
                      >
                        <View style={styles.activityIconWrap}>
                          <Feather name={activityIcon(item.kind)} size={17} color={partnerTheme.colors.brandStrong} />
                        </View>
                        <View style={styles.activityCopy}>
                          <Text numberOfLines={1} style={styles.activityTitle}>{item.title}</Text>
                          <Text numberOfLines={1} style={styles.activitySubtitle}>{item.subtitle || item.meta}</Text>
                        </View>
                        <Text style={styles.activityDate}>{formatActivityDate(item.event_at)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </PartnerEnter>
              ) : null}

              <PartnerEnter delay={195}>
                <View style={styles.impactSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Your Impact</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="View impact" hitSlop={8} onPress={() => router.push('/impact')}>
                      <Text style={styles.inlineActionText}>View</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open impact. ${formatIndianCurrency(data.impact.active_motor_idv)} active motor IDV protected`}
                    onPress={() => router.push('/impact')}
                    style={({ pressed }) => [styles.impactSummary, pressed && styles.pressed]}
                  >
                    <Text style={styles.impactLabel}>ACTIVE MOTOR IDV PROTECTED</Text>
                    <Text style={styles.impactValue}>{formatCompactIndianAmount(data.impact.active_motor_idv)}</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <PartnerSkeleton height={166} radius={15} />
      <View style={styles.skeletonHeader}><PartnerSkeleton width="30%" height={18} /></View>
      <View style={styles.quickGrid}>
        <PartnerSkeleton width="23%" height={86} radius={14} />
        <PartnerSkeleton width="23%" height={86} radius={14} />
        <PartnerSkeleton width="23%" height={86} radius={14} />
        <PartnerSkeleton width="23%" height={86} radius={14} />
      </View>
      <View style={styles.skeletonHeader}><PartnerSkeleton width="34%" height={18} /></View>
      <PartnerSkeleton height={156} radius={18} />
    </View>
  );
}

function QuickAction({ icon, asset, label, onPress }: { icon?: DashboardIconName; asset?: number; label: string; onPress: () => void }) {
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
        {asset ? (
          <Image source={asset} style={styles.quickImageAsset} resizeMode="contain" />
        ) : icon ? (
          <View style={styles.quickIconCircle}>
            <Feather name={icon} size={23} color={partnerTheme.colors.brandStrong} />
          </View>
        ) : null}
        <Text numberOfLines={2} style={styles.quickLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function DashboardMetric({ icon, asset, value, label }: { icon?: DashboardIconName; asset?: number; value: string | number; label: string }) {
  return (
    <View accessibilityLabel={`${label}. ${String(value)}`} style={styles.statVisualCell}>
      {asset ? (
        <Image source={asset} style={styles.statImageAsset} resizeMode="contain" />
      ) : icon ? (
        <View style={styles.statIconWrap}>
          <Feather name={icon} size={18} color={partnerTheme.colors.brandStrong} />
        </View>
      ) : null}
      <View style={styles.statCopy}>
        <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
        <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MiniBusinessChart() {
  const bars = [13, 19, 27, 35, 43, 52];
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.businessChart}>
      <View style={styles.businessChartBaseline} />
      <View style={styles.businessBars}>
        {bars.map((height, index) => (
          <View
            key={height}
            style={[
              styles.businessBar,
              { height, opacity: 0.46 + index * 0.085 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function attentionAsset(kind: PartnerHomeData['today'][number]['kind']) {
  if (kind === 'intake_attention') return GeneratedDashboardAssets.pendingDocument;
  if (kind === 'renewal') return GeneratedDashboardAssets.renewalDue;
  return GeneratedDashboardAssets.policyVerified;
}

function activityIcon(kind: PartnerActivityData['items'][number]['kind']): DashboardIconName {
  if (kind === 'policy') return 'file-text';
  if (kind === 'claim') return 'shield';
  if (kind === 'intake') return 'upload-cloud';
  return 'activity';
}

function Trend({ value, hasPrevious }: { value: number; hasPrevious: boolean }) {
  if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison period</Text>;
  const positive = value >= 0;
  return (
    <View style={styles.trend}>
      <Feather name={positive ? 'trending-up' : 'trending-down'} size={14} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} />
      <Text style={[styles.trendText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>
        {positive ? '+' : ''}{Math.abs(value).toFixed(1)}% {positive ? 'vs' : 'below'} last month
      </Text>
    </View>
  );
}

function dayGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
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

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date);
}

function toLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#073A78' },
  scroll: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { paddingBottom: 104 },
  pressed: { opacity: 0.78 },

  hero: { height: 112, overflow: 'hidden', backgroundColor: '#062D5F', paddingHorizontal: 20, paddingTop: 7 },
  heroBackdrop: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.82 },
  heroBackdropShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,34,75,0.34)' },
  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLogo: { width: 36, height: 43, tintColor: '#FFFFFF' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIconButton: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.26)' },
  heroAvatar: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F1FF' },
  heroAvatarText: { color: '#144E98', fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  heroGreeting: { zIndex: 2, marginTop: 5, maxWidth: '84%' },
  heroGreetingText: { color: '#FFFFFF', fontSize: 15.5, lineHeight: 20, fontWeight: '400', letterSpacing: -0.05 },

  body: { marginTop: -13, paddingHorizontal: 16 },
  searchShell: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#173B6C', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 11, color: partnerTheme.colors.ink, fontSize: 12, lineHeight: 17 },
  searchDivider: { width: StyleSheet.hairlineWidth, height: 27, backgroundColor: '#D9E1EC' },
  searchAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 2 },
  searchActionText: { color: partnerTheme.colors.brand, fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  searchActionDisabled: { color: '#B6BFCC' },
  refreshWarning: { marginTop: 10 },

  businessCard: { marginTop: 10, padding: 12, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1EAF5', shadowColor: '#12355E', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  sectionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  periodLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  periodLabel: { color: '#123E83', fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: undefined }), fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  inlineAction: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 2 },
  inlineActionText: { color: partnerTheme.colors.brand, fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  businessMainRow: { marginTop: 0, minHeight: 76, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  businessMainCopy: { flex: 1, minWidth: 0, paddingBottom: 2 },
  businessPremium: { marginTop: 2, color: '#0D2855', fontSize: 29.5, lineHeight: 34, fontWeight: '800', letterSpacing: -0.65 },
  businessPremiumFraction: { fontSize: 17, lineHeight: 21, fontWeight: '700' },
  businessCaption: { marginTop: 0, color: '#53647A', fontSize: 10, lineHeight: 13.5, fontWeight: '500' },
  businessChart: { width: 118, height: 64, justifyContent: 'flex-end', paddingHorizontal: 5, paddingBottom: 4 },
  businessChartBaseline: { position: 'absolute', left: 4, right: 4, bottom: 4, height: StyleSheet.hairlineWidth, backgroundColor: '#DCE8F5' },
  businessBars: { height: 56, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  businessBar: { width: 13, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: '#8BB6E7' },
  trend: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 10, lineHeight: 13.5, fontWeight: '600' },
  trendNeutral: { marginTop: 5, color: partnerTheme.colors.inkMuted, fontSize: 10, lineHeight: 13.5 },
  businessStats: { marginTop: 8, paddingTop: 9, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1.5, borderTopColor: '#B8C8DC' },
  statVisualCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  statVisualDivider: { width: 1.5, height: 42, marginHorizontal: 9, backgroundColor: '#B7C6DA' },
  statIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF6FF' },
  statImageAsset: { width: 38, height: 38 },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { color: '#112D5F', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  statLabel: { marginTop: 1, color: '#66758B', fontSize: 9.5, lineHeight: 12.5 },

  sectionHeaderRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: '#102E62', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  sectionHint: { marginTop: 1, color: '#617188', fontSize: 10, lineHeight: 14 },
  quickSection: { marginTop: 11, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4EBF4' },
  quickGrid: { flexDirection: 'row', gap: 5 },
  quickActionTouch: { flex: 1, minHeight: 88 },
  quickAction: { flex: 1, minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 2, borderRadius: 13, backgroundColor: '#F3F8FF' },
  quickIconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F3FF' },
  quickImageAsset: { width: 42, height: 42 },
  quickLabel: { width: '100%', color: '#10243F', textAlign: 'center', fontSize: 9.5, lineHeight: 13, fontWeight: '600' },

  pendingCard: { marginTop: 11, minHeight: 142, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 8, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EAF5FF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D3E7FA' },
  pendingBackdrop: { position: 'absolute', right: 4, bottom: 4, width: 132, height: 132, opacity: 0.9 },
  pendingHeaderSpacer: { width: 122, height: 1 },
  pendingList: { marginTop: 2, paddingRight: 118 },
  pendingRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D3E1EF' },
  pendingIconWrap: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FBFF' },
  pendingRowAsset: { width: 30, height: 30 },
  pendingCount: { minWidth: 22, color: '#D84D43', fontSize: 13, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  pendingCopy: { flex: 1, minWidth: 0 },
  pendingTitle: { color: '#17345F', fontSize: 11, lineHeight: 15, fontWeight: '700' },
  pendingSubtitle: { marginTop: 1, color: '#6B7B90', fontSize: 9.5, lineHeight: 13 },

  renewalStrip: { marginTop: 11, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE8F5' },
  renewalIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF4FF' },
  renewalIconAsset: { width: 44, height: 44 },
  renewalCopy: { flex: 1, minWidth: 0 },
  renewalTitle: { color: '#16366D', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  renewalText: { marginTop: 2, color: '#D65349', fontSize: 9.5, lineHeight: 13, fontWeight: '600' },
  viewRenewals: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  viewRenewalsText: { color: partnerTheme.colors.brand, fontSize: 9.5, lineHeight: 13, fontWeight: '700' },

  activityCard: { marginTop: 11, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 5, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E3EAF3' },
  activityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  activityIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF6FF' },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: '#17335E', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  activitySubtitle: { marginTop: 2, color: '#708096', fontSize: 9.5, lineHeight: 13 },
  activityDate: { color: '#8995A6', fontSize: 9, lineHeight: 12 },

  impactSection: { marginTop: 11, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 11, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E3EAF3' },
  impactSummary: { paddingTop: 4 },
  impactLabel: { color: partnerTheme.colors.accent, letterSpacing: 0.5, fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  impactValue: { marginTop: 2, color: '#101B2A', fontSize: 21, lineHeight: 27, fontWeight: '600' },
  impactStats: { marginTop: 8, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7ECF3' },
  stories: { marginTop: 11 },

  skeletonWrap: { marginTop: 12 },
  skeletonHeader: { marginTop: 14, marginBottom: 7, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
