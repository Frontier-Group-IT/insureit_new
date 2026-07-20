import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNavigation } from '@/components/customer-dashboard';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { LoadingState } from '@/components/ui';
import { buildComplianceRenewals } from '@/lib/compliance-renewals';
import { customerAccountTitle, getAccessibleCustomerContexts, getGroupChildAccountOverview, membershipRoleLabel, partnerTypeLabel, type CustomerAccountContext, type GroupChildAccountOverview } from '@/lib/customer-context';
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
        const associated = selectedGroupContext.partner_type === 'group'
          ? await getGroupChildAccountOverview(selectedGroupContext.customer_id)
          : (await getAccessibleCustomerContexts())
            .filter((item) => item.customer_id !== selectedGroupContext.customer_id && item.group_customer_id === selectedGroupContext.customer_id)
            .map(contextToOverview);
        const accountIds = Array.from(new Set([selectedGroupContext.customer_id, ...associated.map((item) => item.customer_id).filter((id): id is string => Boolean(id))]));
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
        console.warn('Portfolio dashboard load failed', nextError);
        if (active) setError('We could not load the portfolio overview. Please try again.');
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
  const portfolioLabel = groupContext ? partnerTypeLabel(groupContext.partner_type) : 'Group';
  const roleLabel = groupContext ? dashboardAccountRoleLabel(groupContext) : 'Group Owner';

  const now = Date.now();
  const activePolicies = useMemo(() => data.policies.filter((policy) => new Date(policy.end_date).getTime() >= now), [data.policies, now]);
  const expiredPolicies = useMemo(() => data.policies.filter((policy) => new Date(policy.end_date).getTime() < now), [data.policies, now]);
  const complianceRenewals = useMemo(() => buildComplianceRenewals({ vehicles: data.vehicles, policies: data.policies }), [data.vehicles, data.policies]);
  const expiringSoon = useMemo(() => data.policies.filter((policy) => {
    const days = Math.ceil((new Date(policy.end_date).getTime() - now) / 86400000);
    return days >= 0 && days <= 45;
  }), [data.policies, now]);
  const openClaims = useMemo(() => data.claims.filter((claim) => !closedStatuses.has(claim.current_status)), [data.claims]);
  const settled = useMemo(() => data.claims.filter((claim) => claim.current_status === 'Closed' || claim.current_status === 'Settled'), [data.claims]);
  const actionRequired = useMemo(() => openClaims.filter((claim) => /pending|awaited|document/i.test(claim.current_status)), [openClaims]);
  if (loading) return <View style={styles.loading}><LoadingState label={`Opening ${portfolioLabel} dashboard`} /></View>;

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
          {groupContext?.group_name ? <Text style={styles.parentCompany}>Associated with {groupContext.group_name}</Text> : null}
        </View>
        <View style={[styles.statusBadge, underReview && styles.statusBadgeReview]}>
          <MaterialCommunityIcons name={underReview ? 'clock-outline' : 'check-decagram'} size={14} color={underReview ? '#9A6700' : '#087443'} />
          <Text style={[styles.statusText, underReview && styles.statusTextReview]}>{underReview ? 'Under Review' : 'Verified'}</Text>
        </View>
      </View>

      {underReview ? <View style={styles.reviewBanner}><View style={styles.reviewIcon}><MaterialCommunityIcons name="clipboard-clock-outline" size={19} color="#FFFFFF" /></View><View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Verification in progress</Text><Text style={styles.reviewText}>You can explore the dashboard. Account-management actions unlock after approval.</Text></View></View> : null}
      {error ? <View style={styles.errorCard}><MaterialCommunityIcons name="alert-circle-outline" size={19} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}

      <AttentionStrip
        renewals={complianceRenewals.totalPending}
        claims={actionRequired.length}
        disabled={underReview}
        onRenewals={() => router.push('/customer/renewals' as any)}
        onClaims={() => router.push('/customer/group/claims')}
      />

      <Pressable onPress={() => router.push('/customer/group/fleet')} style={({ pressed }) => [styles.fleetCard, pressed && styles.cardPressed]}>
        <View style={styles.fleetLeft}><View style={styles.fleetIcon}><MaterialCommunityIcons name="truck-outline" size={24} color="#0A43A3" /></View><View style={styles.fleetCopy}><Text style={styles.fleetTitle}>{portfolioLabel} Fleet</Text><Text style={styles.fleetNumber}>{data.vehicles.length}</Text><Text style={styles.fleetLabel}>Vehicles across accessible accounts</Text><View style={styles.viewLink}><Text style={styles.viewLinkText}>Open fleet workspace</Text><MaterialCommunityIcons name="arrow-right" size={14} color="#0A43A3" /></View></View></View>
        <Image source={fleetSketch} style={styles.fleetImage} resizeMode="contain" />
      </Pressable>

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

      <View style={styles.quickActionCard}>
        <Text style={styles.quickActionTitle}>Quick actions</Text>
        <View style={styles.quickActionGrid}>
          <QuickAction icon="account-plus-outline" label="Add Account" disabled={underReview} onPress={() => router.push('/customer/group/add-account')} />
          <QuickAction icon="truck-plus-outline" label="Add Vehicle" disabled={underReview} onPress={() => router.push('/customer/add-vehicle')} />
          <QuickAction icon="shield-plus-outline" label="Start Claim" disabled={underReview} onPress={() => router.push('/customer/report-accident')} />
          <QuickAction icon="file-document-plus-outline" label="Get Quote" disabled={underReview} onPress={() => router.push('/customer/insurance-quote')} />
        </View>
      </View>

      <Pressable onPress={() => router.push('/customer/support')} style={({ pressed }) => [styles.supportCard, pressed && styles.cardPressed]}><MaterialCommunityIcons name="headset" size={28} color={palette.navy} /><View style={styles.supportCopy}><Text style={styles.supportTitle}>Need Help?</Text><Text style={styles.supportText}>Contact our support team</Text></View><MaterialCommunityIcons name="chevron-right" size={25} color={palette.navy} /></Pressable>
    </ScrollView>

    <View style={styles.nav}><BottomNavigation onClaims={() => router.push('/customer/group/claims')} onVehicles={() => router.push('/customer/group/fleet')} onSupport={() => router.push('/customer/group/accounts')} onProfile={() => router.push(underReview ? '/customer/profile' : '/customer/group/profile')} /></View>
  </SafeAreaView>;
}

function AttentionStrip({ renewals, claims, disabled, onRenewals, onClaims }: { renewals: number; claims: number; disabled: boolean; onRenewals: () => void; onClaims: () => void }) {
  return <View style={styles.attentionStrip}>
    <View style={styles.attentionStripHeader}>
      <View style={styles.attentionStripIcon}><MaterialCommunityIcons name="bell-alert-outline" size={17} color="#0A43A3" /></View>
      <View style={styles.attentionStripCopy}>
        <Text style={styles.attentionStripTitle}>Needs Your Attention</Text>
        <Text style={styles.attentionStripText}>Track expiring policies, permits and claims that need action.</Text>
      </View>
    </View>
    <View style={styles.attentionPills}>
      <AttentionPill icon="calendar-alert" value={renewals} label="Pending Renewals" tone="#D99012" soft="#FFF7EA" onPress={onRenewals} disabled={disabled} />
      <AttentionPill icon="file-alert-outline" value={claims} label="Pending Claims" tone="#C43D2D" soft="#FFF0EE" onPress={onClaims} disabled={disabled} />
    </View>
  </View>;
}
function AttentionPill({ icon, value, label, tone, soft, onPress, disabled = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; value: number; label: string; tone: string; soft: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.attentionPill, { backgroundColor: soft }, disabled && styles.disabledAction, pressed && styles.cardPressed]}><MaterialCommunityIcons name={icon} size={15} color={tone} /><Text style={[styles.attentionPillValue, { color: tone }]}>{value}</Text><Text style={styles.attentionPillLabel}>{label}</Text></Pressable>;
}
function QuickAction({ icon, label, onPress, disabled = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.quickAction, disabled && styles.disabledAction, pressed && styles.cardPressed]}><View style={styles.quickActionIcon}><MaterialCommunityIcons name={icon} size={20} color={disabled ? '#98A2B3' : '#0A43A3'} /></View><Text style={[styles.quickActionLabel, disabled && styles.disabledText]}>{label}</Text></Pressable>; }
function contextToOverview(context: CustomerAccountContext): GroupChildAccountOverview {
  return {
    row_id: context.customer_id,
    customer_id: context.customer_id,
    application_id: null,
    customer_code: context.customer_code,
    partner_type: context.partner_type,
    company_name: context.company_name,
    contact_name: context.contact_name,
    phone: null,
    city: null,
    state: null,
    onboarding_status: 'active',
    application_status: null,
    account_source: 'linked_customer',
    created_at: null,
    updated_at: null,
  };
}
function timeGreeting() { const hour = new Date().getHours(); if (hour < 12) return 'Good Morning'; if (hour < 17) return 'Good Afternoon'; return 'Good Evening'; }
function initialFor(name: string) { return (name.trim()[0] || 'U').toUpperCase(); }
function dashboardAccountRoleLabel(context: CustomerAccountContext) {
  if (context.partner_type === 'corporate') return 'Corporate Account';
  if (context.partner_type === 'dealership') return 'Dealership';
  return membershipRoleLabel(context.membership_role);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9FD' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' }, brand: { flex: 1, alignItems: 'flex-start', justifyContent: 'center' }, iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  scroll: { flex: 1 }, body: { paddingHorizontal: 13, paddingTop: 9, paddingBottom: 10, gap: 11 },
  greetingBlock: { minHeight: 66, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7F0', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, greetingCopy: { flex: 1, minWidth: 0 }, greeting: { color: '#607089', fontSize: 11, lineHeight: 14, fontWeight: '700' }, groupName: { color: palette.navy, fontSize: 16.5, lineHeight: 20, fontWeight: '900', marginTop: 1 }, roleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }, roleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#21A66B' }, roleText: { color: '#62728A', fontSize: 9.5, fontWeight: '800' }, parentCompany: { color: '#0A43A3', fontSize: 9.5, lineHeight: 12, fontWeight: '800', marginTop: 2 }, statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', gap: 4 }, statusBadgeReview: { backgroundColor: '#FFF7E8' }, statusText: { color: '#087443', fontSize: 9, fontWeight: '900' }, statusTextReview: { color: '#9A6700' },
  reviewBanner: { borderRadius: 13, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: '#F3DDBD', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }, reviewIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#D99012', alignItems: 'center', justifyContent: 'center' }, reviewCopy: { flex: 1 }, reviewTitle: { color: '#834100', fontSize: 12.5, fontWeight: '900' }, reviewText: { color: '#5E4B35', fontSize: 9.5, lineHeight: 12, fontWeight: '600', marginTop: 1 }, errorCard: { borderRadius: 12, borderWidth: 1, borderColor: '#FECDCA', backgroundColor: '#FEF3F2', padding: 9, flexDirection: 'row', alignItems: 'center', gap: 7 }, errorText: { flex: 1, color: '#B42318', fontSize: 10.5, fontWeight: '700' },
  attentionStrip: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 10, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  attentionStripHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attentionStripIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  attentionStripCopy: { flex: 1, minWidth: 0 },
  attentionStripTitle: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  attentionStripText: { color: '#62728A', fontSize: 9.3, fontWeight: '700', marginTop: 1 },
  attentionPills: { flexDirection: 'row', gap: 8, marginTop: 9 },
  attentionPill: { flex: 1, minHeight: 36, borderRadius: 999, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(10,67,163,0.06)' },
  attentionPillValue: { fontSize: 12.5, fontWeight: '900' },
  attentionPillLabel: { color: '#526278', fontSize: 8.7, fontWeight: '800' },
  dashboardCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 13, shadowColor: '#122544', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 }, disabledCard: { opacity: 0.66 }, cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.96 }, cardTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, cardSubtitle: { color: '#62728A', fontSize: 9.7, lineHeight: 13, fontWeight: '600', marginTop: 2 }, accountsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, accountHeaderActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 }, viewAllText: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900' }, disabledAction: { opacity: 0.45 }, disabledText: { color: '#98A2B3' }, accountTypeRow: { flexDirection: 'row', gap: 6, marginTop: 11 }, typeChip: { flex: 1, borderRadius: 11, paddingVertical: 7, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(10,67,163,0.05)' }, typeChipValue: { fontSize: 17, fontWeight: '900' }, typeChipLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 1 }, typeChipLabel: { color: '#526278', fontSize: 8.5, fontWeight: '700' },
  primaryAddAccount: { minHeight: 58, borderRadius: 15, marginTop: 12, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#0A43A3', shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  primaryAddIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  primaryAddCopy: { flex: 1, minWidth: 0 },
  primaryAddTitle: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  primaryAddText: { color: '#C9D7EF', fontSize: 10.2, lineHeight: 13, fontWeight: '700', marginTop: 2 },
  fleetCard: { minHeight: 111, borderRadius: 16, backgroundColor: '#FFFFFF', paddingLeft: 12, paddingRight: 6, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#DCE8F4', shadowColor: '#122544', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, fleetLeft: { width: 150, zIndex: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, fleetIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, fleetCopy: { flex: 1 }, fleetTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900' }, fleetNumber: { color: palette.navy, fontSize: 27, lineHeight: 29, fontWeight: '900', marginTop: 1 }, fleetLabel: { maxWidth: 112, color: '#62728A', fontSize: 8.8, lineHeight: 11.5, fontWeight: '600' }, viewLink: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }, viewLinkText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '800' }, fleetImage: { flex: 1, height: 108, marginLeft: -18, marginRight: -6 },
  quickActionCard: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 10 }, quickActionTitle: { color: palette.navy, fontSize: 13.2, fontWeight: '900' }, quickActionGrid: { flexDirection: 'row', gap: 7, marginTop: 8 }, quickAction: { flex: 1, minHeight: 65, borderRadius: 12, backgroundColor: '#F7FAFE', borderWidth: 1, borderColor: '#E3EAF3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, quickActionIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, quickActionLabel: { color: palette.navy, fontSize: 8.5, lineHeight: 10.7, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  twoColumnRow: { flexDirection: 'row', gap: 8 }, operationCard: { flex: 1, minHeight: 143, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 10 }, operationIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, operationTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900', marginTop: 7 }, operationPrimary: { color: '#0A43A3', fontSize: 19, fontWeight: '900', marginTop: 2 }, operationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }, operationLabel: { color: '#667085', fontSize: 8.6, fontWeight: '600' }, operationValue: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, operationDanger: { color: '#C43D2D' }, operationCta: { color: '#D99012', fontSize: 8.8, fontWeight: '900', marginTop: 'auto' }, claimOperationCard: { backgroundColor: palette.navy, borderColor: palette.navy }, claimOperationIcon: { backgroundColor: 'rgba(245,183,0,0.12)', borderWidth: 1, borderColor: '#F5B700' }, claimOperationText: { color: '#FFFFFF' }, claimOperationLabel: { color: '#C9D7EF', fontSize: 8.6, fontWeight: '600' }, claimOperationValue: { color: '#F6C33B', fontSize: 10.5, fontWeight: '900' }, claimSettled: { color: '#68BF5B' }, claimOperationCta: { color: '#F6C33B', fontSize: 8.8, fontWeight: '900', marginTop: 'auto' },
  supportCard: { minHeight: 52, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#122544', shadowOpacity: 0.04, shadowRadius: 7, elevation: 1 }, supportCopy: { flex: 1 }, supportTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, supportText: { color: palette.navy, fontSize: 9.5, fontWeight: '500', marginTop: 1 }, nav: { minHeight: 76, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 5, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0' },
});
