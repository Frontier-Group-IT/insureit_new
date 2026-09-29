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
import { getPartnerBusinessRange, getPartnerHome, type PartnerHomeData } from '@/lib/home';
import { getPartnerStories, type PartnerStory } from '@/lib/stories';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { formatIndianCurrency } from '@/lib/format';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

type BusinessPeriod = 'all' | 'last6' | 'mtd' | 'month';
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
    return { home: homeResult.value, stories: storiesResult.status === 'fulfilled' ? storiesResult.value.items : [] };
  }, []);

  const workspace = usePartnerQuery({ scopeKey: cacheScopeKey, key: 'home:workspace', fetcher: fetchHomeWorkspace, staleTimeMs: 60_000 });
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

  useFocusEffect(useCallback(() => { void workspace.ensureFresh(); void business.ensureFresh(); }, [workspace.ensureFresh, business.ensureFresh]));

  const data = workspace.data?.home ?? null;
  const stories = workspace.data?.stories ?? [];
  if (!context) return null;

  const { identity } = context;
  const role = identity.actor_kind === 'employee' ? humanize(identity.role) : humanize(identity.intermediary_type);
  const periodLabel = BUSINESS_PERIODS.find((item) => item.key === businessPeriod)?.label ?? 'This Month';
  const rangeData = business.data;

  return (
    <PartnerScreen
      eyebrow="INSUREIT PARTNER"
      title={greeting(identity.display_name)}
      action={<View style={styles.headerActions}><PartnerIconButton icon="time-outline" label="View recent activity" onPress={() => router.push('/activity')} /><Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/profile')} style={({ pressed }) => [styles.avatarTouch, pressed && styles.pressed]}><View style={styles.avatar}><Text style={styles.avatarText}>{initials(identity.display_name)}</Text></View></Pressable></View>}
      scrollProps={{ refreshControl: <RefreshControl refreshing={workspace.refreshing || business.refreshing} onRefresh={() => { void workspace.refresh(); void business.refresh(); }} tintColor={partnerTheme.colors.brand} colors={[partnerTheme.colors.brand]} /> }}
    >
      <View style={styles.identityLine}><Text style={styles.role}>{role}</Text>{data ? <Text style={styles.updated}>{formatUpdatedAt(data.generated_at)}</Text> : null}</View>

      {workspace.loading && !data ? <HomeSkeleton /> : !data ? (
        <PartnerStateView state="error" title="Home is unavailable" message={workspace.error || 'We could not load your Partner workspace.'} actionLabel="Try again" onAction={() => void workspace.refresh()} />
      ) : <>
        {workspace.stale || workspace.error ? <View style={styles.refreshWarning}><PartnerBanner tone="warning" title={workspace.offline ? "You're offline" : 'Showing cached information'} message={workspace.stale ? `Last refreshed ${formatCacheTime(workspace.updatedAt)}. Pull down to try again.` : workspace.error} /></View> : null}

        {data.today.length ? <PartnerEnter delay={20}><View style={styles.attentionSection}><PartnerSectionHeader title="For you" /><View style={styles.attentionList}>{data.today.slice(0, 3).map((item, index) => <Pressable key={`${item.kind}-${item.route}-${index}`} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.count}`} onPress={() => router.push(item.route as never)} style={({ pressed }) => [styles.attentionRow, index < Math.min(data.today.length, 3) - 1 && styles.attentionRowBorder, pressed && styles.pressed]}><View style={styles.attentionArtwork}><Image source={attentionAsset(item.kind)} style={styles.attentionImage} resizeMode="contain" /></View><View style={styles.attentionCopy}><View style={styles.attentionTitleRow}><Text numberOfLines={1} style={styles.attentionTitle}>{item.title}</Text>{item.count > 0 ? <View style={styles.attentionCount}><Text style={styles.attentionCountText}>{item.count}</Text></View> : null}</View><Text numberOfLines={2} style={styles.attentionSubtitle}>{item.subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={partnerTheme.colors.inkSubtle} /></Pressable>)}</View></View></PartnerEnter> : null}

        <PartnerEnter delay={80}><View style={styles.quickSection}><PartnerSectionHeader title="Quick actions" /><View style={styles.quickGrid}><QuickAction asset={PartnerAssets.navigation.policyIntake} label="Policy Intake" onPress={() => router.push('/policy-intake-new')} /><QuickAction asset={PartnerAssets.actions.renewals} label="Renewals" onPress={() => router.push('/renewals')} /><QuickAction asset={PartnerAssets.navigation.claims} label="Claims" onPress={() => router.push('/(tabs)/claims')} /><QuickAction asset={PartnerAssets.navigation.customers} label="Customers" onPress={() => router.push('/customers')} /></View></View></PartnerEnter>

        <PartnerEnter delay={140}><View style={styles.businessBlock}>
          <View style={styles.businessTopRow}>
            <View style={styles.periodWrap}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Business period: ${periodLabel}`} onPress={() => setPeriodOpen((value) => !value)} style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}><Text style={styles.periodButtonText}>{periodLabel}</Text><Ionicons name={periodOpen ? 'chevron-up' : 'chevron-down'} size={13} color={partnerTheme.colors.inkMuted} /></Pressable>
              {periodOpen ? <View style={styles.periodMenu}>{BUSINESS_PERIODS.map((item) => <Pressable key={item.key} onPress={() => { setBusinessPeriod(item.key); setPeriodOpen(false); }} style={({ pressed }) => [styles.periodOption, item.key === businessPeriod && styles.periodOptionActive, pressed && styles.pressed]}><Text style={[styles.periodOptionText, item.key === businessPeriod && styles.periodOptionTextActive]}>{item.label}</Text>{item.key === businessPeriod ? <Ionicons name="checkmark" size={14} color={partnerTheme.colors.brand} /> : null}</Pressable>)}</View> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="View business" hitSlop={8} onPress={() => router.push('/(tabs)/business')} style={({ pressed }) => [styles.businessView, pressed && styles.pressed]}><Text style={styles.businessViewText}>View</Text><Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.brand} /></Pressable>
          </View>

          <View style={styles.premiumRow}>
            <View style={styles.premiumCell}><Text style={styles.businessCaption}>Gross Premium</Text><Text style={styles.businessPremium}>{formatIndianCurrency(rangeData?.gross_premium ?? data.business.premium_this_month)}</Text></View>
            <View style={styles.premiumDivider} />
            <View style={styles.premiumCell}><Text style={styles.businessCaption}>Net Premium</Text><Text style={styles.businessPremiumSecondary}>{formatIndianCurrency(rangeData?.net_premium ?? 0)}</Text></View>
          </View>

          {business.loading && !rangeData ? <Text style={styles.trendNeutral}>Updating business figures…</Text> : business.error ? <Text style={styles.rangeError}>Unable to refresh selected period</Text> : <Trend value={Number(rangeData?.premium_change_percent ?? data.business.premium_change_percent || 0)} hasPrevious={Number(rangeData?.premium_previous_period ?? data.business.premium_last_month || 0) > 0} />}

          <View style={styles.businessStats}>
            <View style={styles.statCell}><PartnerStatBlock value={rangeData?.policies ?? data.business.policies_this_month} label="Policies" /></View>
            <View style={styles.statCell}><PartnerStatBlock value={rangeData?.customers ?? data.business.total_customers} label="Customers" /></View>
            <View style={styles.statCell}><PartnerStatBlock value={rangeData?.renewals ?? data.business.renewals_30_days} label="Renewals" /></View>
            <View style={styles.statCellLast}><PartnerStatBlock value={rangeData?.commission_available ? Number(rangeData.commission_earned ?? 0) : data.service.active_claims} label={rangeData?.commission_available ? 'Commission' : 'Claims'} /></View>
          </View>
        </View></PartnerEnter>

        <PartnerEnter delay={200}><View style={styles.impactSection}><PartnerSectionHeader title="Your impact" action={<Pressable accessibilityRole="button" accessibilityLabel="View impact" hitSlop={8} onPress={() => router.push('/impact')}><Text style={styles.sectionAction}>View</Text></Pressable>} /><Pressable accessibilityRole="button" accessibilityLabel={`Open impact. ${formatIndianCurrency(data.impact.active_motor_idv)} active motor IDV protected`} onPress={() => router.push('/impact')} style={({ pressed }) => [styles.impactSummary, pressed && styles.pressed]}><View style={styles.impactPrimary}><Text style={styles.impactLabel}>ACTIVE MOTOR IDV PROTECTED</Text><Text style={styles.impactValue}>{formatCompactIndianAmount(data.impact.active_motor_idv)}</Text></View><View style={styles.impactStats}><PartnerStatBlock value={data.impact.active_vehicles} label="Vehicles" /><PartnerStatBlock value={data.impact.customers_served} label="Customers" /><PartnerStatBlock value={data.impact.claims_assisted} label="Claims assisted" /></View></Pressable></View></PartnerEnter>
        {stories.length ? <View style={styles.stories}><StoryRail stories={stories} /></View> : null}
      </>}
    </PartnerScreen>
  );
}

function businessDateRange(period: BusinessPeriod) {
  const now = new Date();
  const today = localDate(now);
  if (period === 'all') return { from: '2000-01-01', to: today };
  if (period === 'mtd') return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (period === 'last6') return { from: localDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: today };
  return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
}
function localDate(value: Date) { const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, '0'); const d = String(value.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }

function HomeSkeleton() { return <View><PartnerSkeleton height={164} radius={16} /><View style={styles.skeletonHeader}><PartnerSkeleton width="30%" height={18} /></View><View style={styles.quickGrid}><PartnerSkeleton width="23%" height={84} radius={14} /><PartnerSkeleton width="23%" height={84} radius={14} /><PartnerSkeleton width="23%" height={84} radius={14} /><PartnerSkeleton width="23%" height={84} radius={14} /></View><View style={styles.skeletonHeader}><PartnerSkeleton width="30%" height={18} /></View><PartnerSkeleton height={126} radius={14} /></View>; }
function QuickAction({ asset, label, onPress }: { asset: number; label: string; onPress: () => void }) { const scale = useState(() => new Animated.Value(1))[0]; const lift = useState(() => new Animated.Value(0))[0]; const animate = (pressed: boolean) => { Animated.parallel([Animated.spring(scale, { toValue: pressed ? 0.96 : 1, useNativeDriver: true, speed: 28, bounciness: 5 }), Animated.spring(lift, { toValue: pressed ? -2 : 0, useNativeDriver: true, speed: 28, bounciness: 5 })]).start(); }; return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={() => animate(true)} onPressOut={() => animate(false)} style={styles.quickActionTouch}><Animated.View style={[styles.quickAction, { transform: [{ scale }, { translateY: lift }] }]}><View style={styles.quickIcon}><Image source={asset} style={styles.quickImage} resizeMode="contain" /></View><Text numberOfLines={2} style={styles.quickLabel}>{label}</Text></Animated.View></Pressable>; }
function attentionAsset(kind: PartnerHomeData['today'][number]['kind']) { if (kind === 'intake_attention') return PartnerAssets.navigation.policyIntake; if (kind === 'renewal') return PartnerAssets.actions.renewals; return PartnerAssets.navigation.claims; }
function Trend({ value, hasPrevious }: { value: number; hasPrevious: boolean }) { if (!hasPrevious) return <Text style={styles.trendNeutral}>First recorded comparison period</Text>; const positive = value >= 0; return <View style={styles.trend}><Ionicons name={positive ? 'trending-up' : 'trending-down'} size={14} color={positive ? partnerTheme.colors.success : partnerTheme.colors.warning} /><Text style={[styles.trendText, { color: positive ? partnerTheme.colors.success : partnerTheme.colors.warning }]}>{Math.abs(value).toFixed(1)}% {positive ? 'above' : 'below'} previous period</Text></View>; }
function greeting(name: string) { const firstName = name.trim().split(/\s+/)[0] || 'Partner'; const hour = new Date().getHours(); const prefix = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; return `${prefix}, ${firstName}`; }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP'; }
function humanize(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatCompactIndianAmount(value: number | string | null | undefined) { const amount = Number(value ?? 0); if (!Number.isFinite(amount)) return '₹0'; const format = (scaled: number, suffix: string) => { const decimals = scaled >= 100 || Number.isInteger(scaled) ? 0 : 1; return `₹${scaled.toFixed(decimals).replace(/\.0$/, '')}${suffix}`; }; if (Math.abs(amount) >= 10000000) return format(amount / 10000000, 'Cr'); if (Math.abs(amount) >= 100000) return format(amount / 100000, 'L'); if (Math.abs(amount) >= 1000) return format(amount / 1000, 'K'); return formatIndianCurrency(amount); }
function formatCacheTime(value: number | null) { if (!value) return 'earlier'; return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatUpdatedAt(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return 'Pull down to refresh'; return `Updated ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(date)}`; }

const styles = StyleSheet.create({
  identityLine:{marginTop:-10,marginBottom:8,minHeight:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:partnerTheme.spacing.md},role:{flex:1,color:partnerTheme.colors.inkMuted,...partnerTheme.typography.caption},updated:{color:'#8A94A6',...partnerTheme.typography.meta},headerActions:{flexDirection:'row',alignItems:'center',gap:4},avatarTouch:{width:partnerTheme.control.minTouchTarget,height:partnerTheme.control.minTouchTarget,alignItems:'center',justifyContent:'center'},avatar:{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.brandSoft},avatarText:{color:partnerTheme.colors.brandStrong,...partnerTheme.typography.label},refreshWarning:{marginBottom:6},pressed:{opacity:.76},
  attentionSection:{marginTop:2,paddingHorizontal:14,paddingBottom:6,borderRadius:18,backgroundColor:partnerTheme.colors.surface},attentionList:{marginTop:-2},attentionRow:{minHeight:76,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8},attentionRowBorder:{borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:partnerTheme.colors.line},attentionArtwork:{width:48,height:48,alignItems:'center',justifyContent:'center'},attentionImage:{width:44,height:44},attentionCopy:{flex:1,minWidth:0},attentionTitleRow:{flexDirection:'row',alignItems:'center',gap:7},attentionTitle:{flexShrink:1,color:partnerTheme.colors.ink,...partnerTheme.typography.cardTitle},attentionSubtitle:{marginTop:2,color:partnerTheme.colors.inkMuted,...partnerTheme.typography.caption},attentionCount:{minWidth:22,height:22,paddingHorizontal:6,borderRadius:partnerTheme.radius.pill,alignItems:'center',justifyContent:'center',backgroundColor:partnerTheme.colors.brandSoft},attentionCountText:{color:partnerTheme.colors.brandStrong,...partnerTheme.typography.meta},
  businessBlock:{marginTop:12,padding:14,borderRadius:18,backgroundColor:partnerTheme.colors.surface,zIndex:3},businessTopRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,zIndex:5},periodWrap:{position:'relative',zIndex:10},periodButton:{minHeight:32,flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:2},periodButtonText:{color:partnerTheme.colors.ink,fontSize:11,fontWeight:'700'},periodMenu:{position:'absolute',top:34,left:0,width:148,padding:5,borderRadius:12,backgroundColor:partnerTheme.colors.surface,borderWidth:StyleSheet.hairlineWidth,borderColor:partnerTheme.colors.line,shadowColor:'#000',shadowOpacity:.12,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:8,zIndex:20},periodOption:{minHeight:36,paddingHorizontal:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:8},periodOptionActive:{backgroundColor:partnerTheme.colors.brandSoft},periodOptionText:{color:partnerTheme.colors.inkMuted,fontSize:11},periodOptionTextActive:{color:partnerTheme.colors.brandStrong,fontWeight:'700'},businessView:{minHeight:partnerTheme.control.minTouchTarget,minWidth:partnerTheme.control.minTouchTarget,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:2},businessViewText:{color:partnerTheme.colors.brand,...partnerTheme.typography.caption},premiumRow:{marginTop:7,flexDirection:'row',alignItems:'stretch'},premiumCell:{flex:1,minWidth:0},premiumDivider:{width:StyleSheet.hairlineWidth,marginHorizontal:12,backgroundColor:partnerTheme.colors.line},businessPremium:{marginTop:3,color:partnerTheme.colors.ink,fontSize:20,lineHeight:26,fontWeight:'700'},businessPremiumSecondary:{marginTop:3,color:partnerTheme.colors.ink,fontSize:18,lineHeight:26,fontWeight:'600'},businessCaption:{color:partnerTheme.colors.inkMuted,...partnerTheme.typography.caption},rangeError:{marginTop:7,color:partnerTheme.colors.warning,...partnerTheme.typography.meta},trend:{marginTop:7,flexDirection:'row',alignItems:'center',gap:4},trendText:{...partnerTheme.typography.meta},trendNeutral:{marginTop:7,color:partnerTheme.colors.inkMuted,...partnerTheme.typography.meta},businessStats:{marginTop:14,paddingTop:11,flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:partnerTheme.colors.line},statCell:{flex:1,paddingRight:8,marginRight:8,borderRightWidth:StyleSheet.hairlineWidth,borderRightColor:partnerTheme.colors.line},statCellLast:{flex:1},
  quickSection:{marginTop:12,paddingHorizontal:14,paddingBottom:10,borderRadius:18,backgroundColor:partnerTheme.colors.surface},quickGrid:{flexDirection:'row',gap:6},quickActionTouch:{flex:1,minHeight:84},quickAction:{flex:1,minHeight:84,alignItems:'center',justifyContent:'center',gap:5,paddingVertical:7,paddingHorizontal:3,borderRadius:14,backgroundColor:'#FAFBFD'},quickIcon:{width:36,height:36,alignItems:'center',justifyContent:'center'},quickImage:{width:35,height:35},quickLabel:{width:'100%',color:partnerTheme.colors.ink,textAlign:'center',...partnerTheme.typography.meta},sectionAction:{color:partnerTheme.colors.brand,...partnerTheme.typography.caption},impactSection:{marginTop:12,paddingHorizontal:14,paddingBottom:12,borderRadius:18,backgroundColor:partnerTheme.colors.surface},impactSummary:{minHeight:108,paddingTop:2},impactPrimary:{paddingBottom:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:partnerTheme.colors.line},impactLabel:{color:partnerTheme.colors.accent,letterSpacing:.6,...partnerTheme.typography.meta},impactValue:{marginTop:3,color:partnerTheme.colors.ink,fontSize:22,lineHeight:28,fontWeight:'500'},impactStats:{marginTop:10,flexDirection:'row',justifyContent:'space-between',gap:14},stories:{marginTop:12},skeletonHeader:{marginTop:partnerTheme.spacing.xl,marginBottom:partnerTheme.spacing.sm,minHeight:32,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
});