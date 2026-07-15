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
  const activeVehicles = useMemo(() => data.vehicles.filter((vehicle) => vehicle.is_active !== false), [data.vehicles]);
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
      <View style={styles.heroCard}>
        <View pointerEvents="none" style={styles.heroOrbLarge} />
        <View pointerEvents="none" style={styles.heroOrbSmall} />
        <MaterialCommunityIcons name="shield-check-outline" size={112} color="rgba(255,255,255,0.06)" style={styles.heroPattern} />
        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text>
            <Text style={styles.groupName} numberOfLines={1}>{groupName}</Text>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={underReview}
            onPress={() => router.push('/customer/group/add-account')}
            style={({ pressed }) => [styles.addButton, underReview && styles.addButtonDisabled, pressed && !underReview && styles.addButtonPressed]}
          >
            <MaterialCommunityIcons name="account-plus-outline" size={17} color={underReview ? '#B9C7DA' : '#FFFFFF'} />
            <Text style={[styles.addButtonText, underReview && styles.addButtonTextDisabled]}>Add Account</Text>
          </Pressable>
        </View>
        {underReview ? <Text style={styles.addHint}>Available after verification</Text> : null}
      </View>

      {underReview ? (
        <View style={styles.reviewBanner}>
          <View style={styles.reviewIcon}><MaterialCommunityIcons name="clipboard-clock-outline" size={22} color="#FFFFFF" /></View>
          <View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Verification in progress</Text><Text style={styles.reviewText}>Your Group KYC is under review. You can explore the dashboard while account-management actions remain locked.</Text></View>
        </View>
      ) : null}

      {error ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={20} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}

      <DashboardCard
        title="Associated Accounts"
        subtitle={underReview ? 'Available after verification' : `${data.associated.length} active account${data.associated.length === 1 ? '' : 's'}`}
        icon="account-group-outline"
        accent="#0A43A3"
        soft="#EEF5FF"
        disabled={underReview}
        onPress={() => router.push('/customer/group/accounts')}
      >
        <View style={styles.fourMetrics}>
          <CompactMetric label="Total" value={data.associated.length} />
          <CompactMetric label="Corporate" value={corporateCount} lined />
          <CompactMetric label="Individual" value={individualCount} lined />
          <CompactMetric label="Dealership" value={dealershipCount} lined />
        </View>
      </DashboardCard>

      <DashboardCard
        title="Group Fleet"
        subtitle={`${data.vehicles.length} vehicles across the Group`}
        icon="truck-outline"
        accent="#0F7B6C"
        soft="#EAF8F5"
        onPress={() => router.push('/customer/group/fleet')}
      >
        <View style={styles.fleetContent}>
          <View style={styles.fleetMetrics}>
            <CompactMetric label="Total Vehicles" value={data.vehicles.length} />
            <CompactMetric label="Active" value={activeVehicles.length} lined />
            <CompactMetric label="Expiring Soon" value={expiringSoon.length} lined />
            <CompactMetric label="Policy Expired" value={expiredPolicies.length} lined />
          </View>
          <Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" />
        </View>
      </DashboardCard>

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
        <View style={styles.claimHeader}><View style={styles.claimIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#F5B700" /></View><View style={styles.claimHeaderCopy}><Text style={styles.claimTitle}>Group Claims</Text><Text style={styles.claimSubtitle}>Track claim activity across the Group</Text></View><MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" /></View>
        <View style={styles.claimMetrics}><ClaimMetric label="Total" value={data.claims.length} /><ClaimMetric label="Active" value={openClaims.length} detailLabel="Action Required" detail={String(actionRequired.length)} lined /><ClaimMetric label="Settled" value={settled.length} detailLabel="Open" detail={String(openClaims.length)} green lined /></View>
      </Pressable>

      <Pressable onPress={() => router.push('/customer/support')} style={({ pressed }) => [styles.supportCard, pressed && styles.cardPressed]}><MaterialCommunityIcons name="headset" size={33} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color={palette.navy} /></Pressable>
    </ScrollView>

    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/group/claims')} onVehicles={() => router.push('/customer/group/fleet')} onSupport={() => router.push('/customer/group/accounts')} onProfile={() => router.push(underReview ? '/customer/profile' : '/customer/group/profile')} /></View>
  </SafeAreaView>;
}

function DashboardCard({ title, subtitle, icon, accent, soft, disabled = false, onPress, children }: { title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; accent: string; soft: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const lift = useRef(new Animated.Value(0)).current;
  function animate(toValue: number) { Animated.spring(lift, { toValue, useNativeDriver: true, speed: 28, bounciness: 4 }).start(); }
  return <Animated.View style={{ transform: [{ translateY: lift }, { scale: lift.interpolate({ inputRange: [-2, 0], outputRange: [0.99, 1] }) }] }}>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} onPressIn={() => animate(-2)} onPressOut={() => animate(0)} style={[styles.dashboardCard, disabled && styles.dashboardCardDisabled]}>
      <View style={styles.cardTopRow}><View style={[styles.cardIcon, { backgroundColor: soft }]}><MaterialCommunityIcons name={icon} size={23} color={accent} /></View><View style={styles.cardCopy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSubtitle}>{subtitle}</Text></View><MaterialCommunityIcons name={disabled ? 'lock-outline' : 'chevron-right'} size={24} color={disabled ? '#9AA8BA' : '#7A3A00'} /></View>
      {children}
    </Pressable>
  </Animated.View>;
}

function CompactMetric({ label, value, lined }: { label: string; value: number; lined?: boolean }) { return <View style={[styles.compactMetric, lined && styles.metricLined]}><Text style={styles.compactValue}>{value}</Text><Text style={styles.compactLabel} numberOfLines={2}>{label}</Text></View>; }
function LargeMetric({ label, value, tone, lined }: { label: string; value: number; tone: string; lined?: boolean }) { return <View style={[styles.largeMetric, lined && styles.metricLined]}><Text style={[styles.largeValue, { color: tone }]}>{value}</Text><Text style={styles.largeLabel}>{label}</Text></View>; }
function ClaimMetric({ label, value, detailLabel, detail, lined, green }: { label: string; value: number; detailLabel?: string; detail?: string; lined?: boolean; green?: boolean }) { return <View style={[styles.claimMetric, lined && styles.claimMetricLined]}><Text style={styles.claimMetricLabel}>{label}</Text><Text style={styles.claimMetricValue}>{value}</Text>{detailLabel ? <Text style={styles.claimMetricDetailLabel}>{detailLabel}</Text> : null}{detail ? <Text style={[styles.claimMetricDetail, green && styles.claimMetricDetailGreen]}>{detail}</Text> : null}</View>; }
function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' }, brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }, iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 }, body: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6, gap: 10 },
  heroCard: { minHeight: 126, borderRadius: 20, backgroundColor: '#071F4B', padding: 16, overflow: 'hidden', shadowColor: '#071F4B', shadowOpacity: 0.22, shadowRadius: 18, elevation: 8 }, heroOrbLarge: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -78, top: -106, backgroundColor: '#0A43A3', opacity: 0.52 }, heroOrbSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, right: 34, bottom: -72, backgroundColor: '#1597E5', opacity: 0.2 }, heroPattern: { position: 'absolute', right: 18, bottom: -18 }, heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, heroCopy: { flex: 1, minWidth: 0 }, greeting: { color: '#DCE9FF', fontSize: 12.5, lineHeight: 17, fontWeight: '700' }, groupName: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 2 }, roleText: { color: '#9FC3FF', fontSize: 11, fontWeight: '800', marginTop: 5 }, addButton: { minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)', backgroundColor: 'rgba(255,255,255,0.13)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, addButtonDisabled: { borderColor: 'rgba(185,199,218,0.25)', backgroundColor: 'rgba(255,255,255,0.07)' }, addButtonPressed: { transform: [{ scale: 0.97 }], backgroundColor: 'rgba(255,255,255,0.21)' }, addButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' }, addButtonTextDisabled: { color: '#B9C7DA' }, addHint: { alignSelf: 'flex-end', marginTop: 8, color: '#B9C7DA', fontSize: 9.5, fontWeight: '700' },
  reviewBanner: { borderRadius: 16, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#F3DDBD', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, reviewIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#D99012', alignItems: 'center', justifyContent: 'center' }, reviewCopy: { flex: 1 }, reviewTitle: { color: '#834100', fontSize: 14, fontWeight: '900' }, reviewText: { color: '#5E4B35', fontSize: 10.5, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: '#B42318', fontSize: 11, fontWeight: '700' },
  dashboardCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 14, shadowColor: '#122544', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }, dashboardCardDisabled: { opacity: 0.68 }, cardPressed: { transform: [{ scale: 0.992 }], opacity: 0.97 }, cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, minWidth: 0 }, cardTitle: { color: palette.navy, fontSize: 15.5, fontWeight: '900' }, cardSubtitle: { color: '#62728A', fontSize: 10.5, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  fourMetrics: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E8EEF5' }, threeMetrics: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E8EEF5' }, compactMetric: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 54, paddingHorizontal: 3 }, metricLined: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }, compactValue: { color: palette.navy, fontSize: 21, lineHeight: 25, fontWeight: '900' }, compactLabel: { color: '#62728A', fontSize: 9.2, lineHeight: 12, textAlign: 'center', fontWeight: '700', marginTop: 2 }, largeMetric: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 61, paddingHorizontal: 5 }, largeValue: { fontSize: 25, lineHeight: 29, fontWeight: '900' }, largeLabel: { color: '#62728A', fontSize: 9.5, lineHeight: 12, textAlign: 'center', fontWeight: '700', marginTop: 3 },
  fleetContent: { position: 'relative', marginTop: 10, minHeight: 88, justifyContent: 'flex-end' }, fleetMetrics: { flexDirection: 'row', paddingRight: 86, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E8EEF5' }, fleetImage: { position: 'absolute', right: -8, bottom: -10, width: 112, height: 90 },
  claimCard: { minHeight: 150, borderRadius: 18, backgroundColor: palette.navy, padding: 14, shadowColor: palette.navy, shadowOpacity: 0.2, shadowRadius: 14, elevation: 6 }, claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, claimHeaderCopy: { flex: 1 }, claimIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: '#F5B700', alignItems: 'center', justifyContent: 'center' }, claimTitle: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '900' }, claimSubtitle: { color: '#C9D7EF', fontSize: 9.8, fontWeight: '600', marginTop: 2 }, claimMetrics: { flex: 1, flexDirection: 'row', marginTop: 12 }, claimMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, claimMetricLined: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.32)' }, claimMetricLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' }, claimMetricValue: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 5 }, claimMetricDetailLabel: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '500', marginTop: 1 }, claimMetricDetail: { color: '#F6C33B', fontSize: 15, fontWeight: '900', marginTop: 1 }, claimMetricDetailGreen: { color: '#68BF5B' },
  supportCard: { minHeight: 60, borderRadius: 17, backgroundColor: '#FFFFFF', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 }, supportCopy: { flex: 1 }, supportTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, supportText: { color: palette.navy, fontSize: 11.5, fontWeight: '500', marginTop: 1 }, nav: { minHeight: 82, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0' },
});