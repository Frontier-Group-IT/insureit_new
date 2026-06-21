import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/customer-dashboard';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getProfile, isValidProfile, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, ClaimTask, Customer, Policy, Profile, Vehicle } from '@/lib/types';

const fleetSketch = require('../../assets/brand/customer-fleet-sketch.png');
const exchangeVehicleIcon = require('../../assets/brand/exchange-vehicle-icon.png');

const activeStatuses = new Set<Claim['current_status']>(['Draft', 'Accident Reported', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Pending', 'Documents Submitted', 'Claim Intimated', 'Surveyor Appointed', 'Vehicle Inspected', 'Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Estimate Submitted', 'Approval Pending', 'Repair Started', 'Repair Completed', 'DO Submitted', 'Final Bill Submitted', 'Settlement Under Process']);

export default function CustomerMockupHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const nextProfile = await getProfile(session.user.id);
        if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') return router.replace('/access-denied');
        const nextCustomer = await getCustomerForUser(session.user.id);
        if (!mounted) return;
        setProfile(nextProfile); setCustomer(nextCustomer);
        if (nextCustomer) {
          const [vehicleResult, policyResult, claimResult, taskResult] = await Promise.all([
            supabase.from('vehicles').select('*').eq('customer_id', nextCustomer.id),
            supabase.from('policies').select('*').eq('customer_id', nextCustomer.id),
            supabase.from('claims').select('*').eq('customer_id', nextCustomer.id),
            supabase.from('claim_tasks').select('*').eq('status', 'open').order('created_at', { ascending: false }),
          ]);
          if (!mounted) return;
          const nextClaims = claimResult.data ?? [];
          setVehicles(vehicleResult.data ?? []); setPolicies(policyResult.data ?? []); setClaims(nextClaims);
          setTasks((taskResult.data ?? []).filter((task) => nextClaims.some((claim) => claim.id === task.claim_id)));
        }
      } catch { if (mounted) setError('We could not load your test dashboard.'); }
      finally { if (mounted) setLoading(false); }
    }
    void load(); return () => { mounted = false; };
  }, [router]);

  const name = customer?.contact_name ?? profile?.full_name ?? 'Customer';
  const firstName = name.split(' ')[0] || 'Customer';
  const active = useMemo(() => claims.filter((claim) => activeStatuses.has(claim.current_status)), [claims]);
  const settled = useMemo(() => claims.filter((claim) => claim.current_status === 'Settled' || claim.current_status === 'Closed'), [claims]);
  const documentTasks = useMemo(() => tasks.filter((task) => /^Final document: /i.test(task.title) || /reupload|upload.*document/i.test(task.title)), [tasks]);
  const pendingTask = documentTasks[0];
  const pendingActionCount = pendingTask ? documentTasks.filter((task) => task.claim_id === pendingTask.claim_id).length : 0;
  const estimate = active.reduce((total, claim) => total + (claim.estimated_loss ?? 0), 0);
  const invoices = settled.reduce((total, claim) => total + (claim.settlement_amount ?? claim.approved_amount ?? 0), 0);

  if (loading) return <View style={styles.loading}><LoadingState label="Opening test dashboard" /></View>;
  if (error) return <View style={styles.loading}><Text style={styles.error}>{error}</Text><Pressable onPress={() => router.replace('/customer/home')}><Text style={styles.retry}>Try again</Text></Pressable><Pressable onPress={() => void signOut(router)}><Text style={styles.retry}>Sign out</Text></Pressable></View>;

  return <SafeAreaView style={styles.safeArea} edges={['top']}>
    <View style={styles.header}>
      <Pressable onPress={() => router.replace('/customer/home')} style={styles.brand}><BrandLogo width={166} /></Pressable>
      <Pressable onPress={() => router.push('/customer/notifications')} style={styles.iconCircle}><NotificationBell /></Pressable>
      <Pressable onPress={() => router.push('/customer/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initialFor(name)}</Text></Pressable>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingBlock}><Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text><Text style={styles.subGreeting}>Manage your vehicles, renewals and claims</Text><Text style={styles.subGreeting}>all in one place.</Text></View>
      <Pressable onPress={() => pendingTask ? router.push({ pathname: '/customer/upload-documents', params: { claimId: pendingTask.claim_id } }) : router.push('/customer/claims')} style={styles.pendingCard}><View style={styles.pendingIcon}><MaterialCommunityIcons name="alert-circle" size={28} color="#FFFFFF" /></View><View style={styles.pendingCopy}><Text style={styles.pendingTitle}>Pending Action</Text><Text style={styles.pendingText}>{pendingActionCount ? `You have ${pendingActionCount} pending action${pendingActionCount === 1 ? '' : 's'} in your claim.` : 'No pending action in your claim.'}</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color="#7A3A00" /></Pressable>
      <Pressable onPress={() => router.push('/customer/vehicles')} style={styles.vehicleCard}><View style={styles.vehicleLeft}><View style={styles.vehicleIcon}><MaterialCommunityIcons name="car" size={25} color="#0A43A3" /></View><View style={styles.vehicleTextBlock}><Text style={styles.vehicleTitle}>My Vehicles</Text><Text style={styles.vehicleNumber}>{vehicles.length}</Text><Text style={styles.vehicleLabel}>Vehicles</Text></View></View><Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" /><MaterialCommunityIcons name="chevron-right" size={28} color="#7A3A00" /></Pressable>
      <View style={styles.actionCard}><ActionTile icon="calendar-month-outline" title="Renewal Dues" body="View and pay your policy renewals" onPress={() => router.push('/customer/policies')} tone="orange" /><View style={styles.actionDivider} /><ActionTile icon="file-document-outline" title="Get Quote" body="Get a quote for new insurance" onPress={() => router.push('/customer/support')} tone="blue" /><View style={styles.actionDivider} /><ActionTile imageSource={exchangeVehicleIcon} title="Exchange Vehicle" body="Exchange your old car for a new one" onPress={() => router.push('/customer/support')} tone="green" /></View>
      <Pressable onPress={() => router.push('/customer/claims')} style={styles.claimCard}><View style={styles.claimHeader}><View style={styles.claimIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#F5B700" /></View><Text style={styles.claimTitle}>Active Claim</Text></View><View style={styles.claimMetrics}><ClaimMetric label="Total Claims" value={claims.length} /><ClaimMetric label="Active Claims" value={active.length} detailLabel="Estimated Amount" detail={money(estimate)} lined /><ClaimMetric label="Settled Claims" value={settled.length} detailLabel="Invoice Amount" detail={money(invoices)} green lined /></View></Pressable>
      <Pressable onPress={() => router.push('/customer/support')} style={styles.supportCard}><MaterialCommunityIcons name="headset" size={33} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color={palette.navy} /></Pressable>
    </ScrollView>
    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/claims')} onVehicles={() => router.push('/customer/vehicles')} onSupport={() => router.push('/customer/support')} onProfile={() => router.push('/customer/profile')} /></View>
  </SafeAreaView>;
}

function ActionTile({ icon, imageSource, title, body, onPress, tone }: { icon?: keyof typeof MaterialCommunityIcons.glyphMap; imageSource?: ImageSourcePropType; title: string; body: string; onPress: () => void; tone: 'orange' | 'blue' | 'green' }) {
  const color = tone === 'orange' ? '#D99012' : tone === 'green' ? '#21A453' : '#0A43A3';
  const backgroundColor = tone === 'orange' ? '#FFF7EA' : tone === 'green' ? '#F7FBFF' : '#EEF5FF';
  return <Pressable onPress={onPress} style={styles.actionTile}><View style={[styles.actionIcon, { backgroundColor }]}>{imageSource ? <Image source={imageSource} style={styles.actionImageIcon} resizeMode="contain" /> : <MaterialCommunityIcons name={icon ?? 'circle-outline'} size={27} color={color} />}</View><View style={styles.actionTitleRow}><Text style={styles.actionTitle}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={22} color="#7A3A00" /></View><Text style={styles.actionBody}>{body}</Text></Pressable>;
}

function ClaimMetric({ label, value, detailLabel, detail, lined, green }: { label: string; value: number; detailLabel?: string; detail?: string; lined?: boolean; green?: boolean }) {
  return <View style={[styles.claimMetric, lined && styles.claimMetricLined]}><Text style={styles.claimMetricLabel}>{label}</Text><Text style={styles.claimMetricValue}>{value}</Text>{detailLabel ? <Text style={styles.claimMetricDetailLabel}>{detailLabel}</Text> : null}{detail ? <Text style={[styles.claimMetricDetail, green && styles.claimMetricDetailGreen]}>{detail}</Text> : null}</View>;
}

function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }
function money(value: number) { return Math.round(value).toLocaleString('en-IN'); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD', gap: 14 }, error: { color: palette.navy, fontWeight: '900' }, retry: { color: palette.navy, fontWeight: '900' },
  header: { height: 92, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' }, brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }, iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E6EF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.navy, fontWeight: '900', fontSize: 21 },
  scroll: { flex: 1 }, body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18, gap: 11 }, greetingBlock: { marginBottom: 1 }, greeting: { color: palette.navy, fontSize: 19, lineHeight: 24, fontWeight: '900' }, subGreeting: { color: palette.navy, fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
  pendingCard: { minHeight: 64, borderRadius: 15, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#F3DDBD', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, pendingIcon: { width: 49, height: 49, borderRadius: 11, backgroundColor: '#DD7300', alignItems: 'center', justifyContent: 'center' }, pendingCopy: { flex: 1, minWidth: 0 }, pendingTitle: { color: '#834100', fontSize: 16, fontWeight: '900' }, pendingText: { color: palette.navy, fontSize: 12.5, fontWeight: '600', marginTop: 3 },
  vehicleCard: { minHeight: 144, borderRadius: 17, backgroundColor: '#FFFFFF', paddingLeft: 13, paddingRight: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }, vehicleLeft: { width: 142, zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, vehicleTextBlock: { flex: 1, paddingTop: 1 }, vehicleIcon: { width: 43, height: 43, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', marginTop: 0 }, vehicleTitle: { color: palette.navy, fontSize: 15.5, fontWeight: '900' }, vehicleNumber: { color: palette.navy, fontSize: 31, lineHeight: 35, fontWeight: '900', marginTop: 3 }, vehicleLabel: { color: palette.navy, fontSize: 13, fontWeight: '700' }, fleetImage: { flex: 1, height: 132, marginLeft: -14, marginRight: -12 },
  actionCard: { minHeight: 132, borderRadius: 17, backgroundColor: '#FFFFFF', flexDirection: 'row', paddingVertical: 15, shadowColor: '#122544', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }, actionTile: { flex: 1, alignItems: 'center', paddingHorizontal: 7 }, actionIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, actionImageIcon: { width: 38, height: 38 }, actionTitleRow: { minHeight: 36, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, actionTitle: { flex: 1, color: palette.navy, fontSize: 12.7, fontWeight: '900', textAlign: 'center' }, actionBody: { color: palette.navy, fontSize: 10.2, lineHeight: 14, fontWeight: '500', textAlign: 'center' }, actionDivider: { width: 1, backgroundColor: '#E2E6EE', marginVertical: 8 },
  claimCard: { minHeight: 176, borderRadius: 17, backgroundColor: palette.navy, padding: 15, overflow: 'hidden' }, claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, claimIcon: { width: 42, height: 42, borderRadius: 13, borderWidth: 1.5, borderColor: '#F5B700', alignItems: 'center', justifyContent: 'center' }, claimTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, claimMetrics: { flex: 1, flexDirection: 'row', marginTop: 13 }, claimMetric: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 }, claimMetricLined: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.32)' }, claimMetricLabel: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '500', textAlign: 'center' }, claimMetricValue: { color: '#FFFFFF', fontSize: 32, lineHeight: 37, fontWeight: '900', marginTop: 8 }, claimMetricDetailLabel: { color: '#FFFFFF', fontSize: 10.5, lineHeight: 13, fontWeight: '500', marginTop: 2, textAlign: 'center' }, claimMetricDetail: { color: '#F6C33B', fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 2, textAlign: 'center' }, claimMetricDetailGreen: { color: '#68BF5B' },
  supportCard: { minHeight: 68, borderRadius: 17, backgroundColor: '#FFFFFF', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: '#122544', shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 }, supportCopy: { flex: 1 }, supportTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' }, supportText: { color: palette.navy, fontSize: 13, fontWeight: '500', marginTop: 2 }, nav: { height: 82, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0' },
});
