import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const fleetSketch = require('../../assets/brand/customer-fleet-sketch.png');
const claimsDeskPhone = '+916264911014';

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
  const expiredRenewalCount = renewals.items.filter((item) => item.status === 'expired').length;
  const activePolicyVehicleIds = useMemo(() => new Set(policies.filter((policy) => !isExpired(policy.end_date)).map((policy) => policy.vehicle_id)), [policies]);
  const protectedVehicles = vehicles.filter((vehicle) => activePolicyVehicleIds.has(vehicle.id)).length;
  const protectionScore = vehicles.length ? Math.round((protectedVehicles / vehicles.length) * 100) : 0;
  const latestClaim = activeClaims[0] ?? claims[0] ?? null;
  const claimAttentionCount = documentTasks.length;
  const attentionCount = renewalAttentionCount + claimAttentionCount;
  const kycRoute = onboarding?.partner_type === 'individual_proprietor' ? '/customer/kyc/individual' : '/customer/kyc/partner-type';
  const kycAwaitingReview = onboarding?.status === 'submitted' || onboarding?.status === 'under_review';
  const kycChangesRequested = onboarding?.status === 'changes_requested';
  const kycReviewNotes = onboardingReviewNotes(onboarding);
  const hero = dashboardHero({
    customer,
    kycAwaitingReview,
    kycChangesRequested,
    renewalAttentionCount,
    claimAttentionCount,
    activeClaims,
    protectedVehicles,
    totalVehicles: vehicles.length,
  });

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
      <DashboardIntro firstName={firstName} lastUpdated={lastUpdated} attentionCount={attentionCount} groupName={selectedContext?.group_name} />
      <LiveHeroCard hero={hero} onPress={openPrimaryAction} />
      <AttentionRail
        renewals={renewalAttentionCount}
        claimTasks={claimAttentionCount}
        kycPending={!customer}
        onRenewals={() => router.push('/customer/renewals' as Href)}
        onClaims={() => pendingTask ? router.push({ pathname: '/customer/upload-documents', params: { claimId: pendingTask.claim_id } }) : router.push('/customer/claims')}
        onKyc={() => router.push(kycRoute as Href)}
      />
      <FleetSnapshot
        vehicles={vehicles}
        protectedVehicles={protectedVehicles}
        protectionScore={protectionScore}
        renewalDue={renewalAttentionCount}
        expiredDue={expiredRenewalCount}
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
      <ClaimJourneyCard
        claim={latestClaim}
        activeCount={activeClaims.length}
        settledCount={settledClaims.length}
        taskCount={pendingActionCount}
        onOpen={() => router.push(latestClaim ? { pathname: '/customer/claim-detail', params: { id: latestClaim.id } } : '/customer/claims')}
        onStart={() => router.push('/customer/start-claim')}
      />
      <SupportActionCenter onSupport={() => router.push('/customer/support')} />
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

function DashboardIntro({ firstName, lastUpdated, attentionCount, groupName }: { firstName: string; lastUpdated: Date | null; attentionCount: number; groupName?: string | null }) {
  const message = attentionCount > 0
    ? `${attentionCount} item${attentionCount === 1 ? '' : 's'} need attention`
    : 'Everything is up to date';
  return (
    <View style={styles.greetingBlock}>
      <View>
        <Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text>
        <Text style={styles.syncText}>{message}{lastUpdated ? ` · Synced ${shortTime(lastUpdated)}` : ''}</Text>
        {groupName ? <Text style={styles.parentCompany}>Associated with {groupName}</Text> : null}
      </View>
    </View>
  );
}

function LiveHeroCard({ hero, onPress }: { hero: ReturnType<typeof dashboardHero>; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, hero.urgent ? 0.34 : 0.24] });
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.liveHero, hero.urgent && styles.liveHeroUrgent, pressed && styles.cardPressed]}>
      <View style={styles.heroOrbLarge} />
      <View style={styles.heroOrbSmall} />
      <Animated.View style={[styles.heroPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
      <View style={styles.heroContent}>
        <View style={styles.heroKickerRow}>
          <View style={[styles.heroStatusDot, { backgroundColor: hero.dot }]} />
          <Text style={styles.heroKicker}>{hero.kicker}</Text>
        </View>
        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroBody}>{hero.body}</Text>
        <View style={styles.heroButton}>
          <Text style={styles.heroButtonText}>{hero.cta}</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#071D49" />
        </View>
      </View>
      <View style={styles.heroGraphic}>
        <View style={styles.heroShield}>
          <MaterialCommunityIcons name={hero.icon} size={36} color="#FFFFFF" />
        </View>
        <View style={styles.heroPlate}>
          <MaterialCommunityIcons name="truck-fast-outline" size={28} color={palette.navy} />
        </View>
      </View>
    </Pressable>
  );
}

function AttentionRail({ renewals, claimTasks, kycPending, onRenewals, onClaims, onKyc }: { renewals: number; claimTasks: number; kycPending: boolean; onRenewals: () => void; onClaims: () => void; onKyc: () => void }) {
  return (
    <View style={styles.attentionRail}>
      <AttentionChip icon="calendar-alert" label="Renewals" value={renewals} tone="#C98918" soft="#FFF6E8" onPress={onRenewals} />
      <AttentionChip icon="file-alert-outline" label="Claims" value={claimTasks} tone="#E5484D" soft="#FDEEEF" onPress={onClaims} />
      <AttentionChip icon="shield-account-outline" label="KYC" value={kycPending ? 1 : 0} tone="#174EA6" soft="#EAF3FF" onPress={onKyc} />
    </View>
  );
}

function AttentionChip({ icon, label, value, tone, soft, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: number; tone: string; soft: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.attentionChip, { backgroundColor: soft }, pressed && styles.cardPressed]}>
      <MaterialCommunityIcons name={icon} size={18} color={tone} />
      <Text style={[styles.attentionValue, { color: tone }]}>{value}</Text>
      <Text style={styles.attentionLabel}>{label}</Text>
    </Pressable>
  );
}

function FleetSnapshot({ vehicles, protectedVehicles, protectionScore, renewalDue, expiredDue, onOpen }: { vehicles: Vehicle[]; protectedVehicles: number; protectionScore: number; renewalDue: number; expiredDue: number; onOpen: () => void }) {
  const plates = vehicles.slice(0, 3).map((vehicle) => vehicle.vehicle_no);
  const unprotected = Math.max(vehicles.length - protectedVehicles, 0);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.fleetCard, pressed && styles.cardPressed]}>
      <View style={styles.fleetTop}>
        <View style={styles.fleetCopy}>
          <Text style={styles.sectionEyebrow}>Protection snapshot</Text>
          <Text style={styles.fleetTitle}>{vehicles.length ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} in your garage` : 'Add your first vehicle'}</Text>
          <Text style={styles.fleetSubtitle}>{vehicles.length ? `${protectedVehicles} protected · ${unprotected} need policy attention` : 'Start by adding your vehicle and policy details.'}</Text>
        </View>
        <View style={styles.scoreRing}>
          <Text style={styles.scoreValue}>{vehicles.length ? `${protectionScore}%` : '0%'}</Text>
          <Text style={styles.scoreLabel}>Covered</Text>
        </View>
      </View>
      <View style={styles.fleetMiddle}>
        <View style={styles.plateStack}>
          {plates.length ? plates.map((plate, index) => <View key={`${plate}-${index}`} style={[styles.platePill, index > 0 && styles.platePillOverlap]}><Text style={styles.plateText} numberOfLines={1}>{plate}</Text></View>) : <View style={styles.platePill}><Text style={styles.plateText}>No vehicle</Text></View>}
        </View>
        <Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" />
      </View>
      <View style={styles.fleetFooter}>
        <FleetSignal label="Renewal due" value={renewalDue} tone={renewalDue ? '#C98918' : '#10A66F'} />
        <FleetSignal label="Expired" value={expiredDue} tone={expiredDue ? '#E5484D' : '#10A66F'} />
        <View style={styles.openLink}><Text style={styles.openLinkText}>Open Vehicles</Text><MaterialCommunityIcons name="arrow-right" size={15} color="#174EA6" /></View>
      </View>
    </Pressable>
  );
}

function FleetSignal({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <View style={styles.fleetSignal}><Text style={[styles.fleetSignalValue, { color: tone }]}>{value}</Text><Text style={styles.fleetSignalLabel}>{label}</Text></View>;
}

function QuickActionDock({ renewalDue, claimTasks, onRenewals, onQuote, onChallan, onClaim }: { renewalDue: number; claimTasks: number; onRenewals: () => void; onQuote: () => void; onChallan: () => void; onClaim: () => void }) {
  return (
    <View style={styles.quickDock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <Text style={styles.sectionHint}>One tap services</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction icon="calendar-month-outline" label="Renewal" badge={renewalDue} tone="#FFF6E8" color="#C98918" onPress={onRenewals} />
        <QuickAction icon="shield-plus-outline" label="Start claim" badge={claimTasks} tone="#E8F8F0" color="#10A66F" onPress={onClaim} />
        <QuickAction icon="file-document-outline" label="Get quote" tone="#EAF3FF" color="#174EA6" onPress={onQuote} />
        <QuickAction icon="ticket-confirmation-outline" label="E-Challan" tone="#E6FAFD" color="#0EAFC8" onPress={onChallan} />
      </View>
    </View>
  );
}

function QuickAction({ icon, label, badge, tone, color, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; badge?: number; tone: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.cardPressed]}>
      {badge ? <View style={styles.actionBadge}><Text style={styles.actionBadgeText}>{badge}</Text></View> : null}
      <View style={[styles.quickIcon, { backgroundColor: tone }]}><MaterialCommunityIcons name={icon} size={22} color={color} /></View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function ClaimJourneyCard({ claim, activeCount, settledCount, taskCount, onOpen, onStart }: { claim: Claim | null; activeCount: number; settledCount: number; taskCount: number; onOpen: () => void; onStart: () => void }) {
  if (!claim) {
    return (
      <View style={styles.claimCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.claimCardTitle}>Claim journey</Text>
          <Text style={styles.claimCardHint}>Ready when needed</Text>
        </View>
        <View style={styles.noClaimState}>
          <View style={styles.noClaimIcon}><MaterialCommunityIcons name="shield-search" size={28} color="#174EA6" /></View>
          <View style={styles.noClaimCopy}>
            <Text style={styles.noClaimTitle}>No active claim</Text>
            <Text style={styles.noClaimText}>Your claim progress will appear here after reporting an accident.</Text>
          </View>
        </View>
        <Pressable onPress={onStart} style={({ pressed }) => [styles.claimPrimaryButton, pressed && styles.cardPressed]}><Text style={styles.claimPrimaryText}>Start Claim</Text><MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" /></Pressable>
      </View>
    );
  }
  const progress = claimProgress(claim.current_status);
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.claimCard, pressed && styles.cardPressed]}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.claimCardTitle}>Live claim journey</Text>
          <Text style={styles.claimCardHint}>{activeCount} active · {settledCount} settled</Text>
        </View>
        {taskCount ? <View style={styles.claimTaskBadge}><Text style={styles.claimTaskBadgeText}>{taskCount} action</Text></View> : null}
      </View>
      <View style={styles.claimTopRow}>
        <View style={styles.claimIcon}><MaterialCommunityIcons name="truck-fast-outline" size={24} color="#FFFFFF" /></View>
        <View style={styles.claimTopCopy}>
          <Text style={styles.claimNo} numberOfLines={1}>{claim.claim_no}</Text>
          <Text style={styles.claimStage} numberOfLines={2}>{claim.current_status}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        {progressSteps.map((step, index) => {
          const active = index <= progress;
          return (
            <View key={step.label} style={styles.progressStep}>
              <View style={[styles.progressDot, active && styles.progressDotActive]}>{active ? <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /> : <Text style={styles.progressNumber}>{index + 1}</Text>}</View>
              <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{step.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.claimFooter}>
        <Text style={styles.claimFooterText}>{taskCount ? 'Documents requested. Upload to keep the claim moving.' : 'We will keep this stage updated as the claim progresses.'}</Text>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

function SupportActionCenter({ onSupport }: { onSupport: () => void }) {
  return (
    <View style={styles.supportCard}>
      <View style={styles.supportTop}>
        <View style={styles.supportIcon}><MaterialCommunityIcons name="headset" size={26} color={palette.navy} /></View>
        <View style={styles.supportCopy}>
          <Text style={styles.supportTitle}>Claims desk</Text>
          <Text style={styles.supportText}>Quick support and escalation</Text>
        </View>
      </View>
      <View style={styles.supportActions}>
        <SupportButton icon="phone-outline" label="Call" onPress={() => void callClaimsDesk()} />
        <SupportButton icon="whatsapp" label="WhatsApp" onPress={() => void openClaimsDeskWhatsApp()} />
        <SupportButton icon="message-text-outline" label="Ticket" onPress={onSupport} />
      </View>
    </View>
  );
}

function SupportButton({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.supportButton, pressed && styles.cardPressed]}><MaterialCommunityIcons name={icon} size={20} color={palette.navy} /><Text style={styles.supportButtonText}>{label}</Text></Pressable>;
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

const progressSteps = [
  { label: 'Report' },
  { label: 'Docs' },
  { label: 'Survey' },
  { label: 'Approval' },
  { label: 'Repair' },
  { label: 'Settle' },
] as const;

function dashboardHero(input: { customer: Customer | null; kycAwaitingReview: boolean; kycChangesRequested: boolean; renewalAttentionCount: number; claimAttentionCount: number; activeClaims: Claim[]; protectedVehicles: number; totalVehicles: number }) {
  if (!input.customer) {
    if (input.kycAwaitingReview) return { kicker: 'Verification', title: 'KYC is under review', body: 'Your profile is with our verification team. We will unlock full services after approval.', cta: 'View profile', icon: 'clipboard-clock-outline' as const, dot: '#C98918', urgent: false };
    return { kicker: 'Account setup', title: input.kycChangesRequested ? 'KYC update needed' : 'Complete KYC to activate protection', body: 'Finish your customer profile to access policy, vehicle and claim services.', cta: 'Continue KYC', icon: 'shield-account-outline' as const, dot: '#E5484D', urgent: true };
  }
  if (input.claimAttentionCount > 0) return { kicker: 'Claim action', title: `${input.claimAttentionCount} document request${input.claimAttentionCount === 1 ? '' : 's'} pending`, body: 'Upload requested claim documents to keep your claim moving.', cta: 'Upload now', icon: 'file-alert-outline' as const, dot: '#E5484D', urgent: true };
  if (input.renewalAttentionCount > 0) return { kicker: 'Renewal watch', title: `${input.renewalAttentionCount} renewal item${input.renewalAttentionCount === 1 ? '' : 's'} need attention`, body: 'Review expiring policies and compliance documents before they lapse.', cta: 'Review renewals', icon: 'calendar-alert' as const, dot: '#C98918', urgent: true };
  if (input.activeClaims.length > 0) return { kicker: 'Claim tracking', title: 'Your claim is being tracked', body: `${input.activeClaims.length} active claim${input.activeClaims.length === 1 ? '' : 's'} visible with live stage progress.`, cta: 'View claim', icon: 'shield-check-outline' as const, dot: '#174EA6', urgent: false };
  if (input.totalVehicles > 0) return { kicker: 'Protected fleet', title: `${input.protectedVehicles} of ${input.totalVehicles} vehicles protected`, body: 'Policies, renewals and claim support are ready from your dashboard.', cta: 'Open vehicles', icon: 'truck-check-outline' as const, dot: '#10A66F', urgent: false };
  return { kicker: 'Start here', title: 'Add your vehicle to begin', body: 'Once your vehicle is added, policies, renewals and claims become trackable here.', cta: 'Add vehicle', icon: 'truck-plus-outline' as const, dot: '#174EA6', urgent: false };
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

function claimProgress(status: Claim['current_status']) {
  if (status === 'Initial Documents Pending' || status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Initial Documents Verified' || status === 'Documents Pending' || status === 'Documents Submitted') return 1;
  if (status === 'Claim Intimated' || status === 'Surveyor Appointed' || status === 'Vehicle Inspected' || status === 'Final Surveyor Details' || status === 'Survey Status' || status === 'Survey Done') return 2;
  if (status === 'Final Documents Awaited' || status === 'Final Documents Verification Pending' || status === 'Final Documents Submitted' || status === 'Final Documents Verified' || status === 'Estimate Submitted' || status === 'Approval Pending' || status === 'Work Approval Status' || status === 'Work Approval Received') return 3;
  if (status === 'Repair Started' || status === 'Repair Completed' || status === 'Under Repair' || status === 'Repair Done' || status === 'DO Submitted' || status === 'DO Status' || status === 'Final Bill Submitted') return 4;
  if (status === 'Settlement Under Process' || status === 'Payment Stage' || status === 'Settled' || status === 'Closed' || status === 'Claim Complete') return 5;
  return 0;
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
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 },
  body: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 120, gap: 11 },
  greetingBlock: { paddingHorizontal: 2, paddingTop: 2, paddingBottom: 1 },
  greeting: { color: palette.navy, fontSize: 22, lineHeight: 28, fontWeight: '900' },
  syncText: { color: '#5C6878', fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 1 },
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
  fleetCard: { minHeight: 210, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E7F7', padding: 13, overflow: 'hidden', shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  fleetTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  fleetCopy: { flex: 1, minWidth: 0 },
  sectionEyebrow: { color: '#607089', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  fleetTitle: { color: palette.navy, fontSize: 19, lineHeight: 24, fontWeight: '900', marginTop: 4 },
  fleetSubtitle: { color: '#5C6878', fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  scoreRing: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EAF3FF', borderWidth: 5, borderColor: '#CDE1FF', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: palette.navy, fontSize: 17, lineHeight: 20, fontWeight: '900' },
  scoreLabel: { color: '#607089', fontSize: 9, fontWeight: '900', marginTop: 1 },
  fleetMiddle: { minHeight: 86, flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  plateStack: { width: 142, zIndex: 2 },
  platePill: { alignSelf: 'flex-start', minHeight: 31, maxWidth: 135, borderRadius: 10, backgroundColor: '#F7FAFE', borderWidth: 1, borderColor: '#D8E7F7', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  platePillOverlap: { marginLeft: 12 },
  plateText: { color: palette.navy, fontSize: 11.2, fontWeight: '900' },
  fleetImage: { flex: 1, height: 96, marginLeft: -18, marginRight: -6 },
  fleetFooter: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 },
  fleetSignal: { minWidth: 70, minHeight: 42, borderRadius: 14, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E0EAF5', alignItems: 'center', justifyContent: 'center' },
  fleetSignalValue: { fontSize: 16, fontWeight: '900' },
  fleetSignalLabel: { color: '#607089', fontSize: 9, fontWeight: '800', marginTop: 1 },
  openLink: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  openLinkText: { color: palette.blue, fontSize: 12, fontWeight: '900' },
  quickDock: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E7F7', padding: 12, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 9, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  sectionTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  sectionHint: { color: '#607089', fontSize: 11, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', gap: 8 },
  quickAction: { flex: 1, minHeight: 78, borderRadius: 16, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E0EAF5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, position: 'relative' },
  quickIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: palette.navy, fontSize: 10.5, lineHeight: 13, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  actionBadge: { position: 'absolute', right: 7, top: 7, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#E5484D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, zIndex: 3 },
  actionBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
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
  supportCard: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E7F7', padding: 13, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 9, elevation: 2 },
  supportTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  supportIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  supportCopy: { flex: 1 },
  supportTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' },
  supportText: { color: '#607089', fontSize: 12, fontWeight: '700', marginTop: 2 },
  supportActions: { flexDirection: 'row', gap: 8 },
  supportButton: { flex: 1, minHeight: 58, borderRadius: 15, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E0EAF5', alignItems: 'center', justifyContent: 'center', gap: 4 },
  supportButtonText: { color: palette.navy, fontSize: 11, fontWeight: '900' },
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
