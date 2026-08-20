import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { BrandLogo } from '@/components/first-look';
import { GroupHomeScreen } from '@/components/group/group-home-screen';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState, UniversalBottomTabs } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getOnboardingApplicationForUser, getProfile, isValidProfile, resetLocalAuthState, signOut } from '@/lib/auth';
import { buildComplianceRenewals } from '@/lib/compliance-renewals';
import { getSelectedCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, ClaimTask, Customer, CustomerOnboardingApplication, Policy, Profile, Vehicle } from '@/lib/types';

const fleetSketch = require('../../assets/brand/dashboard/dashboard-fleet-hero.png');
const claimsDeskPhone = '+916264911014';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ExternalPolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string | null;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_amount?: number | null;
  insured_declared_value?: number | null;
};

const closedStatuses = new Set<Claim['current_status']>(['Settled', 'Closed', 'Rejected', 'Claim Complete']);

export default function CustomerMockupHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedContext, setSelectedContext] = useState<CustomerAccountContext | null>(null);
  const [onboarding, setOnboarding] = useState<CustomerOnboardingApplication | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [kycPromptDismissed, setKycPromptDismissed] = useState(true);
  const mountedRef = useRef(true);

  const loadDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError('');
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextProfile = await waitForCustomerProfile(session.user.id);
      if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') return router.replace('/access-denied');
      const [nextOnboarding, selected] = await Promise.all([
        getOnboardingApplicationForUser(session.user.id),
        getSelectedCustomerContext(),
      ]);
      const nextCustomer = selected
        ? await getCustomerByContext(selected)
        : await getCustomerForUser(session.user.id);
      if (!mountedRef.current) return;
      setProfile(nextProfile);
      setCustomer(nextCustomer);
      setOnboarding(nextOnboarding);
      setSelectedContext(selected);
      setVehicles([]);
      setPolicies([]);
      setClaims([]);
      setTasks([]);
      const promptDismissed = await getKycPromptDismissed(session.user.id);
      if (mountedRef.current) setKycPromptDismissed(Boolean(promptDismissed) || Boolean(nextCustomer) || nextOnboarding?.status === 'submitted' || nextOnboarding?.status === 'under_review');
      if (nextCustomer && !isPortfolioDashboardContext(selected)) {
        const [vehicleResult, policyResult, externalPolicyResult, claimResult, taskResult] = await Promise.all([
          supabase.from('vehicles').select('*').eq('customer_id', nextCustomer.id),
          supabase.from('policies').select('*').eq('customer_id', nextCustomer.id),
          (supabase as any).from('external_policies').select('id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,premium_amount,insured_declared_value').eq('customer_id', nextCustomer.id),
          supabase.from('claims').select('*').eq('customer_id', nextCustomer.id),
          supabase.from('claim_tasks').select('*').eq('status', 'open').order('created_at', { ascending: false }),
        ]);
        if (!mountedRef.current) return;
        if (vehicleResult.error) console.warn('Customer vehicles load failed', vehicleResult.error.message);
        if (policyResult.error) console.warn('Customer policies load failed', policyResult.error.message);
        if (externalPolicyResult.error) console.warn('Customer external policies load failed', externalPolicyResult.error.message);
        if (claimResult.error) console.warn('Customer claims load failed', claimResult.error.message);
        if (taskResult.error) console.warn('Customer claim tasks load failed', taskResult.error.message);
        const nextClaims = claimResult.data ?? [];
        const nextPolicies = [...(policyResult.data ?? []), ...((externalPolicyResult.data ?? []) as ExternalPolicyRow[]).map(externalToPolicy)];
        setVehicles(vehicleResult.data ?? []);
        setPolicies(nextPolicies);
        setClaims(nextClaims);
        setTasks((taskResult.data ?? []).filter((task) => nextClaims.some((claim) => claim.id === task.claim_id)));
      }
      setLastUpdated(new Date());
    } catch (nextError) {
      console.warn('Customer dashboard load failed', nextError);
      if (mountedRef.current) setError(dashboardLoadErrorMessage(nextError));
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [router]);

  useEffect(() => {
    mountedRef.current = true;
    void loadDashboard('initial');
    return () => { mountedRef.current = false; };
  }, [loadDashboard]);

  const name = customer?.contact_name ?? profile?.full_name ?? 'Customer';
  const firstName = name.split(' ')[0] || 'Customer';
  const activeClaims = useMemo(() => claims.filter((claim) => !closedStatuses.has(claim.current_status)), [claims]);
  const settledClaims = useMemo(() => claims.filter((claim) => claim.current_status === 'Settled' || claim.current_status === 'Closed' || claim.current_status === 'Claim Complete'), [claims]);
  const documentTasks = useMemo(() => tasks.filter((task) => /^Final document: /i.test(task.title) || /reupload|upload.*document/i.test(task.title)), [tasks]);
  const pendingTask = documentTasks[0];
  const pendingActionCount = pendingTask ? documentTasks.filter((task) => task.claim_id === pendingTask.claim_id).length : 0;
  const renewals = useMemo(() => buildComplianceRenewals({ vehicles, policies }), [policies, vehicles]);
  const renewalAttentionCount = renewals.totalPending;
  const activePolicyVehicleIds = useMemo(() => new Set(policies.filter((policy) => !isExpired(policy.end_date)).map((policy) => policy.vehicle_id)), [policies]);
  const protectedVehicles = vehicles.filter((vehicle) => activePolicyVehicleIds.has(vehicle.id)).length;
  const protectionScore = vehicles.length ? Math.round((protectedVehicles / vehicles.length) * 100) : 0;
  const claimAttentionCount = documentTasks.length;
  const attentionCount = renewalAttentionCount + claimAttentionCount;
  const openClaimAmount = activeClaims.reduce((total, claim) => total + (claim.estimated_loss ?? 0), 0);
  const settledClaimAmount = settledClaims.reduce((total, claim) => total + (claim.settlement_amount ?? claim.approved_amount ?? 0), 0);
  const totalClaimAmount = openClaimAmount + settledClaimAmount;
  const kycRoute = onboarding?.partner_type === 'individual_proprietor' ? '/customer/kyc/individual' : '/customer/kyc/partner-type';
  const kycAwaitingReview = onboarding?.status === 'submitted' || onboarding?.status === 'under_review';
  const kycReviewNotes = onboardingReviewNotes(onboarding);

  function openPrimaryAction() {
    if (!customer) {
      if (kycAwaitingReview) router.push('/customer/profile');
      else router.push(kycRoute as Href);
      return;
    }
    if (pendingTask) router.push({ pathname: '/customer/upload-documents', params: { claimId: pendingTask.claim_id } });
    else if (renewalAttentionCount > 0) router.push('/customer/renewals' as Href);
    else if (activeClaims.length > 0) router.push('/customer/claims');
    else if (vehicles.length > 0) router.push('/customer/vehicles');
    else router.push('/customer/add-vehicle');
  }

  async function dismissKycPrompt() {
    setKycPromptDismissed(true);
    if (profile?.id) await AsyncStorage.setItem(`insureit:kyc-prompt-dismissed:${profile.id}`, 'true');
  }

  if (loading) return <View style={styles.loading}><LoadingState label="Opening dashboard" /></View>;
  if (error) return <View style={styles.loading}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void loadDashboard('refresh')}><Text style={styles.retry}>Try again</Text></Pressable><Pressable onPress={() => void resetLocalAuthState(router)}><Text style={styles.retry}>Reset login</Text></Pressable><Pressable onPress={() => void signOut(router)}><Text style={styles.retry}>Sign out</Text></Pressable></View>;
  if (profile && isPortfolioDashboardContext(selectedContext)) return <GroupHomeScreen profile={profile} groupContext={selectedContext} />;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable onPress={() => router.replace('/customer/home')} style={styles.brand}><BrandLogo width={158} /></Pressable>
      <Pressable onPress={() => router.push('/customer/notifications')} style={styles.iconCircle}><NotificationBell /></Pressable>
      <Pressable onPress={() => router.push('/customer/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initialFor(name)}</Text></Pressable>
    </View>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard('refresh')} tintColor={palette.navy} colors={[palette.navy]} />}
    >
      <DashboardIntro firstName={firstName} lastUpdated={lastUpdated} attentionCount={attentionCount} groupName={selectedContext?.group_name} onAttentionPress={openPrimaryAction} />
      <FleetSnapshot
        vehicles={vehicles}
        protectedVehicles={protectedVehicles}
        protectionScore={protectionScore}
        onOpen={() => router.push('/customer/vehicles')}
      />
      <QuickActionDock
        renewalDue={renewalAttentionCount}
        claimTasks={claimAttentionCount}
        onRenewals={() => router.push('/customer/renewals' as Href)}
        onQuote={() => router.push('/customer/insurance-quote')}
        onChallan={() => router.push('/customer/e-challan' as Href)}
        onClaim={() => router.push('/customer/start-claim')}
      />
      <ClaimsSummaryCard
        totalCount={claims.length}
        openCount={activeClaims.length}
        settledCount={settledClaims.length}
        totalAmount={totalClaimAmount}
        openAmount={openClaimAmount}
        settledAmount={settledClaimAmount}
        pendingActionCount={pendingActionCount || claimAttentionCount}
        onOpenAll={() => router.push('/customer/claims')}
        onPendingAction={() => pendingTask ? router.push({ pathname: '/customer/upload-documents', params: { claimId: pendingTask.claim_id } }) : router.push('/customer/claims')}
      />
      <SupportActionCenter onSupport={() => router.push('/customer/support')} />
      <Text style={styles.appVersion}>Version 1.8.3</Text>
    </ScrollView>
    <UniversalBottomTabs role="customer" pathname="/customer/home" bottomInset={0} customerContext={selectedContext} />
    <KycRequiredModal
      visible={!customer && !kycPromptDismissed}
      application={onboarding}
      reviewNotes={kycReviewNotes}
      onStart={() => router.push(kycRoute as Href)}
      onDismiss={() => void dismissKycPrompt()}
      onSignOut={() => void signOut(router)}
    />
  </SafeAreaView>;
}

function DashboardIntro({ firstName, lastUpdated, attentionCount, groupName, onAttentionPress }: { firstName: string; lastUpdated: Date | null; attentionCount: number; groupName?: string | null; onAttentionPress: () => void }) {
  const hasAttention = attentionCount > 0;
  return (
    <View style={styles.greetingBlock}>
      <View>
        <Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text>
        <View style={styles.greetingMetaRow}>
          <Pressable disabled={!hasAttention} onPress={onAttentionPress} style={({ pressed }) => [styles.attentionLink, pressed && styles.textPressed]}>
            {hasAttention ? (
              <>
                <MaterialCommunityIcons name="alert-circle-outline" size={13} color="#C98918" />
                <Text style={styles.attentionLinkStrong}>{attentionCount} item{attentionCount === 1 ? '' : 's'}</Text>
                <Text style={styles.attentionLinkText}>need attention</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle-outline" size={13} color="#10A66F" />
                <Text style={styles.attentionLinkText}>Everything is up to date</Text>
              </>
            )}
          </Pressable>
          {lastUpdated ? (
            <View style={styles.syncPill}>
              <MaterialCommunityIcons name="cloud-check-outline" size={12} color="#607089" />
              <Text style={styles.syncTime}>{shortTime(lastUpdated)}</Text>
            </View>
          ) : null}
        </View>
        {groupName ? <Text style={styles.parentCompany}>Associated with {groupName}</Text> : null}
      </View>
    </View>
  );
}

function FleetSnapshot({ vehicles, protectedVehicles, protectionScore, onOpen }: { vehicles: Vehicle[]; protectedVehicles: number; protectionScore: number; onOpen: () => void }) {
  const unprotected = Math.max(vehicles.length - protectedVehicles, 0);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.fleetCard, pressed && styles.cardPressed]}>
      <Text style={styles.sectionEyebrow}>Your fleet summary</Text>
      <View style={styles.fleetMainRow}>
        <View style={styles.fleetCountBlock}>
          <Text style={styles.fleetCount}>{vehicles.length}</Text>
          <Text style={styles.fleetCountLabel}>Vehicles</Text>
        </View>
        <Image source={fleetSketch} style={styles.fleetImageHero} resizeMode="contain" />
        <FleetCoverageRing score={protectionScore} hasVehicles={vehicles.length > 0} />
      </View>
      <FleetStatusTicker totalVehicles={vehicles.length} unprotectedVehicles={unprotected} />
    </Pressable>
  );
}

function FleetCoverageRing({ score, hasVehicles }: { score: number; hasVehicles: boolean }) {
  const safeScore = hasVehicles ? Math.max(0, Math.min(100, score)) : 0;
  const progress = useRef(new Animated.Value(0)).current;
  const radius = 26;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  useEffect(() => {
    Animated.timing(progress, { toValue: safeScore, duration: 850, useNativeDriver: false }).start();
  }, [progress, safeScore]);
  const strokeDashoffset = progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });
  return (
    <View style={styles.scoreRing}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle cx="32" cy="32" r={radius} stroke={palette.navy} strokeWidth={1.5} fill="#FFFFFF" />
        <AnimatedCircle
          cx="32"
          cy="32"
          r={radius}
          stroke="#174EA6"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          originX="32"
          originY="32"
          rotation="-90"
        />
      </Svg>
      <View style={styles.scoreCore}>
        <Text style={styles.scoreValue}>{safeScore}%</Text>
        <Text style={styles.scoreLabel}>Covered</Text>
      </View>
    </View>
  );
}

function FleetStatusTicker({ totalVehicles, unprotectedVehicles }: { totalVehicles: number; unprotectedVehicles: number }) {
  const fullyCovered = totalVehicles > 0 && unprotectedVehicles === 0;
  return (
    <View style={styles.fleetTicker}>
      {fullyCovered ? (
        <>
          <MaterialCommunityIcons name="check-decagram" size={17} color="#10A66F" />
          <Text style={styles.fleetTickerText} numberOfLines={1}>All vehicles are protected</Text>
        </>
      ) : (
        <>
          <AttentionPulseIcon />
          <Text style={styles.fleetTickerText} numberOfLines={1}><Text style={[styles.fleetTickerValue, { color: '#E5484D' }]}>{unprotectedVehicles}</Text> vehicle{unprotectedVehicles === 1 ? '' : 's'} without active policy</Text>
        </>
      )}
      <MaterialCommunityIcons name="chevron-right" size={17} color="#174EA6" />
    </View>
  );
}

function AttentionPulseIcon() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  return (
    <Animated.View style={[styles.attentionPulseIcon, { opacity, transform: [{ scale }] }]}>
      <MaterialCommunityIcons name="alert-circle" size={15} color="#FFFFFF" />
    </Animated.View>
  );
}

function QuickActionDock({ renewalDue, claimTasks, onRenewals, onQuote, onChallan, onClaim }: { renewalDue: number; claimTasks: number; onRenewals: () => void; onQuote: () => void; onChallan: () => void; onClaim: () => void }) {
  return (
    <View style={styles.quickDock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Quick actions</Text>
        <Text style={styles.sectionHint}>One tap services</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction icon="calendar-month-outline" image={require('../../assets/brand/dashboard/dashboard-renewal.png')} label="Renewal" badge={renewalDue} animateBadge tone="#FFF6E8" color="#C98918" onPress={onRenewals} />
        <QuickAction icon="shield-plus-outline" image={require('../../assets/brand/dashboard/dashboard-start-claim.png')} label="Start claim" badge={claimTasks} tone="#E8F8F0" color="#10A66F" onPress={onClaim} />
        <QuickAction icon="file-document-outline" image={require('../../assets/brand/dashboard/dashboard-get-quote.png')} label="Get quote" tone="#EAF3FF" color="#174EA6" onPress={onQuote} />
        <QuickAction icon="ticket-confirmation-outline" image={require('../../assets/brand/dashboard/dashboard-echallan.png')} label="E-Challan" tone="#E6FAFD" color="#0EAFC8" onPress={onChallan} />
      </View>
    </View>
  );
}

function QuickAction({ icon, image, label, badge, animateBadge, tone, color, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; image?: ImageSourcePropType; label: string; badge?: number; animateBadge?: boolean; tone: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}>
      {badge ? <ActionBadge value={badge} animated={Boolean(animateBadge)} /> : null}
      <View style={[styles.quickIcon, { backgroundColor: tone }]}>
        {image ? <Image source={image} style={styles.quickIconArtwork} resizeMode="contain" /> : <MaterialCommunityIcons name={icon} size={22} color={color} />}
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function ActionBadge({ value, animated }: { value: number; animated: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animated) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animated, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.11] });
  return <Animated.View style={[styles.actionBadge, { transform: [{ scale }] }]}><Text style={styles.actionBadgeText}>{value}</Text></Animated.View>;
}

function ClaimsSummaryCard({ totalCount, openCount, settledCount, totalAmount, openAmount, settledAmount, pendingActionCount, onOpenAll, onPendingAction }: { totalCount: number; openCount: number; settledCount: number; totalAmount: number; openAmount: number; settledAmount: number; pendingActionCount: number; onOpenAll: () => void; onPendingAction: () => void }) {
  const hasPendingAction = pendingActionCount > 0;
  return (
    <View style={styles.claimSummaryCard}>
      <Pressable onPress={onOpenAll} style={({ pressed }) => [styles.claimSummaryTop, pressed && styles.cardPressed]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.claimCardTitle}>Claims</Text>
          <View style={styles.claimOpenLink}><Text style={styles.claimOpenLinkText}>View all</Text><MaterialCommunityIcons name="arrow-right" size={15} color="#BFD4F7" /></View>
        </View>
        <View style={styles.claimMetricRow}>
          <ClaimMetric label="Total" value={totalCount} amount={moneyCompact(totalAmount)} accent="#6FA8FF" />
          <View style={styles.claimMetricDivider} />
          <ClaimMetric label="Open" value={openCount} amount={moneyCompact(openAmount)} accent="#F5B94C" />
          <View style={styles.claimMetricDivider} />
          <ClaimMetric label="Settled" value={settledCount} amount={moneyCompact(settledAmount)} accent="#4FD79B" />
        </View>
      </Pressable>
      <Pressable onPress={hasPendingAction ? onPendingAction : onOpenAll} style={({ pressed }) => [styles.claimTicker, hasPendingAction && styles.claimTickerHot, pressed && styles.cardPressed]}>
        <MaterialCommunityIcons name={hasPendingAction ? 'alert-decagram' : 'check-decagram'} size={17} color={hasPendingAction ? '#C98918' : '#10A66F'} />
        <Text style={styles.claimTickerText} numberOfLines={1}>{hasPendingAction ? `${pendingActionCount} pending claim action${pendingActionCount === 1 ? '' : 's'}` : totalCount ? 'All claim actions are clear' : 'No claims yet'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#174EA6" />
      </Pressable>
    </View>
  );
}

function ClaimMetric({ label, value, amount, accent }: { label: string; value: number; amount: string; accent: string }) {
  return (
    <View style={styles.claimMetric}>
      <Text style={[styles.claimMetricValue, { color: accent }]}>{value}</Text>
      <Text style={styles.claimMetricLabel}>{label}</Text>
      <Text style={styles.claimMetricAmount}>{amount}</Text>
    </View>
  );
}

function SupportActionCenter({ onSupport }: { onSupport: () => void }) {
  return (
    <View style={styles.supportCard}>
      <View style={styles.supportTop}>
        <Text style={styles.supportHeaderLine} numberOfLines={1}>
          <Text style={styles.supportTitle}>Insureit Support</Text>
          <Text style={styles.supportDivider}> | </Text>
          <Text style={styles.supportTagline}>we are here when it matters</Text>
        </Text>
      </View>
      <View style={styles.supportActions}>
        <SupportButton icon="phone-in-talk" label="Call" color="#10A66F" onPress={() => void callClaimsDesk()} />
        <SupportButton icon="whatsapp" label="WhatsApp" color="#128C7E" onPress={() => void openClaimsDeskWhatsApp()} />
        <SupportButton icon="ticket-confirmation" label="Ticket" color="#174EA6" onPress={onSupport} />
      </View>
    </View>
  );
}

function SupportButton({ icon, label, color, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.supportButton, pressed && styles.cardPressed]}>
      <View style={[styles.supportButtonIcon, { backgroundColor: color }]}><MaterialCommunityIcons name={icon} size={21} color="#FFFFFF" /></View>
      <Text style={styles.supportButtonText}>{label}</Text>
    </Pressable>
  );
}

function KycRequiredModal({ visible, application, reviewNotes, onStart, onDismiss, onSignOut }: { visible: boolean; application: CustomerOnboardingApplication | null; reviewNotes: string | null; onStart: () => void; onDismiss: () => void; onSignOut: () => void }) {
  const awaitingReview = application?.status === 'submitted' || application?.status === 'under_review';
  const changesRequested = application?.status === 'changes_requested';
  const started = Boolean(application?.partner_type);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.kycBackdrop}>
        <View accessibilityRole="alert" style={styles.kycModal}>
          <View style={styles.kycArtwork}>
            <MaterialCommunityIcons name={changesRequested ? 'file-edit-outline' : 'clipboard-account-outline'} size={67} color="#1597E5" />
            <View style={styles.kycCheck}><MaterialCommunityIcons name={awaitingReview ? 'clock-outline' : 'check'} size={22} color="#FFFFFF" /></View>
          </View>
          <Text style={styles.kycTitle}>{awaitingReview ? 'KYC submitted' : changesRequested ? 'KYC update required' : 'Kindly complete your KYC'}</Text>
          <Text style={styles.kycBody}>{awaitingReview ? 'Your details are being reviewed. We will notify you when your account is ready.' : changesRequested ? reviewNotes || 'Please update and resubmit your KYC details.' : 'Please complete your KYC to access all features and services.'}</Text>
          <Pressable accessibilityRole="button" disabled={awaitingReview} onPress={onStart} style={[styles.kycButton, awaitingReview && styles.kycButtonDisabled]}>
            <Text style={styles.kycButtonText}>{awaitingReview ? 'Under review' : started ? 'Continue KYC' : 'Start'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.kycExplore}><Text style={styles.kycExploreText}>Explore for now</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.kycSignOut}><Text style={styles.kycSignOutText}>Sign out</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function moneyCompact(value: number) {
  const amount = Math.max(Math.round(value || 0), 0);
  if (amount >= 10000000) return `INR ${trimDecimal(amount / 10000000)}Cr`;
  if (amount >= 100000) return `INR ${trimDecimal(amount / 100000)}L`;
  if (amount >= 1000) return `INR ${Math.round(amount / 1000)}k`;
  return `INR ${amount.toLocaleString('en-IN')}`;
}

function trimDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, '');
}

function externalToPolicy(policy: ExternalPolicyRow): Policy {
  return {
    id: policy.id,
    created_at: undefined,
    updated_at: undefined,
    customer_id: policy.customer_id,
    vehicle_id: policy.vehicle_id,
    insurance_company_id: policy.insurance_company_id ?? '',
    policy_no: policy.policy_no,
    policy_type: policy.policy_type,
    start_date: policy.start_date,
    end_date: policy.end_date,
    premium_amount: policy.premium_amount ?? null,
    insured_declared_value: policy.insured_declared_value ?? null,
  };
}

function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }
function shortTime(value: Date) { return value.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
function isExpired(value: string) { return new Date(`${value}T23:59:59`).getTime() < Date.now(); }
function isPortfolioDashboardContext(context: CustomerAccountContext | null) {
  return Boolean(context && ['group', 'corporate', 'dealership'].includes(context.partner_type));
}
async function getCustomerByContext(context: CustomerAccountContext) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', context.customer_id).maybeSingle();
  if (error) throw error;
  return data;
}
function onboardingReviewNotes(application: CustomerOnboardingApplication | null) {
  const draft = application?.draft_data;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
  const notes = draft.review_notes;
  return typeof notes === 'string' && notes.trim() ? notes.trim() : null;
}
async function waitForCustomerProfile(userId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 9000) {
    const profile = await getProfile(userId);
    if (profile) return profile;
    await delay(650);
  }
  return getProfile(userId);
}
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function getKycPromptDismissed(userId: string) {
  try { return await AsyncStorage.getItem(`insureit:kyc-prompt-dismissed:${userId}`); }
  catch (error) { console.warn('KYC prompt preference load failed', error); return null; }
}
function dashboardLoadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('timeout')) return 'Could not reach the InsureIT server. Check internet access and try again.';
  if (lowerMessage.includes('multiple') && lowerMessage.includes('rows')) return 'Your account has duplicate customer records. Please contact support to merge them.';
  return 'We could not load your dashboard. Please try again.';
}
async function callClaimsDesk() {
  await Linking.openURL(`tel:${claimsDeskPhone}`);
}
async function openClaimsDeskWhatsApp() {
  const phone = claimsDeskPhone.replace(/\D/g, '');
  const message = encodeURIComponent('Hello InsureIT, I need help with my policy or claim.');
  const appUrl = `whatsapp://send?phone=${phone}&text=${message}`;
  const webUrl = `https://wa.me/${phone}?text=${message}`;
  const supported = await Linking.canOpenURL(appUrl);
  await Linking.openURL(supported ? appUrl : webUrl);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF7FF' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF7FF', gap: 14, paddingHorizontal: 24 },
  error: { color: palette.navy, fontWeight: '900', textAlign: 'center' },
  retry: { color: palette.blue, fontWeight: '900', paddingVertical: 6 },
  header: { height: 60, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 92, gap: 7 },
  greetingBlock: { paddingHorizontal: 2, paddingTop: 2, paddingBottom: 1 },
  greeting: { color: palette.navy, fontSize: 21, lineHeight: 26, fontWeight: '900' },
  greetingMetaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  attentionLink: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 4 },
  attentionLinkStrong: { color: '#174EA6', fontSize: 12, lineHeight: 15, fontWeight: '900' },
  attentionLinkText: { color: '#5C6878', fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  syncPill: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncTime: { color: '#607089', fontSize: 11, fontWeight: '800' },
  parentCompany: { color: '#174EA6', fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 3 },
  liveHero: { minHeight: 182, borderRadius: 22, backgroundColor: palette.navy, padding: 17, overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch', shadowColor: '#071D49', shadowOpacity: 0.16, shadowRadius: 18, elevation: 5 },
  liveHeroUrgent: { backgroundColor: '#12305F' },
  heroOrbLarge: { position: 'absolute', right: -82, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.13)' },
  heroOrbSmall: { position: 'absolute', left: -54, bottom: -86, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(16,166,111,0.16)' },
  heroPulse: { position: 'absolute', right: 32, top: 35, width: 92, height: 92, borderRadius: 46, backgroundColor: '#FFFFFF' },
  heroContent: { flex: 1, minWidth: 0, zIndex: 2 },
  heroKickerRow: { alignSelf: 'flex-start', minHeight: 28, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4 },
  heroKicker: { color: '#E9F2FF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 13, maxWidth: 240 },
  heroBody: { color: '#D7E6F7', fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 7, maxWidth: 235 },
  heroButton: { alignSelf: 'flex-start', marginTop: 13, minHeight: 39, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  heroButtonText: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  heroGraphic: { width: 100, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  heroShield: { width: 78, height: 78, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.17)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  heroPlate: { position: 'absolute', right: 0, bottom: 24, width: 50, height: 43, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  attentionRail: { flexDirection: 'row', gap: 8 },
  attentionChip: { flex: 1, minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(7,29,73,0.06)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  attentionValue: { fontSize: 17, lineHeight: 20, fontWeight: '900', marginTop: 1 },
  attentionLabel: { color: '#5C6878', fontSize: 10.5, fontWeight: '800', marginTop: 1 },
  textPressed: { opacity: 0.62 },
  fleetCard: { minHeight: 132, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E7F7', padding: 9, overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  fleetTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fleetMainRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  fleetCountBlock: { width: 78, minWidth: 78, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  fleetCount: { color: palette.navy, fontSize: 34, lineHeight: 38, fontWeight: '900' },
  fleetCountLabel: { color: '#607089', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', marginTop: 1 },
  fleetCopy: { flex: 1, minWidth: 0 },
  sectionEyebrow: { color: '#607089', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  fleetTitle: { color: palette.navy, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 4 },
  scoreRing: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  scoreCore: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0EAF5', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: palette.navy, fontSize: 13.5, lineHeight: 16, fontWeight: '900' },
  scoreLabel: { color: '#607089', fontSize: 8, fontWeight: '900', marginTop: 0 },
  plateStack: { width: 142, zIndex: 2 },
  platePill: { alignSelf: 'flex-start', minHeight: 31, maxWidth: 135, borderRadius: 10, backgroundColor: '#F7FAFE', borderWidth: 1, borderColor: '#D8E7F7', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  platePillOverlap: { marginLeft: 12 },
  plateText: { color: palette.navy, fontSize: 11.2, fontWeight: '900' },
  fleetImage: { flex: 1, height: 96, marginLeft: -18, marginRight: -6 },
  fleetImageHero: { flex: 1, height: 74, marginLeft: -10, marginRight: -6, opacity: 0.95 },
  fleetFooter: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 },
  attentionPulseIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center' },
  fleetTicker: { minHeight: 24, marginTop: 3, paddingHorizontal: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fleetTickerText: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '900' },
  fleetTickerValue: { fontSize: 12.5, fontWeight: '900' },
  fleetTickerDivider: { color: '#B6C4D8', fontSize: 12, fontWeight: '900' },
  quickDock: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E7F7', padding: 9, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  sectionTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  sectionHint: { color: '#607089', fontSize: 11, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, minHeight: 66, borderRadius: 15, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E0EAF5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, position: 'relative' },
  quickIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickIconArtwork: { width: 30, height: 30 },
  quickLabel: { color: palette.navy, fontSize: 10.5, lineHeight: 13, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  actionBadge: { position: 'absolute', right: 7, top: 7, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, zIndex: 3 },
  actionBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  claimSummaryCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E7F7', overflow: 'hidden', shadowColor: '#071D49', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  claimSummaryTop: { backgroundColor: palette.navy, paddingHorizontal: 11, paddingVertical: 9 },
  claimOpenLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimOpenLinkText: { color: '#BFD4F7', fontSize: 11, fontWeight: '900' },
  claimMetricRow: { flexDirection: 'row', alignItems: 'stretch' },
  claimMetric: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  claimMetricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 8 },
  claimMetricValue: { fontSize: 21, lineHeight: 24, fontWeight: '900' },
  claimMetricLabel: { color: '#AAB9D6', fontSize: 10, fontWeight: '900', marginTop: 0 },
  claimMetricAmount: { color: '#7C8FB0', fontSize: 9, fontWeight: '800', marginTop: 1 },
  claimTicker: { minHeight: 25, marginHorizontal: 10, marginTop: 3, marginBottom: 4, paddingHorizontal: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  claimTickerHot: { borderRadius: 10, backgroundColor: '#FFF8EA', paddingHorizontal: 8 },
  claimTickerText: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '900' },
  claimCard: { borderRadius: 20, backgroundColor: palette.navy, borderWidth: 1, borderColor: '#0D2B63', padding: 14, overflow: 'hidden', shadowColor: '#071D49', shadowOpacity: 0.12, shadowRadius: 14, elevation: 3 },
  claimCardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  claimCardHint: { color: '#C8D8EF', fontSize: 11, fontWeight: '700', marginTop: 2 },
  claimTaskBadge: { borderRadius: 999, backgroundColor: '#FFF6E8', paddingHorizontal: 9, paddingVertical: 5 },
  claimTaskBadgeText: { color: '#9A6700', fontSize: 10.5, fontWeight: '900' },
  noClaimState: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 11, marginTop: 2 },
  noClaimIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  noClaimCopy: { flex: 1, minWidth: 0 },
  noClaimTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '900' },
  noClaimText: { color: '#C8D8EF', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  claimPrimaryButton: { alignSelf: 'stretch', marginTop: 12, minHeight: 42, borderRadius: 14, backgroundColor: '#174EA6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  claimPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  claimTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  claimIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  claimTopCopy: { flex: 1, minWidth: 0 },
  claimNo: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  claimStage: { color: '#D8E4F5', fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  progressTrack: { flexDirection: 'row', gap: 5, paddingTop: 5, paddingBottom: 10 },
  progressStep: { flex: 1, alignItems: 'center', minWidth: 0 },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { backgroundColor: '#10A66F', borderColor: '#10A66F' },
  progressNumber: { color: '#AFC0D8', fontSize: 11, fontWeight: '900' },
  progressLabel: { color: '#AFC0D8', fontSize: 8.5, fontWeight: '800', marginTop: 5, textAlign: 'center' },
  progressLabelActive: { color: '#FFFFFF' },
  claimFooter: { minHeight: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  claimFooterText: { flex: 1, color: '#E8F1FF', fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  supportCard: { paddingHorizontal: 2, paddingTop: 3, paddingBottom: 1 },
  supportTop: { marginBottom: 13, paddingHorizontal: 2 },
  supportHeaderLine: { flexShrink: 1 },
  supportIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  supportCopy: { flex: 1 },
  supportTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  supportDivider: { color: '#B6C4D8', fontSize: 14, fontWeight: '900' },
  supportTagline: { color: '#607089', fontSize: 11.5, fontWeight: '800' },
  supportActions: { flexDirection: 'row', gap: 12 },
  supportButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  supportButtonIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#122544', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  supportButtonText: { color: palette.navy, fontSize: 11, fontWeight: '900' },
  appVersion: { color: '#A6B3C6', fontSize: 9.5, fontWeight: '700', textAlign: 'center', marginTop: 0 },
  cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.94 },
  kycBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(10,18,31,0.66)' },
  kycModal: { width: '100%', maxWidth: 410, borderRadius: 20, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 25, paddingBottom: 16, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.24, shadowRadius: 24, elevation: 12 },
  kycArtwork: { width: 116, height: 103, borderRadius: 52, backgroundColor: '#EFF8FF', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  kycCheck: { position: 'absolute', right: 8, bottom: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: '#42C77A', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  kycTitle: { marginTop: 16, color: palette.navy, fontSize: 20, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  kycBody: { marginTop: 8, maxWidth: 310, color: '#4B5B70', fontSize: 14, lineHeight: 20, fontWeight: '400', textAlign: 'center' },
  kycButton: { width: '100%', minHeight: 54, marginTop: 20, borderRadius: 12, backgroundColor: '#0A3B8F', alignItems: 'center', justifyContent: 'center' },
  kycButtonDisabled: { backgroundColor: '#8A98AC' },
  kycButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  kycExplore: { width: '100%', minHeight: 45, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#D8E2EE', alignItems: 'center', justifyContent: 'center' },
  kycExploreText: { color: palette.navy, fontSize: 13, fontWeight: '700' },
  kycSignOut: { minHeight: 32, paddingHorizontal: 14, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  kycSignOutText: { color: '#667085', fontSize: 12, fontWeight: '600' },
});
