import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/customer-dashboard';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState } from '@/components/ui';
import { customerAccountTitle, getGroupChildAccountOverview, groupChildAccountTitle, membershipRoleLabel, partnerTypeLabel, type CustomerAccountContext, type GroupChildAccountOverview } from '@/lib/customer-context';
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
  associated: GroupChildAccountOverview[];
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
    const selectedGroupContext = groupContext;
    async function load() {
      try {
        const associated = await getGroupChildAccountOverview(selectedGroupContext.customer_id);
        const accountIds = associated.map((item) => item.customer_id).filter((id): id is string => Boolean(id));
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
  const recentAccounts = data.associated.slice(0, 2);
  const reviewAccounts = data.associated.filter((item) => item.account_source === 'onboarding_application' && item.onboarding_status !== 'approved').length;
  const activeAssociated = data.associated.filter((item) => item.account_source === 'linked_customer');

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
        <View style={styles.greetingCopy}>
          <Text style={styles.greeting}>{timeGreeting()}, {firstName}</Text>
          <Text style={styles.groupName} numberOfLines={1}>{groupName}</Text>
          <View style={styles.roleRow}><View style={styles.roleDot} /><Text style={styles.roleText}>{roleLabel}</Text></View>
        </View>
        <View style={[styles.statusBadge, underReview && styles.statusBadgeReview]}>
          <MaterialCommunityIcons name={underReview ? 'clock-outline' : 'check-decagram'} size={14} color={underReview ? '#9A6700' : '#087443'} />
          <Text style={[styles.statusText, underReview && styles.statusTextReview]}>{underReview ? 'Under Review' : 'Verified'}</Text>
        </View>
      </View>

      {underReview ? <View style={styles.reviewBanner}><View style={styles.reviewIcon}><MaterialCommunityIcons name="clipboard-clock-outline" size={19} color="#FFFFFF" /></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Verification in progress</Text><Text style={styles.reviewText}>You can explore the dashboard. Account-management actions unlock after approval.</Text></View></View> : null}
      {error ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={19} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>TODAY</Text><Text style={styles.sectionTitle}>Needs your attention</Text></View></View>
      <View style={styles.attentionRow}>
        <AttentionCard icon="calendar-alert" value={expiringSoon.length} label="Renewals due" tone="#D99012" soft="#FFF7EA" onPress={() => router.push('/customer/group/policies')} />
        <AttentionCard icon="file-alert-outline" value={actionRequired.length} label="Claims need action" tone="#C43D2D" soft="#FFF0EE" onPress={() => router.push('/customer/group/claims')} />
        <AttentionCard icon="account-clock-outline" value={underReview ? 1 : reviewAccounts} label="Accounts in review" tone="#0A43A3" soft="#EEF5FF" onPress={() => router.push('/customer/group/accounts')} disabled={underReview} />
      </View>

      <AnimatedCard disabled={underReview} onPress={() => router.push('/customer/group/accounts')}>
        <View style={styles.accountsHeader}>
          <View><Text style={styles.cardTitle}>Associated Accounts</Text><Text style={styles.cardSubtitle}>{underReview ? 'Available after verification' : `${activeAssociated.length} verified, ${reviewAccounts} in review`}</Text></View>
          <View style={styles.accountHeaderActions}>
            <Pressable disabled={underReview} onPress={() => router.push('/customer/group/add-account')} style={[styles.addAccountButton, underReview && styles.disabledAction]}><MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={styles.addAccountText}>Add</Text></Pressable>
            <MaterialCommunityIcons name={underReview ? 'lock-outline' : 'chevron-right'} size={24} color={underReview ? '#98A2B3' : '#7A3A00'} />
          </View>
        </View>
        <View style={styles.accountTypeRow}>
          <TypeChip label="Corporate" value={corporateCount} tone="#0A43A3" soft="#EEF5FF" />
          <TypeChip label="Individual" value={individualCount} tone="#8B5E16" soft="#FFF7EA" />
          <TypeChip label="Dealership" value={dealershipCount} tone="#0F7B6C" soft="#EAF8F5" />
        </View>
        {recentAccounts.length ? <View style={styles.accountPreviewList}>{recentAccounts.map((account) => {
          const title = groupChildAccountTitle(account);
          const canOpen = account.account_source === 'linked_customer' && Boolean(account.customer_id);
          return <Pressable key={account.row_id} disabled={!canOpen} onPress={() => account.customer_id && router.push({ pathname: '/customer/group/account-detail', params: { id: account.customer_id } })} style={styles.accountPreview}><View style={styles.accountAvatar}><Text style={styles.accountAvatarText}>{initialFor(title)}</Text></View><View style={styles.accountPreviewCopy}><Text style={styles.accountName} numberOfLines={1}>{title}</Text><Text style={styles.accountMeta}>{partnerTypeLabel(account.partner_type)} · {statusLabel(account.onboarding_status)}</Text></View><StatusChip status={account.onboarding_status} /></Pressable>;
        })}</View> : <View style={styles.accountEmpty}><MaterialCommunityIcons name="account-multiple-plus-outline" size={24} color="#0A43A3" /><Text style={styles.accountEmptyText}>{underReview ? 'Associated accounts will appear after approval.' : 'Add your first associated business to build the Group portfolio.'}</Text></View>}
      </AnimatedCard>

      <Pressable onPress={() => router.push('/customer/group/fleet')} style={({ pressed }) => [styles.fleetCard, pressed && styles.cardPressed]}>
        <View style={styles.fleetLeft}><View style={styles.fleetIcon}><MaterialCommunityIcons name="truck-outline" size={24} color="#0A43A3" /></View><View style={styles.fleetCopy}><Text style={styles.fleetTitle}>Group Fleet</Text><Text style={styles.fleetNumber}>{data.vehicles.length}</Text><Text style={styles.fleetLabel}>Vehicles across associated accounts</Text><View style={styles.viewLink}><Text style={styles.viewLinkText}>Open fleet workspace</Text><MaterialCommunityIcons name="arrow-right" size={14} color="#0A43A3" /></View></View></View>
        <Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" />
      </Pressable>

      <View style={styles.quickActionCard}>
        <Text style={styles.quickActionTitle}>Quick actions</Text>
        <View style={styles.quickActionGrid}>
          <QuickAction icon="account-plus-outline" label="Add Account" disabled={underReview} onPress={() => router.push('/customer/group/add-account')} />
          <QuickAction icon="truck-plus-outline" label="Add Vehicle" disabled={underReview} onPress={() => router.push('/customer/group/fleet')} />
          <QuickAction icon="shield-plus-outline" label="Start Claim" disabled={underReview} onPress={() => router.push('/customer/group/claims')} />
          <QuickAction icon="file-document-plus-outline" label="Get Quote" disabled={underReview} onPress={() => router.push('/customer/insurance-quote')} />
        </View>
      </View>

      <View style={styles.twoColumnRow}>
        <Pressable onPress={() => router.push('/customer/group/policies')} style={({ pressed }) => [styles.operationCard, pressed && styles.cardPressed]}>
          <View style={[styles.operationIcon, { backgroundColor: '#FFF7EA' }]}><MaterialCommunityIcons name="file-document-outline" size={21} color="#D99012" /></View>
          <Text style={styles.operationTitle}>Policies</Text>
          <Text style={styles.operationPrimary}>{activePolicies.length} active</Text>
          <View style={styles.operationRow}><Text style={styles.operationLabel}>Expiring soon</Text><Text style={styles.operationValue}>{expiringSoon.length}</Text></View>
          <View style={styles.operationRow}><Text style={styles.operationLabel}>Expired</Text><Text style={[styles.operationValue, styles.operationDanger]}>{expiredPolicies.length}</Text></View>
          <Text style={styles.operationCta}>Review renewals</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/customer/group/claims')} style={({ pressed }) => [styles.operationCard, styles.claimOperationCard, pressed && styles.cardPressed]}>
          <View style={[styles.operationIcon, styles.claimOperationIcon]}><MaterialCommunityIcons name="shield-check-outline" size={21} color="#F5B700" /></View>
          <Text style={[styles.operationTitle, styles.claimOperationText]}>Claims</Text>
          <Text style={[styles.operationPrimary, styles.claimOperationText]}>{openClaims.length} active</Text>
          <View style={styles.operationRow}><Text style={styles.claimOperationLabel}>Need action</Text><Text style={styles.claimOperationValue}>{actionRequired.length}</Text></View>
          <View style={styles.operationRow}><Text style={styles.claimOperationLabel}>Settled</Text><Text style={[styles.claimOperationValue, styles.claimSettled]}>{settled.length}</Text></View>
          <Text style={styles.claimOperationCta}>Open workspace</Text>
        </Pressable>
      </View>

      <View style={styles.activityCard}>
        <View style={styles.activityHeader}><View><Text style={styles.cardTitle}>Recent activity</Text><Text style={styles.cardSubtitle}>Latest movement across your Group</Text></View><MaterialCommunityIcons name="history" size={22} color="#0A43A3" /></View>
        <ActivityRow icon="account-check-outline" title={`${data.associated.length} active associated account${data.associated.length === 1 ? '' : 's'}`} body="Portfolio access is up to date" />
        <ActivityRow icon="calendar-clock-outline" title={`${expiringSoon.length} polic${expiringSoon.length === 1 ? 'y' : 'ies'} expiring within 30 days`} body="Open Policies to review renewal action" />
        <ActivityRow icon="shield-alert-outline" title={`${actionRequired.length} claim${actionRequired.length === 1 ? '' : 's'} need attention`} body="Documents or processing action may be pending" last />
      </View>

      <Pressable onPress={() => router.push('/customer/support')} style={({ pressed }) => [styles.supportCard, pressed && styles.cardPressed]}><MaterialCommunityIcons name="headset" size={28} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={25} color={palette.navy} /></Pressable>
    </ScrollView>

    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/group/claims')} onVehicles={() => router.push('/customer/group/fleet')} onSupport={() => router.push('/customer/group/accounts')} onProfile={() => router.push(underReview ? '/customer/profile' : '/customer/group/profile')} /></View>
  </SafeAreaView>;
}

function AnimatedCard({ children, onPress, disabled = false }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  const lift = useRef(new Animated.Value(0)).current;
  function animate(toValue: number) { Animated.spring(lift, { toValue, useNativeDriver: true, speed: 28, bounciness: 4 }).start(); }
  return <Animated.View style={{ transform: [{ translateY: lift }, { scale: lift.interpolate({ inputRange: [-2, 0], outputRange: [0.99, 1] }) }] }}><Pressable disabled={disabled} onPress={onPress} onPressIn={() => animate(-2)} onPressOut={() => animate(0)} style={[styles.dashboardCard, disabled && styles.disabledCard]}>{children}</Pressable></Animated.View>;
}
function AttentionCard({ icon, value, label, tone, soft, onPress, disabled = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: number; label: string; tone: string; soft: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.attentionCard, { backgroundColor: soft }, disabled && styles.disabledCard, pressed && styles.cardPressed]}><MaterialCommunityIcons name={icon} size={18} color={tone} /><Text style={[styles.attentionValue, { color: tone }]}>{value}</Text><Text style={styles.attentionLabel}>{label}</Text></Pressable>; }
function TypeChip({ label, value, tone, soft }: { label: string; value: number; tone: string; soft: string }) { return <View style={[styles.typeChip, { backgroundColor: soft }]}><Text style={[styles.typeChipValue, { color: tone }]}>{value}</Text><Text style={styles.typeChipLabel}>{label}</Text></View>; }
function StatusChip({ status }: { status: string }) { const active = status === 'active' || status === 'approved'; const review = ['submitted','under_review','in_progress'].includes(status); return <View style={[styles.accountStatusChip, active ? styles.accountStatusActive : review ? styles.accountStatusReview : styles.accountStatusMuted]}><Text style={[styles.accountStatusText, active ? styles.accountStatusTextActive : review ? styles.accountStatusTextReview : styles.accountStatusTextMuted]}>{statusLabel(status)}</Text></View>; }
function QuickAction({ icon, label, onPress, disabled = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.quickAction, disabled && styles.disabledAction, pressed && styles.cardPressed]}><View style={styles.quickActionIcon}><MaterialCommunityIcons name={icon} size={20} color={disabled ? '#98A2B3' : '#0A43A3'} /></View><Text style={[styles.quickActionLabel, disabled && styles.disabledText]}>{label}</Text></Pressable>; }
function ActivityRow({ icon, title, body, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string; last?: boolean }) { return <View style={[styles.activityRow, last && styles.activityRowLast]}><View style={styles.activityIcon}><MaterialCommunityIcons name={icon} size={17} color="#0A43A3" /></View><View style={styles.activityCopy}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.activityBody}>{body}</Text></View></View>; }
function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }
function statusLabel(status: string) { if (status === 'active' || status === 'approved') return 'Verified'; if (status === 'under_review') return 'Under review'; if (status === 'submitted') return 'Submitted'; if (status === 'changes_requested') return 'Changes requested'; if (status === 'in_progress') return 'In progress'; return status.replace(/_/g, ' '); }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' }, brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }, iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 }, body: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, gap: 10 },
  greetingBlock: { minHeight: 76, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7F0', paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, greetingCopy: { flex: 1, minWidth: 0 }, greeting: { color: '#607089', fontSize: 11.5, lineHeight: 15, fontWeight: '700' }, groupName: { color: palette.navy, fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 1 }, roleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }, roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#21A66B' }, roleText: { color: '#62728A', fontSize: 10, fontWeight: '800' }, statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', gap: 4 }, statusBadgeReview: { backgroundColor: '#FFF7E8' }, statusText: { color: '#087443', fontSize: 9, fontWeight: '900' }, statusTextReview: { color: '#9A6700' },
  reviewBanner: { borderRadius: 13, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#F3DDBD', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, reviewIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#D99012', alignItems: 'center', justifyContent: 'center' }, reviewCopy: { flex: 1 }, reviewTitle: { color: '#834100', fontSize: 12.5, fontWeight: '900' }, reviewText: { color: '#5E4B35', fontSize: 9.5, lineHeight: 12, fontWeight: '600', marginTop: 1 }, errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 7 }, errorText: { flex: 1, color: '#B42318', fontSize: 10.5, fontWeight: '700' },
  sectionHeader: { marginTop: 2, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, sectionEyebrow: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.7 }, sectionTitle: { color: palette.navy, fontSize: 15, fontWeight: '900', marginTop: 1 }, attentionRow: { flexDirection: 'row', gap: 7 }, attentionCard: { flex: 1, minHeight: 76, borderRadius: 14, padding: 9, borderWidth: 1, borderColor: 'rgba(10,67,163,0.08)' }, attentionValue: { fontSize: 21, lineHeight: 24, fontWeight: '900', marginTop: 3 }, attentionLabel: { color: '#526278', fontSize: 8.8, lineHeight: 11, fontWeight: '700', marginTop: 1 },
  dashboardCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 13, shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }, disabledCard: { opacity: 0.66 }, cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.96 }, cardTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, cardSubtitle: { color: '#62728A', fontSize: 9.7, lineHeight: 13, fontWeight: '600', marginTop: 2 }, accountsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, accountHeaderActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }, addAccountButton: { minHeight: 32, borderRadius: 10, backgroundColor: '#0A43A3', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 3 }, addAccountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, disabledAction: { opacity: 0.45 }, disabledText: { color: '#98A2B3' }, accountTypeRow: { flexDirection: 'row', gap: 6, marginTop: 11 }, typeChip: { flex: 1, borderRadius: 11, paddingVertical: 7, alignItems: 'center' }, typeChipValue: { fontSize: 17, fontWeight: '900' }, typeChipLabel: { color: '#526278', fontSize: 8.5, fontWeight: '700', marginTop: 1 }, accountPreviewList: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#E8EEF5' }, accountPreview: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, accountAvatar: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, accountAvatarText: { color: '#0A43A3', fontSize: 11, fontWeight: '900' }, accountPreviewCopy: { flex: 1 }, accountName: { color: palette.navy, fontSize: 11.5, fontWeight: '800' }, accountMeta: { color: '#667085', fontSize: 8.8, marginTop: 1 }, accountStatusChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, accountStatusActive: { backgroundColor: '#E8F8F0' }, accountStatusReview: { backgroundColor: '#FFF7EA' }, accountStatusMuted: { backgroundColor: '#F2F4F7' }, accountStatusText: { fontSize: 8.5, fontWeight: '900', textTransform: 'capitalize' }, accountStatusTextActive: { color: '#12805C' }, accountStatusTextReview: { color: '#A15C00' }, accountStatusTextMuted: { color: '#667085' }, accountEmpty: { marginTop: 10, minHeight: 52, borderRadius: 12, backgroundColor: '#F7FAFE', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, accountEmptyText: { flex: 1, color: '#526278', fontSize: 9.5, lineHeight: 13, fontWeight: '600' },
  fleetCard: { minHeight: 124, borderRadius: 17, backgroundColor: '#FFFFFF', paddingLeft: 13, paddingRight: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#DCE8F4', shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 9, elevation: 2 }, fleetLeft: { width: 153, zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, fleetIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, fleetCopy: { flex: 1 }, fleetTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, fleetNumber: { color: palette.navy, fontSize: 28, lineHeight: 31, fontWeight: '900', marginTop: 1 }, fleetLabel: { maxWidth: 115, color: '#62728A', fontSize: 9, lineHeight: 12, fontWeight: '600' }, viewLink: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 }, viewLinkText: { color: '#0A43A3', fontSize: 8.7, fontWeight: '800' }, fleetImage: { flex: 1, height: 120, marginLeft: -18, marginRight: -6 },
  quickActionCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 11 }, quickActionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, quickActionGrid: { flexDirection: 'row', gap: 7, marginTop: 9 }, quickAction: { flex: 1, minHeight: 72, borderRadius: 12, backgroundColor: '#F7FAFE', borderWidth: 1, borderColor: '#E3EAF3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, quickActionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, quickActionLabel: { color: palette.navy, fontSize: 8.7, lineHeight: 11, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  twoColumnRow: { flexDirection: 'row', gap: 8 }, operationCard: { flex: 1, minHeight: 166, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12 }, operationIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, operationTitle: { color: palette.navy, fontSize: 14, fontWeight: '900', marginTop: 8 }, operationPrimary: { color: '#0A43A3', fontSize: 20, fontWeight: '900', marginTop: 3 }, operationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }, operationLabel: { color: '#667085', fontSize: 8.8, fontWeight: '600' }, operationValue: { color: palette.navy, fontSize: 11, fontWeight: '900' }, operationDanger: { color: '#C43D2D' }, operationCta: { color: '#D99012', fontSize: 9, fontWeight: '900', marginTop: 'auto' }, claimOperationCard: { backgroundColor: palette.navy, borderColor: palette.navy }, claimOperationIcon: { backgroundColor: 'rgba(245,183,0,0.12)', borderWidth: 1, borderColor: '#F5B700' }, claimOperationText: { color: '#FFFFFF' }, claimOperationLabel: { color: '#C9D7EF', fontSize: 8.8, fontWeight: '600' }, claimOperationValue: { color: '#F6C33B', fontSize: 11, fontWeight: '900' }, claimSettled: { color: '#68BF5B' }, claimOperationCta: { color: '#F6C33B', fontSize: 9, fontWeight: '900', marginTop: 'auto' },
  activityCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12 }, activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }, activityRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, activityRowLast: { borderBottomWidth: 0 }, activityIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, activityCopy: { flex: 1 }, activityTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '800' }, activityBody: { color: '#667085', fontSize: 8.5, lineHeight: 11, marginTop: 1 },
  supportCard: { minHeight: 50, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 7, elevation: 1 }, supportCopy: { flex: 1 }, supportTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, supportText: { color: palette.navy, fontSize: 9.5, fontWeight: '500', marginTop: 1 }, nav: { minHeight: 78, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0' },
});
