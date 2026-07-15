import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/customer-dashboard';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState } from '@/components/ui';
import { customerAccountTitle, getAccessibleCustomerContexts, membershipRoleLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, CustomerOnboardingApplication, Policy, Profile, Vehicle } from '@/lib/types';

const fleetSketch = require('../../assets/brand/customer-fleet-sketch.png');

type Props = {
  profile: Profile;
  groupContext?: CustomerAccountContext | null;
  onboarding?: CustomerOnboardingApplication | null;
  underReview?: boolean;
};

type DashboardData = {
  associated: CustomerAccountContext[];
  vehicles: Vehicle[];
  policies: Policy[];
  claims: Claim[];
};

const closedStatuses = new Set(['Closed', 'Settled', 'Rejected', 'Claim Complete']);

export function GroupHomeScreen({ profile, groupContext = null, onboarding = null, underReview = false }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ associated: [], vehicles: [], policies: [], claims: [] });
  const [loading, setLoading] = useState(!underReview);
  const [error, setError] = useState('');

  useEffect(() => {
    if (underReview || !groupContext) {
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      try {
        const contexts = await getAccessibleCustomerContexts();
        const associated = contexts.filter((item) => item.access_source === 'group_child' && item.group_customer_id === groupContext.customer_id);
        const accountIds = associated.map((item) => item.customer_id);
        if (!accountIds.length) {
          if (active) setData({ associated, vehicles: [], policies: [], claims: [] });
          return;
        }
        const [vehicleResult, policyResult, claimResult] = await Promise.all([
          supabase.from('vehicles').select('*').in('customer_id', accountIds),
          supabase.from('policies').select('*').in('customer_id', accountIds),
          supabase.from('claims').select('*').in('customer_id', accountIds),
        ]);
        if (vehicleResult.error || policyResult.error || claimResult.error) throw vehicleResult.error ?? policyResult.error ?? claimResult.error;
        if (active) setData({ associated, vehicles: vehicleResult.data ?? [], policies: policyResult.data ?? [], claims: claimResult.data ?? [] });
      } catch (nextError) {
        console.warn('Group dashboard load failed', nextError);
        if (active) setError('We could not load the Group overview. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [groupContext, underReview]);

  const draft = onboarding?.draft_data && typeof onboarding.draft_data === 'object' && !Array.isArray(onboarding.draft_data)
    ? onboarding.draft_data as Record<string, unknown>
    : {};
  const draftGroupName = typeof draft.group_name === 'string' ? draft.group_name : '';
  const groupName = groupContext ? customerAccountTitle(groupContext) : draftGroupName || 'Your Group Account';
  const firstName = (profile.full_name || groupContext?.contact_name || 'Customer').split(' ')[0];
  const roleLabel = groupContext ? membershipRoleLabel(groupContext.membership_role) : 'Group Owner';

  const now = Date.now();
  const activePolicies = useMemo(() => data.policies.filter((policy) => new Date(policy.end_date).getTime() >= now), [data.policies, now]);
  const expiredPolicies = useMemo(() => data.policies.filter((policy) => new Date(policy.end_date).getTime() < now), [data.policies, now]);
  const expiringSoon = useMemo(() => data.policies.filter((policy) => {
    const days = Math.ceil((new Date(policy.end_date).getTime() - now) / 86400000);
    return days >= 0 && days <= 30;
  }), [data.policies, now]);
  const openClaims = useMemo(() => data.claims.filter((claim) => !closedStatuses.has(claim.current_status)), [data.claims]);
  const settled = useMemo(() => data.claims.filter((claim) => claim.current_status === 'Closed' || claim.current_status === 'Settled'), [data.claims]);
  const actionRequired = useMemo(() => openClaims.filter((claim) => /pending|awaited|document/i.test(claim.current_status)), [openClaims]);

  const corporateCount = data.associated.filter((item) => item.partner_type === 'corporate').length;
  const individualCount = data.associated.filter((item) => item.partner_type === 'individual_proprietor').length;
  const dealershipCount = data.associated.filter((item) => item.partner_type === 'dealership').length;

  if (loading) return <View style={styles.loading}><LoadingState label="Opening Group dashboard" /></View>;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable onPress={() => router.replace('/customer/home')} style={styles.brand}><BrandLogo width={158} /></Pressable>
      <Pressable onPress={() => router.push('/customer/notifications')} style={styles.iconCircle}><NotificationBell /></Pressable>
      <Pressable onPress={() => router.push(underReview ? '/customer/profile' : '/customer/group/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initialFor(profile.full_name || groupName)}</Text></Pressable>
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text>
        <Text style={styles.groupName} numberOfLines={1}>{groupName}</Text>
        <View style={styles.roleRow}><View style={styles.roleDot} /><Text style={styles.roleText}>{roleLabel}</Text></View>
      </View>

      {underReview ? (
        <View style={styles.reviewBanner}>
          <View style={styles.reviewIcon}><MaterialCommunityIcons name="clipboard-clock-outline" size={19} color="#FFFFFF" /></View>
          <View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Verification in progress</Text><Text style={styles.reviewText}>Account-management actions will unlock after approval.</Text></View>
        </View>
      ) : null}

      {error ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={19} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}

      <DashboardCard
        title="Associated Accounts"
        subtitle={underReview ? 'Available after verification' : `${data.associated.length} active account${data.associated.length === 1 ? '' : 's'}`}
        icon="account-group-outline"
        accent="#0A43A3"
        soft="#EEF5FF"
        disabled={underReview}
        onPress={() => router.push('/customer/group/accounts')}
      >
        <View style={styles.accountSummary}>
          <View style={styles.totalAccountBlock}>
            <Text style={styles.totalAccountValue}>{data.associated.length}</Text>
            <Text style={styles.totalAccountLabel}>Total active</Text>
          </View>
          <View style={styles.accountTypeWrap}>
            <AccountTypePill icon="office-building-outline" label="Corporate" value={corporateCount} tone="#0A43A3" soft="#EEF5FF" />
            <AccountTypePill icon="account-outline" label="Individual" value={individualCount} tone="#8B5E16" soft="#FFF7EA" />
            <AccountTypePill icon="storefront-outline" label="Dealership" value={dealershipCount} tone="#0F7B6C" soft="#EAF8F5" />
          </View>
        </View>
      </DashboardCard>

      <Pressable onPress={() => router.push('/customer/group/fleet')} style={({ pressed }) => [styles.fleetCard, pressed && styles.cardPressed]}>
        <View style={styles.fleetLeft}>
          <View style={styles.fleetIcon}><MaterialCommunityIcons name="truck-outline" size={24} color="#0A43A3" /></View>
          <View style={styles.fleetCopy}><Text style={styles.fleetTitle}>Group Fleet</Text><Text style={styles.fleetNumber}>{data.vehicles.length}</Text><Text style={styles.fleetLabel}>Vehicles across associated accounts</Text></View>
        </View>
        <Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" />
        <MaterialCommunityIcons name="chevron-right" size={26} color="#7A3A00" />
      </Pressable>

      <DashboardCard
        title="Group Policies"
        subtitle="Policy health across associated accounts"
        icon="file-document-outline"
        accent="#D99012"
        soft="#FFF7EA"
        onPress={() => router.push('/customer/group/policies')}
      >
        <View style={styles.threeMetrics}>
          <LargeMetric label="Active" value={activePolicies.length} tone="#0A43A3" />
          <LargeMetric label="Expired" value={expiredPolicies.length} tone="#C43D2D" lined />
          <LargeMetric label="Expiring in 30 days" value={expiringSoon.length} tone="#D99012" lined />
        </View>
      </DashboardCard>

      <Pressable onPress={() => router.push('/customer/group/claims')} style={({ pressed }) => [styles.claimCard, pressed && styles.cardPressed]}>
        <View style={styles.claimHeader}><View style={styles.claimIcon}><MaterialCommunityIcons name="shield-check-outline" size={20} color="#F5B700" /></View><View style={styles.claimHeaderCopy}><Text style={styles.claimTitle}>Group Claims</Text><Text style={styles.claimSubtitle}>Claim activity across the Group</Text></View><MaterialCommunityIcons name="chevron-right" size={23} color="#FFFFFF" /></View>
        <View style={styles.claimMetrics}><ClaimMetric label="Total" value={data.claims.length} /><ClaimMetric label="Active" value={openClaims.length} detailLabel="Action Required" detail={String(actionRequired.length)} lined /><ClaimMetric label="Settled" value={settled.length} detailLabel="Open" detail={String(openClaims.length)} green lined /></View>
      </Pressable>

      <Pressable onPress={() => router.push('/customer/support')} style={({ pressed }) => [styles.supportCard, pressed && styles.cardPressed]}><MaterialCommunityIcons name="headset" size={28} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={25} color={palette.navy} /></Pressable>
    </ScrollView>

    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/group/claims')} onVehicles={() => router.push('/customer/group/fleet')} onSupport={() => router.push('/customer/group/accounts')} onProfile={() => router.push(underReview ? '/customer/profile' : '/customer/group/profile')} /></View>
  </SafeAreaView>;
}

function DashboardCard({ title, subtitle, icon, accent, soft, disabled = false, onPress, children }: { title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; accent: string; soft: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const lift = useRef(new Animated.Value(0)).current;
  function animate(toValue: number) { Animated.spring(lift, { toValue, useNativeDriver: true, speed: 28, bounciness: 4 }).start(); }
  return <Animated.View style={{ transform: [{ translateY: lift }, { scale: lift.interpolate({ inputRange: [-2, 0], outputRange: [0.99, 1] }) }] }}>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} onPressIn={() => animate(-2)} onPressOut={() => animate(0)} style={[styles.dashboardCard, disabled && styles.dashboardCardDisabled]}>
      <View style={styles.cardTopRow}><View style={[styles.cardIcon, { backgroundColor: soft }]}><MaterialCommunityIcons name={icon} size={21} color={accent} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSubtitle}>{subtitle}</Text></View><MaterialCommunityIcons name={disabled ? 'lock-outline' : 'chevron-right'} size={23} color={disabled ? '#9AA8BA' : '#7A3A00'} /></View>
      {children}
    </Pressable>
  </Animated.View>;
}

function AccountTypePill({ icon, label, value, tone, soft }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number; tone: string; soft: string }) {
  return <View style={[styles.accountTypePill, { backgroundColor: soft }]}><MaterialCommunityIcons name={icon} size={14} color={tone} /><Text style={[styles.accountTypeValue, { color: tone }]}>{value}</Text><Text style={styles.accountTypeLabel}>{label}</Text></View>;
}
function LargeMetric({ label, value, tone, lined }: { label: string; value: number; tone: string; lined?: boolean }) { return <View style={[styles.largeMetric, lined && styles.metricLined]}><Text style={[styles.largeValue, { color: tone }]}>{value}</Text><Text style={styles.largeLabel}>{label}</Text></View>; }
function ClaimMetric({ label, value, detailLabel, detail, lined, green }: { label: string; value: number; detailLabel?: string; detail?: string; lined?: boolean; green?: boolean }) { return <View style={[styles.claimMetric, lined && styles.claimMetricLined]}><Text style={styles.claimMetricLabel}>{label}</Text><Text style={styles.claimMetricValue}>{value}</Text>{detailLabel ? <Text style={styles.claimMetricDetailLabel}>{detailLabel}</Text> : null}{detail ? <Text style={[styles.claimMetricDetail, green && styles.claimMetricDetailGreen]}>{detail}</Text> : null}</View>; }
function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' }, brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }, iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 }, body: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4, gap: 7 },
  greetingBlock: { minHeight: 58, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7F0', paddingHorizontal: 13, paddingVertical: 9, justifyContent: 'center' }, greeting: { color: '#607089', fontSize: 11.5, lineHeight: 15, fontWeight: '700' }, groupName: { color: palette.navy, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 1 }, roleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }, roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#21A66B' }, roleText: { color: '#62728A', fontSize: 10, fontWeight: '800' },
  reviewBanner: { borderRadius: 13, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#F3DDBD', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, reviewIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#D99012', alignItems: 'center', justifyContent: 'center' }, reviewCopy: { flex: 1 }, reviewTitle: { color: '#834100', fontSize: 12.5, fontWeight: '900' }, reviewText: { color: '#5E4B35', fontSize: 9.5, lineHeight: 12, fontWeight: '600', marginTop: 1 },
  errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 7 }, errorText: { flex: 1, color: '#B42318', fontSize: 10.5, fontWeight: '700' },
  dashboardCard: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#122544', shadowOpacity: 0.06, shadowRadius: 9, elevation: 2 }, dashboardCardDisabled: { opacity: 0.68 }, cardPressed: { transform: [{ scale: 0.992 }], opacity: 0.97 }, cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, cardIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, cardSubtitle: { color: '#62728A', fontSize: 9.5, lineHeight: 12, fontWeight: '600', marginTop: 1 },
  accountSummary: { flexDirection: 'row', alignItems: 'stretch', marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E8EEF5', gap: 8 }, totalAccountBlock: { width: 72, borderRadius: 12, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center', paddingVertical: 7 }, totalAccountValue: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900' }, totalAccountLabel: { color: '#DCE9FF', fontSize: 8.8, fontWeight: '700', marginTop: 1 }, accountTypeWrap: { flex: 1, flexDirection: 'row', gap: 5 }, accountTypePill: { flex: 1, minWidth: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 6 }, accountTypeValue: { fontSize: 16, lineHeight: 19, fontWeight: '900', marginTop: 1 }, accountTypeLabel: { color: '#526278', fontSize: 7.8, lineHeight: 10, fontWeight: '700', textAlign: 'center', marginTop: 1 },
  fleetCard: { minHeight: 104, borderRadius: 16, backgroundColor: '#FFFFFF', paddingLeft: 12, paddingRight: 5, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#DCE8F4', shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 9, elevation: 2 }, fleetLeft: { width: 148, zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, fleetIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, fleetCopy: { flex: 1 }, fleetTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, fleetNumber: { color: palette.navy, fontSize: 26, lineHeight: 29, fontWeight: '900', marginTop: 1 }, fleetLabel: { maxWidth: 112, color: '#62728A', fontSize: 8.7, lineHeight: 11, fontWeight: '600' }, fleetImage: { flex: 1, height: 100, marginLeft: -16, marginRight: -13 },
  threeMetrics: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E8EEF5' }, metricLined: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }, largeMetric: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46, paddingHorizontal: 4 }, largeValue: { fontSize: 22, lineHeight: 25, fontWeight: '900' }, largeLabel: { color: '#62728A', fontSize: 8.5, lineHeight: 10.5, textAlign: 'center', fontWeight: '700', marginTop: 2 },
  claimCard: { minHeight: 112, borderRadius: 16, backgroundColor: palette.navy, paddingHorizontal: 12, paddingVertical: 10, shadowColor: palette.navy, shadowOpacity: 0.17, shadowRadius: 11, elevation: 4 }, claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, claimHeaderCopy: { flex: 1 }, claimIcon: { width: 35, height: 35, borderRadius: 10, borderWidth: 1.3, borderColor: '#F5B700', alignItems: 'center', justifyContent: 'center' }, claimTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '900' }, claimSubtitle: { color: '#C9D7EF', fontSize: 8.8, fontWeight: '600', marginTop: 1 }, claimMetrics: { flex: 1, flexDirection: 'row', marginTop: 7 }, claimMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, claimMetricLined: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.28)' }, claimMetricLabel: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '500' }, claimMetricValue: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900', marginTop: 2 }, claimMetricDetailLabel: { color: '#FFFFFF', fontSize: 8, fontWeight: '500' }, claimMetricDetail: { color: '#F6C33B', fontSize: 12, fontWeight: '900' }, claimMetricDetailGreen: { color: '#68BF5B' },
  supportCard: { minHeight: 48, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 7, elevation: 1 }, supportCopy: { flex: 1 }, supportTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, supportText: { color: palette.navy, fontSize: 9.5, fontWeight: '500', marginTop: 1 }, nav: { minHeight: 78, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0' },
});