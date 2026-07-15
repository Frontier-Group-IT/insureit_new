import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/customer-dashboard';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState } from '@/components/ui';
import { customerAccountTitle, getAccessibleCustomerContexts, membershipRoleLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, Policy, Profile, Vehicle } from '@/lib/types';

const fleetSketch = require('../../assets/brand/customer-fleet-sketch.png');

type Props = { profile: Profile; groupContext: CustomerAccountContext };

type DashboardData = {
  associated: CustomerAccountContext[];
  vehicles: Vehicle[];
  policies: Policy[];
  claims: Claim[];
};

const closedStatuses = new Set(['Closed', 'Settled', 'Rejected', 'Claim Complete']);

export function GroupHomeScreen({ profile, groupContext }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ associated: [], vehicles: [], policies: [], claims: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [groupContext.customer_id]);

  const groupName = customerAccountTitle(groupContext);
  const firstName = (profile.full_name || groupContext.contact_name || 'Customer').split(' ')[0];
  const activePolicies = useMemo(() => data.policies.filter((policy) => new Date(policy.end_date).getTime() >= Date.now()), [data.policies]);
  const renewals = useMemo(() => data.policies.filter((policy) => { const days = Math.ceil((new Date(policy.end_date).getTime() - Date.now()) / 86400000); return days >= 0 && days <= 30; }), [data.policies]);
  const openClaims = useMemo(() => data.claims.filter((claim) => !closedStatuses.has(claim.current_status)), [data.claims]);
  const settled = useMemo(() => data.claims.filter((claim) => claim.current_status === 'Closed' || claim.current_status === 'Settled'), [data.claims]);
  const actionRequired = useMemo(() => openClaims.filter((claim) => /pending|awaited|document/i.test(claim.current_status)), [openClaims]);

  if (loading) return <View style={styles.loading}><LoadingState label="Opening Group dashboard" /></View>;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable onPress={() => router.replace('/customer/home')} style={styles.brand}><BrandLogo width={158} /></Pressable>
      <Pressable onPress={() => router.push('/customer/notifications')} style={styles.iconCircle}><NotificationBell /></Pressable>
      <Pressable onPress={() => router.push('/customer/group/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initialFor(profile.full_name || groupName)}</Text></Pressable>
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text>
        <Text style={styles.groupName} numberOfLines={1}>{groupName}</Text>
        <Text style={styles.roleText}>{membershipRoleLabel(groupContext.membership_role)} · Group Account</Text>
      </View>

      {error ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={20} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}

      <Pressable onPress={() => router.push('/customer/group/accounts')} style={styles.contextCard}>
        <View style={styles.contextIcon}><MaterialCommunityIcons name="office-building-outline" size={23} color="#0A43A3" /></View>
        <View style={styles.contextCopy}><Text style={styles.contextLabel}>Group Portfolio</Text><Text style={styles.contextTitle}>{data.associated.length} Associated Customer{data.associated.length === 1 ? '' : 's'}</Text><Text style={styles.contextMeta}>View and manage businesses associated with this Group</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={25} color="#7A3A00" />
      </Pressable>

      <Pressable onPress={() => router.push(renewals.length ? '/customer/group/policies' : '/customer/group/claims')} style={[styles.pendingCard, renewals.length === 0 && styles.pendingCardBlue]}>
        <View style={[styles.pendingIcon, renewals.length === 0 && styles.pendingIconBlue]}><MaterialCommunityIcons name={renewals.length ? 'calendar-alert' : 'shield-check-outline'} size={27} color="#FFFFFF" /></View>
        <View style={styles.pendingCopy}><Text style={[styles.pendingTitle, renewals.length === 0 && styles.pendingTitleBlue]}>{renewals.length ? 'Renewals need attention' : 'Portfolio is up to date'}</Text><Text style={styles.pendingText}>{renewals.length ? `${renewals.length} polic${renewals.length === 1 ? 'y expires' : 'ies expire'} within 30 days` : `${openClaims.length} active claim${openClaims.length === 1 ? '' : 's'} across the Group portfolio`}</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={27} color={renewals.length ? '#7A3A00' : '#0A43A3'} />
      </Pressable>

      <Pressable onPress={() => router.push('/customer/group/fleet')} style={styles.portfolioCard}>
        <View style={styles.portfolioLeft}>
          <View style={styles.portfolioIcon}><MaterialCommunityIcons name="truck-outline" size={25} color="#0A43A3" /></View>
          <View><Text style={styles.portfolioTitle}>Group Fleet</Text><Text style={styles.portfolioNumber}>{data.vehicles.length}</Text><Text style={styles.portfolioLabel}>Vehicles across {data.associated.length} accounts</Text></View>
        </View>
        <Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" />
        <MaterialCommunityIcons name="chevron-right" size={28} color="#7A3A00" />
      </Pressable>

      <View style={styles.metricStrip}>
        <Metric label="Customers" value={data.associated.length} icon="account-group-outline" />
        <Metric label="Policies" value={activePolicies.length} icon="file-document-outline" lined />
        <Metric label="Claims" value={openClaims.length} icon="shield-alert-outline" lined />
      </View>

      <View style={styles.actionCard}>
        <ActionTile icon="account-plus-outline" title="Add Customer" body="Start a new association" onPress={() => router.push('/customer/group/add-account')} tone="blue" />
        <ActionTile icon="account-multiple-outline" title="Customers" body="View Group portfolio" onPress={() => router.push('/customer/group/accounts')} tone="green" />
        <ActionTile icon="calendar-month-outline" title="Renewals" body="Policies due soon" onPress={() => router.push('/customer/group/policies')} tone="orange" />
        <ActionTile icon="shield-search-outline" title="Claims" body="Track claim activity" onPress={() => router.push('/customer/group/claims')} tone="teal" />
      </View>

      <Pressable onPress={() => router.push('/customer/group/claims')} style={styles.claimCard}>
        <View style={styles.claimHeader}><View style={styles.claimIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#F5B700" /></View><Text style={styles.claimTitle}>Group Claims</Text></View>
        <View style={styles.claimMetrics}><ClaimMetric label="Total" value={data.claims.length} /><ClaimMetric label="Active" value={openClaims.length} detailLabel="Action Required" detail={String(actionRequired.length)} lined /><ClaimMetric label="Settled" value={settled.length} detailLabel="Renewals Due" detail={String(renewals.length)} green lined /></View>
      </Pressable>

      <Pressable onPress={() => router.push('/customer/support')} style={styles.supportCard}><MaterialCommunityIcons name="headset" size={33} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color={palette.navy} /></Pressable>
    </ScrollView>

    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/group/claims')} onVehicles={() => router.push('/customer/group/fleet')} onSupport={() => router.push('/customer/group/accounts')} onProfile={() => router.push('/customer/group/profile')} /></View>
  </SafeAreaView>;
}

function Metric({ label, value, icon, lined }: { label: string; value: number; icon: keyof typeof MaterialCommunityIcons.glyphMap; lined?: boolean }) { return <View style={[styles.metric, lined && styles.metricLined]}><MaterialCommunityIcons name={icon} size={18} color="#0A43A3" /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function ActionTile({ icon, title, body, onPress, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string; onPress: () => void; tone: 'orange' | 'blue' | 'green' | 'teal' }) { const color = tone === 'orange' ? '#D99012' : tone === 'green' ? '#21A453' : tone === 'teal' ? '#0F9F9A' : '#0A43A3'; const backgroundColor = tone === 'orange' ? '#FFF7EA' : tone === 'green' ? '#EFFAF4' : tone === 'teal' ? '#E9FAF8' : '#EEF5FF'; return <Pressable onPress={onPress} style={styles.actionTile}><View style={[styles.actionIcon, { backgroundColor }]}><MaterialCommunityIcons name={icon} size={22} color={color} /></View><View style={styles.actionTitleRow}><Text style={styles.actionTitle}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={16} color="#7A3A00" /></View><Text style={styles.actionBody}>{body}</Text></Pressable>; }
function ClaimMetric({ label, value, detailLabel, detail, lined, green }: { label: string; value: number; detailLabel?: string; detail?: string; lined?: boolean; green?: boolean }) { return <View style={[styles.claimMetric, lined && styles.claimMetricLined]}><Text style={styles.claimMetricLabel}>{label}</Text><Text style={styles.claimMetricValue}>{value}</Text>{detailLabel ? <Text style={styles.claimMetricDetailLabel}>{detailLabel}</Text> : null}{detail ? <Text style={[styles.claimMetricDetail, green && styles.claimMetricDetailGreen]}>{detail}</Text> : null}</View>; }
function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' }, brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }, iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 }, body: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 6, gap: 10 }, greetingBlock: { marginBottom: 1 }, greeting: { color: palette.navy, fontSize: 13, lineHeight: 16, fontWeight: '900' }, groupName: { color: palette.navy, fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 1 }, roleText: { color: '#62728A', fontSize: 10.5, fontWeight: '700', marginTop: 1 },
  errorCard: { borderRadius: 14, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { flex: 1, color: '#B42318', fontSize: 11, fontWeight: '700' },
  contextCard: { minHeight: 75, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }, contextIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, contextCopy: { flex: 1, minWidth: 0 }, contextLabel: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.45 }, contextTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900', marginTop: 1 }, contextMeta: { color: '#62728A', fontSize: 9.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  pendingCard: { minHeight: 62, borderRadius: 15, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#F3DDBD', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, pendingCardBlue: { backgroundColor: '#F1F7FF', borderColor: '#CFE1F7' }, pendingIcon: { width: 43, height: 43, borderRadius: 11, backgroundColor: '#DD7300', alignItems: 'center', justifyContent: 'center' }, pendingIconBlue: { backgroundColor: '#0A43A3' }, pendingCopy: { flex: 1 }, pendingTitle: { color: '#834100', fontSize: 14.5, fontWeight: '900' }, pendingTitleBlue: { color: '#0A3B8F' }, pendingText: { color: palette.navy, fontSize: 10.5, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  portfolioCard: { minHeight: 125, borderRadius: 17, backgroundColor: '#FFFFFF', paddingLeft: 13, paddingRight: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }, portfolioLeft: { width: 160, zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, portfolioIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, portfolioTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, portfolioNumber: { color: palette.navy, fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 2 }, portfolioLabel: { maxWidth: 112, color: palette.navy, fontSize: 9.5, lineHeight: 12, fontWeight: '600' }, fleetImage: { flex: 1, height: 112, marginLeft: -14, marginRight: -12 },
  metricStrip: { minHeight: 78, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'stretch', paddingVertical: 10, borderWidth: 1, borderColor: '#DCE8F4' }, metric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, metricLined: { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' }, metricValue: { color: palette.navy, fontSize: 20, fontWeight: '900', marginTop: 1 }, metricLabel: { color: '#62728A', fontSize: 9.5, fontWeight: '700' },
  actionCard: { minHeight: 134, borderRadius: 17, backgroundColor: '#FFFFFF', flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6, borderWidth: 1, borderColor: '#D9E8F8', shadowColor: '#0B63CE', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }, actionTile: { width: '49%', minHeight: 57, borderRadius: 13, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#DCEBFA', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6 }, actionIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, actionTitleRow: { minHeight: 18, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, actionTitle: { flex: 1, color: palette.navy, fontSize: 10.8, fontWeight: '900', textAlign: 'center' }, actionBody: { color: palette.navy, fontSize: 8.8, lineHeight: 10.5, fontWeight: '600', textAlign: 'center' },
  claimCard: { minHeight: 151, borderRadius: 17, backgroundColor: palette.navy, padding: 13 }, claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, claimIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, borderColor: '#F5B700', alignItems: 'center', justifyContent: 'center' }, claimTitle: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '900' }, claimMetrics: { flex: 1, flexDirection: 'row', marginTop: 9 }, claimMetric: { flex: 1, alignItems: 'center', justifyContent: 'center' }, claimMetricLined: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.32)' }, claimMetricLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' }, claimMetricValue: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 5 }, claimMetricDetailLabel: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '500', marginTop: 1 }, claimMetricDetail: { color: '#F6C33B', fontSize: 15, fontWeight: '900', marginTop: 1 }, claimMetricDetailGreen: { color: '#68BF5B' },
  supportCard: { minHeight: 60, borderRadius: 17, backgroundColor: '#FFFFFF', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 }, supportCopy: { flex: 1 }, supportTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, supportText: { color: palette.navy, fontSize: 11.5, fontWeight: '500', marginTop: 1 }, nav: { minHeight: 82, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0' },
});