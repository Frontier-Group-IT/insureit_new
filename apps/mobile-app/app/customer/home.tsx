import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/customer-dashboard';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getOnboardingApplicationForUser, getProfile, isValidProfile, resetLocalAuthState, signOut } from '@/lib/auth';
import { customerAccountTitle, getAccessibleCustomerContexts, getSelectedCustomerContext, membershipRoleLabel, partnerTypeLabel, selectCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, ClaimTask, Customer, CustomerOnboardingApplication, Profile, Vehicle } from '@/lib/types';

const fleetSketch = require('../../assets/brand/customer-fleet-sketch.png');
const exchangeVehicleIcon = require('../../assets/brand/exchange-vehicle-icon.png');
const activeStatuses = new Set<Claim['current_status']>(['Draft', 'Accident Reported', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Pending', 'Documents Submitted', 'Claim Intimated', 'Surveyor Appointed', 'Vehicle Inspected', 'Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Estimate Submitted', 'Approval Pending', 'Repair Started', 'Repair Completed', 'DO Submitted', 'Final Bill Submitted', 'Settlement Under Process']);

export default function CustomerMockupHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedContext, setSelectedContext] = useState<CustomerAccountContext | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountVersion, setAccountVersion] = useState(0);
  const [onboarding, setOnboarding] = useState<CustomerOnboardingApplication | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kycPromptDismissed, setKycPromptDismissed] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const nextProfile = await waitForCustomerProfile(session.user.id);
        if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') return router.replace('/access-denied');
        const [availableContexts, activeContext, nextOnboarding] = await Promise.all([
          getAccessibleCustomerContexts(),
          getSelectedCustomerContext(),
          getOnboardingApplicationForUser(session.user.id),
        ]);
        let nextCustomer: Customer | null = null;
        if (activeContext) {
          const result = await supabase.from('customers').select('*').eq('id', activeContext.customer_id).maybeSingle<Customer>();
          if (result.error) throw result.error;
          nextCustomer = result.data;
        } else {
          nextCustomer = await getCustomerForUser(session.user.id);
        }
        if (!mounted) return;
        setProfile(nextProfile); setContexts(availableContexts); setSelectedContext(activeContext); setCustomer(nextCustomer); setOnboarding(nextOnboarding);
        const promptDismissed = await getKycPromptDismissed(session.user.id);
        if (mounted) setKycPromptDismissed(Boolean(promptDismissed) || Boolean(nextCustomer) || nextOnboarding?.status === 'submitted' || nextOnboarding?.status === 'under_review');
        if (nextCustomer) {
          const [vehicleResult, claimResult, taskResult] = await Promise.all([
            supabase.from('vehicles').select('*').eq('customer_id', nextCustomer.id),
            supabase.from('claims').select('*').eq('customer_id', nextCustomer.id),
            supabase.from('claim_tasks').select('*').eq('status', 'open').order('created_at', { ascending: false }),
          ]);
          if (!mounted) return;
          if (vehicleResult.error) console.warn('Customer vehicles load failed', vehicleResult.error.message);
          if (claimResult.error) console.warn('Customer claims load failed', claimResult.error.message);
          if (taskResult.error) console.warn('Customer claim tasks load failed', taskResult.error.message);
          const nextClaims = claimResult.data ?? [];
          setVehicles(vehicleResult.data ?? []); setClaims(nextClaims);
          setTasks((taskResult.data ?? []).filter((task) => nextClaims.some((claim) => claim.id === task.claim_id)));
        } else { setVehicles([]); setClaims([]); setTasks([]); }
      } catch (nextError) {
        console.warn('Customer dashboard load failed', nextError);
        if (mounted) setError(dashboardLoadErrorMessage(nextError));
      } finally { if (mounted) setLoading(false); }
    }
    void load(); return () => { mounted = false; };
  }, [router, accountVersion]);

  const signedInName = profile?.full_name?.trim() || 'Customer';
  const firstName = signedInName.split(' ')[0] || 'Customer';
  const accountTitle = selectedContext ? customerAccountTitle(selectedContext) : customer?.company_name?.trim() || customer?.contact_name || 'Customer account';
  const active = useMemo(() => claims.filter((claim) => activeStatuses.has(claim.current_status)), [claims]);
  const settled = useMemo(() => claims.filter((claim) => claim.current_status === 'Settled' || claim.current_status === 'Closed'), [claims]);
  const documentTasks = useMemo(() => tasks.filter((task) => /^Final document: /i.test(task.title) || /reupload|upload.*document/i.test(task.title)), [tasks]);
  const pendingTask = documentTasks[0];
  const pendingActionCount = pendingTask ? documentTasks.filter((task) => task.claim_id === pendingTask.claim_id).length : 0;
  const estimate = active.reduce((total, claim) => total + (claim.estimated_loss ?? 0), 0);
  const invoices = settled.reduce((total, claim) => total + (claim.settlement_amount ?? claim.approved_amount ?? 0), 0);
  const kycRoute = onboarding?.partner_type === 'individual_proprietor' ? '/customer/kyc/individual' : '/customer/kyc/partner-type';
  const kycAwaitingReview = onboarding?.status === 'submitted' || onboarding?.status === 'under_review';
  const kycChangesRequested = onboarding?.status === 'changes_requested';
  const kycReviewNotes = onboardingReviewNotes(onboarding);
  const pendingTitle = !customer ? kycAwaitingReview ? 'KYC verification pending' : kycChangesRequested ? 'KYC update required' : 'KYC pending' : 'Pending Action';
  const pendingText = !customer ? kycAwaitingReview ? 'Your details are with our verification team.' : kycChangesRequested ? kycReviewNotes || 'Please update and resubmit your KYC details.' : 'Complete your KYC to activate your customer profile.' : pendingActionCount ? `You have ${pendingActionCount} pending action${pendingActionCount === 1 ? '' : 's'} in your claim.` : 'No pending action in your claim.';

  function openPendingAction() { if (!customer) { if (kycAwaitingReview) router.push('/customer/profile'); else router.push(kycRoute as Href); return; } if (pendingTask) router.push({ pathname: '/customer/upload-documents', params: { claimId: pendingTask.claim_id } }); else router.push('/customer/claims'); }
  async function dismissKycPrompt() { setKycPromptDismissed(true); if (profile?.id) await AsyncStorage.setItem(`insureit:kyc-prompt-dismissed:${profile.id}`, 'true'); }
  async function chooseAccount(context: CustomerAccountContext) { await selectCustomerContext(context.customer_id); setAccountPickerOpen(false); setAccountVersion((value) => value + 1); }

  if (loading) return <View style={styles.loading}><LoadingState label="Opening dashboard" /></View>;
  if (error) return <View style={styles.loading}><Text style={styles.error}>{error}</Text><Pressable onPress={() => setAccountVersion((value) => value + 1)}><Text style={styles.retry}>Try again</Text></Pressable><Pressable onPress={() => void resetLocalAuthState(router)}><Text style={styles.retry}>Reset login</Text></Pressable><Pressable onPress={() => void signOut(router)}><Text style={styles.retry}>Sign out</Text></Pressable></View>;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={() => router.replace('/customer/home')} style={styles.brand}><BrandLogo width={158} /></Pressable><Pressable onPress={() => router.push('/customer/notifications')} style={styles.iconCircle}><NotificationBell /></Pressable><Pressable onPress={() => router.push('/customer/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initialFor(signedInName)}</Text></Pressable></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingBlock}><Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text><Text style={styles.subGreeting}>Manage your vehicles, renewals and claims</Text><Text style={styles.subGreeting}>all in one place.</Text></View>
      {selectedContext ? <Pressable disabled={contexts.length < 2} onPress={() => setAccountPickerOpen(true)} style={styles.accountCard}><View style={styles.accountIcon}><MaterialCommunityIcons name={selectedContext.partner_type === 'group' ? 'account-group' : 'office-building'} size={22} color="#0A43A3" /></View><View style={styles.accountCopy}><Text style={styles.accountLabel}>Active account</Text><Text style={styles.accountTitle} numberOfLines={1}>{accountTitle}</Text><Text style={styles.accountMeta}>{partnerTypeLabel(selectedContext.partner_type)} · {membershipRoleLabel(selectedContext.membership_role)}</Text></View>{contexts.length > 1 ? <MaterialCommunityIcons name="swap-horizontal" size={24} color="#0A43A3" /> : null}</Pressable> : null}
      <Pressable onPress={openPendingAction} style={[styles.pendingCard, !customer && styles.pendingCardKyc]}><View style={[styles.pendingIcon, !customer && styles.pendingIconKyc]}><MaterialCommunityIcons name={!customer ? kycAwaitingReview ? 'clipboard-clock-outline' : kycChangesRequested ? 'file-edit-outline' : 'shield-account-outline' : 'alert-circle'} size={28} color="#FFFFFF" /></View><View style={styles.pendingCopy}><Text style={[styles.pendingTitle, !customer && styles.pendingTitleKyc]}>{pendingTitle}</Text><Text style={styles.pendingText} numberOfLines={2}>{pendingText}</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color={!customer ? '#0A43A3' : '#7A3A00'} /></Pressable>
      <Pressable onPress={() => router.push('/customer/vehicles')} style={styles.vehicleCard}><View style={styles.vehicleLeft}><View style={styles.vehicleIcon}><MaterialCommunityIcons name="car" size={25} color="#0A43A3" /></View><View style={styles.vehicleTextBlock}><Text style={styles.vehicleTitle}>{selectedContext?.partner_type === 'group' ? 'Group Fleet' : 'My Vehicles'}</Text><Text style={styles.vehicleNumber}>{vehicles.length}</Text><Text style={styles.vehicleLabel}>Vehicles</Text></View></View><Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" /><MaterialCommunityIcons name="chevron-right" size={28} color="#7A3A00" /></Pressable>
      <View style={styles.actionCard}><ActionTile icon="calendar-month-outline" title="Renewal Dues" body="View policy renewals" onPress={() => router.push('/customer/policies')} tone="orange" /><ActionTile icon="file-document-outline" title="Get Quote" body="New insurance quote" onPress={() => router.push('/customer/insurance-quote')} tone="blue" /><ActionTile icon="ticket-confirmation-outline" title="E Challan" body="Check traffic fines" onPress={() => router.push('/customer/e-challan' as Href)} tone="teal" /><ActionTile imageSource={exchangeVehicleIcon} title="Exchange Vehicle" body="Exchange old vehicle" onPress={() => router.push('/customer/support')} tone="green" /></View>
      <Pressable onPress={() => router.push('/customer/claims')} style={styles.claimCard}><View style={styles.claimHeader}><View style={styles.claimIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#F5B700" /></View><Text style={styles.claimTitle}>Active Claim</Text></View><View style={styles.claimMetrics}><ClaimMetric label="Total Claims" value={claims.length} /><ClaimMetric label="Active Claims" value={active.length} detailLabel="Estimated Amount" detail={money(estimate)} lined /><ClaimMetric label="Settled Claims" value={settled.length} detailLabel="Invoice Amount" detail={money(invoices)} green lined /></View></Pressable>
      <Pressable onPress={() => router.push('/customer/support')} style={styles.supportCard}><MaterialCommunityIcons name="headset" size={33} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color={palette.navy} /></Pressable>
    </ScrollView>
    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/claims')} onVehicles={() => router.push('/customer/vehicles')} onSupport={() => router.push('/customer/support')} onProfile={() => router.push('/customer/profile')} /></View>
    <AccountPicker visible={accountPickerOpen} contexts={contexts} selectedId={selectedContext?.customer_id ?? null} onClose={() => setAccountPickerOpen(false)} onSelect={(context) => void chooseAccount(context)} />
    <KycRequiredModal visible={!customer && !kycPromptDismissed} application={onboarding} onStart={() => router.push(kycRoute as Href)} onDismiss={() => void dismissKycPrompt()} onSignOut={() => void signOut(router)} />
  </SafeAreaView>;
}

function AccountPicker({ visible, contexts, selectedId, onClose, onSelect }: { visible: boolean; contexts: CustomerAccountContext[]; selectedId: string | null; onClose: () => void; onSelect: (context: CustomerAccountContext) => void }) { return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.pickerBackdrop}><View style={styles.pickerSheet}><View style={styles.pickerHeader}><View><Text style={styles.pickerTitle}>Switch account</Text><Text style={styles.pickerSubtitle}>Choose the customer account to manage.</Text></View><Pressable onPress={onClose} style={styles.pickerClose}><MaterialCommunityIcons name="close" size={22} color={palette.navy} /></Pressable></View><ScrollView>{contexts.map((context) => { const selected = context.customer_id === selectedId; return <Pressable key={`${context.access_source}-${context.customer_id}`} onPress={() => onSelect(context)} style={[styles.pickerRow, selected && styles.pickerRowSelected]}><View style={styles.pickerRowIcon}><MaterialCommunityIcons name={context.partner_type === 'group' ? 'account-group' : 'office-building-outline'} size={22} color="#0A43A3" /></View><View style={styles.pickerRowCopy}><Text style={styles.pickerRowTitle}>{customerAccountTitle(context)}</Text><Text style={styles.pickerRowMeta}>{partnerTypeLabel(context.partner_type)} · {context.customer_code}</Text>{context.access_source === 'group_child' && context.group_name ? <Text style={styles.pickerGroup}>Via {context.group_name}</Text> : null}</View>{selected ? <MaterialCommunityIcons name="check-circle" size={22} color="#15945A" /> : <MaterialCommunityIcons name="chevron-right" size={22} color="#8390A3" />}</Pressable>; })}</ScrollView></View></View></Modal>; }

function KycRequiredModal({ visible, application, onStart, onDismiss, onSignOut }: { visible: boolean; application: CustomerOnboardingApplication | null; onStart: () => void; onDismiss: () => void; onSignOut: () => void }) { const awaitingReview = application?.status === 'submitted' || application?.status === 'under_review'; const started = Boolean(application?.partner_type); return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}><View style={styles.kycBackdrop}><View accessibilityRole="alert" style={styles.kycModal}><View style={styles.kycArtwork}><MaterialCommunityIcons name="clipboard-account-outline" size={67} color="#1597E5" /><View style={styles.kycCheck}><MaterialCommunityIcons name="check" size={22} color="#FFFFFF" /></View></View><Text style={styles.kycTitle}>{awaitingReview ? 'KYC submitted' : 'Kindly complete your KYC'}</Text><Text style={styles.kycBody}>{awaitingReview ? 'Your details are being reviewed. We will notify you when your account is ready.' : 'Please complete your KYC to access all features and services.'}</Text><Pressable disabled={awaitingReview} onPress={onStart} style={[styles.kycButton, awaitingReview && styles.kycButtonDisabled]}><Text style={styles.kycButtonText}>{awaitingReview ? 'Under review' : started ? 'Continue KYC' : 'Start'}</Text></Pressable><Pressable onPress={onDismiss} style={styles.kycExplore}><Text style={styles.kycExploreText}>Explore for now</Text></Pressable><Pressable onPress={onSignOut} style={styles.kycSignOut}><Text style={styles.kycSignOutText}>Sign out</Text></Pressable></View></View></Modal>; }
function ActionTile({ icon, imageSource, title, body, onPress, tone }: { icon?: keyof typeof MaterialCommunityIcons.glyphMap; imageSource?: ImageSourcePropType; title: string; body: string; onPress: () => void; tone: 'orange' | 'blue' | 'green' | 'teal' }) { const color = tone === 'orange' ? '#D99012' : tone === 'green' ? '#21A453' : tone === 'teal' ? '#0F9F9A' : '#0A43A3'; const backgroundColor = tone === 'orange' ? '#FFF7EA' : tone === 'green' ? '#F7FBFF' : tone === 'teal' ? '#E9FAF8' : '#EEF5FF'; return <Pressable onPress={onPress} style={styles.actionTile}><View style={[styles.actionIcon, { backgroundColor }]}>{imageSource ? <Image source={imageSource} style={styles.actionImageIcon} resizeMode="contain" /> : <MaterialCommunityIcons name={icon ?? 'circle-outline'} size={22} color={color} />}</View><View style={styles.actionTitleRow}><Text style={styles.actionTitle}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={16} color="#7A3A00" /></View><Text style={styles.actionBody}>{body}</Text></Pressable>; }
function ClaimMetric({ label, value, detailLabel, detail, lined, green }: { label: string; value: number; detailLabel?: string; detail?: string; lined?: boolean; green?: boolean }) { return <View style={[styles.claimMetric, lined && styles.claimMetricLined]}><Text style={styles.claimMetricLabel}>{label}</Text><Text style={styles.claimMetricValue}>{value}</Text>{detailLabel ? <Text style={styles.claimMetricDetailLabel}>{detailLabel}</Text> : null}{detail ? <Text style={[styles.claimMetricDetail, green && styles.claimMetricDetailGreen]}>{detail}</Text> : null}</View>; }
function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }
function money(value: number) { return Math.round(value).toLocaleString('en-IN'); }
function onboardingReviewNotes(application: CustomerOnboardingApplication | null) { const draft = application?.draft_data; if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null; const notes = draft.review_notes; return typeof notes === 'string' && notes.trim() ? notes.trim() : null; }
async function waitForCustomerProfile(userId: string) { const startedAt = Date.now(); while (Date.now() - startedAt < 9000) { const profile = await getProfile(userId); if (profile) return profile; await new Promise((resolve) => setTimeout(resolve, 650)); } return getProfile(userId); }
async function getKycPromptDismissed(userId: string) { try { return await AsyncStorage.getItem(`insureit:kyc-prompt-dismissed:${userId}`); } catch (error) { console.warn('KYC prompt preference load failed', error); return null; } }
function dashboardLoadErrorMessage(error: unknown) { const message = error instanceof Error ? error.message : ''; const lowerMessage = message.toLowerCase(); if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('timeout')) return 'Could not reach the InsureIT server. Check internet access and try again.'; if (lowerMessage.includes('multiple') && lowerMessage.includes('rows')) return 'Your account has duplicate customer records. Please contact support to merge them.'; return 'We could not load your dashboard. Please try again.'; }

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#F7F9FD'},loading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#F7F9FD',gap:14},error:{color:palette.navy,fontWeight:'900'},retry:{color:palette.navy,fontWeight:'900'},header:{height:66,paddingHorizontal:4,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'rgba(255,255,255,0.98)',borderBottomWidth:1,borderBottomColor:'#E1E7F0'},brand:{flex:1,alignItems:'flex-start',justifyContent:'center'},iconCircle:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center'},avatar:{width:42,height:42,borderRadius:21,backgroundColor:palette.ink,borderWidth:2,borderColor:'rgba(255,255,255,0.92)',alignItems:'center',justifyContent:'center'},avatarText:{color:'#FFF',fontWeight:'900',fontSize:17},scroll:{flex:1},body:{flexGrow:1,paddingHorizontal:16,paddingTop:13,paddingBottom:8,gap:10},greetingBlock:{marginBottom:0},greeting:{color:palette.navy,fontSize:13,lineHeight:16,fontWeight:'900'},subGreeting:{color:palette.navy,fontSize:13,lineHeight:17,fontWeight:'500'},
  accountCard:{minHeight:68,borderRadius:15,borderWidth:1,borderColor:'#CFE0F5',backgroundColor:'#F4F8FF',paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10},accountIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#E6F0FF',alignItems:'center',justifyContent:'center'},accountCopy:{flex:1,minWidth:0},accountLabel:{fontSize:9.5,fontWeight:'700',textTransform:'uppercase',letterSpacing:.6,color:'#68758A'},accountTitle:{fontSize:14,fontWeight:'900',color:palette.navy,marginTop:1},accountMeta:{fontSize:10,color:'#526176',marginTop:2},
  pendingCard:{minHeight:58,borderRadius:15,backgroundColor:'#FFF8EF',borderWidth:1,borderColor:'#F3DDBD',paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:10},pendingCardKyc:{backgroundColor:'#F1F7FF',borderColor:'#CFE1F7'},pendingIcon:{width:43,height:43,borderRadius:11,backgroundColor:'#DD7300',alignItems:'center',justifyContent:'center'},pendingIconKyc:{backgroundColor:'#0A43A3'},pendingCopy:{flex:1,minWidth:0},pendingTitle:{color:'#834100',fontSize:15,fontWeight:'900'},pendingTitleKyc:{color:'#0A3B8F'},pendingText:{color:palette.navy,fontSize:11.5,lineHeight:15,fontWeight:'600',marginTop:2},vehicleCard:{minHeight:126,borderRadius:17,backgroundColor:'#FFF',paddingLeft:13,paddingRight:6,flexDirection:'row',alignItems:'center',overflow:'hidden',shadowColor:'#122544',shadowOpacity:.07,shadowRadius:10,elevation:2},vehicleLeft:{width:138,zIndex:2,flexDirection:'row',alignItems:'flex-start',gap:8},vehicleTextBlock:{flex:1},vehicleIcon:{width:40,height:40,borderRadius:11,backgroundColor:'#EEF5FF',alignItems:'center',justifyContent:'center'},vehicleTitle:{color:palette.navy,fontSize:15,fontWeight:'900'},vehicleNumber:{color:palette.navy,fontSize:28,lineHeight:32,fontWeight:'900',marginTop:2},vehicleLabel:{color:palette.navy,fontSize:12,fontWeight:'700'},fleetImage:{flex:1,height:116,marginLeft:-14,marginRight:-12},actionCard:{minHeight:134,borderRadius:17,backgroundColor:'#FFF',flexDirection:'row',flexWrap:'wrap',padding:8,gap:6,borderWidth:1,borderColor:'#D9E8F8'},actionTile:{width:'49%',minHeight:57,borderRadius:13,backgroundColor:'#F8FBFF',borderWidth:1,borderColor:'#DCEBFA',alignItems:'center',paddingHorizontal:6,paddingVertical:6},actionIcon:{width:29,height:29,borderRadius:10,alignItems:'center',justifyContent:'center'},actionImageIcon:{width:26,height:26},actionTitleRow:{minHeight:18,marginTop:2,flexDirection:'row',alignItems:'center',justifyContent:'center'},actionTitle:{flex:1,color:palette.navy,fontSize:10.8,fontWeight:'900',textAlign:'center'},actionBody:{color:palette.navy,fontSize:8.8,lineHeight:10.5,fontWeight:'600',textAlign:'center'},claimCard:{minHeight:157,borderRadius:17,backgroundColor:palette.navy,padding:13},claimHeader:{flexDirection:'row',alignItems:'center',gap:10},claimIcon:{width:38,height:38,borderRadius:12,borderWidth:1.5,borderColor:'#F5B700',alignItems:'center',justifyContent:'center'},claimTitle:{color:'#FFF',fontSize:15.5,fontWeight:'900'},claimMetrics:{flex:1,flexDirection:'row',marginTop:9},claimMetric:{flex:1,alignItems:'center',justifyContent:'center'},claimMetricLined:{borderLeftWidth:1,borderLeftColor:'rgba(255,255,255,.32)'},claimMetricLabel:{color:'#FFF',fontSize:11,textAlign:'center'},claimMetricValue:{color:'#FFF',fontSize:28,lineHeight:32,fontWeight:'900',marginTop:5},claimMetricDetailLabel:{color:'#FFF',fontSize:9.5,textAlign:'center'},claimMetricDetail:{color:'#F6C33B',fontSize:15,fontWeight:'900',textAlign:'center'},claimMetricDetailGreen:{color:'#68BF5B'},supportCard:{minHeight:60,borderRadius:17,backgroundColor:'#FFF',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:11},supportCopy:{flex:1},supportTitle:{color:palette.navy,fontSize:15,fontWeight:'900'},supportText:{color:palette.navy,fontSize:11.5,fontWeight:'500'},nav:{minHeight:82,paddingHorizontal:10,paddingTop:8,paddingBottom:8,backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#E3E8F0'},
  pickerBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(10,18,31,.55)'},pickerSheet:{maxHeight:'78%',borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:'#FFF',padding:18,paddingBottom:30},pickerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},pickerTitle:{fontSize:19,fontWeight:'900',color:palette.navy},pickerSubtitle:{fontSize:11,color:'#667085',marginTop:3},pickerClose:{width:38,height:38,borderRadius:19,backgroundColor:'#F2F5F9',alignItems:'center',justifyContent:'center'},pickerRow:{minHeight:76,borderRadius:14,borderWidth:1,borderColor:'#E1E7EF',padding:11,marginBottom:9,flexDirection:'row',alignItems:'center',gap:10},pickerRowSelected:{borderColor:'#8BBDF8',backgroundColor:'#F2F7FF'},pickerRowIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#EAF2FF',alignItems:'center',justifyContent:'center'},pickerRowCopy:{flex:1,minWidth:0},pickerRowTitle:{fontSize:13.5,fontWeight:'900',color:palette.navy},pickerRowMeta:{fontSize:10,color:'#64748B',marginTop:3},pickerGroup:{fontSize:9.5,color:'#0A63B8',marginTop:2,fontWeight:'700'},
  kycBackdrop:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:24,backgroundColor:'rgba(10,18,31,.66)'},kycModal:{width:'100%',maxWidth:410,borderRadius:20,backgroundColor:'#FFF',paddingHorizontal:24,paddingTop:25,paddingBottom:16,alignItems:'center'},kycArtwork:{width:116,height:103,borderRadius:52,backgroundColor:'#EFF8FF',alignItems:'center',justifyContent:'center'},kycCheck:{position:'absolute',right:8,bottom:8,width:38,height:38,borderRadius:19,backgroundColor:'#42C77A',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#FFF'},kycTitle:{marginTop:16,color:palette.navy,fontSize:20,fontWeight:'800'},kycBody:{marginTop:8,color:'#4B5B70',fontSize:14,lineHeight:20,textAlign:'center'},kycButton:{width:'100%',minHeight:54,marginTop:20,borderRadius:12,backgroundColor:'#0A3B8F',alignItems:'center',justifyContent:'center'},kycButtonDisabled:{backgroundColor:'#8A98AC'},kycButtonText:{color:'#FFF',fontSize:16,fontWeight:'700'},kycExplore:{width:'100%',minHeight:45,marginTop:8,borderRadius:12,borderWidth:1,borderColor:'#D8E2EE',alignItems:'center',justifyContent:'center'},kycExploreText:{color:palette.navy,fontSize:13,fontWeight:'700'},kycSignOut:{minHeight:32,paddingHorizontal:14,marginTop:2,alignItems:'center',justifyContent:'center'},kycSignOutText:{color:'#667085',fontSize:12,fontWeight:'600'}
});