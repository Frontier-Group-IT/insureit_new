import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppLoading, useLoadingRouter } from '@/components/app-loading';
import { GroupPageShell } from '@/components/group/group-page-shell';
import { LoadingState } from '@/components/ui';
import { getCurrentSession, getProfile, signOut } from '@/lib/auth';
import {
  customerAccountTitle,
  getAccessibleCustomerContexts,
  getGroupChildAccountOverview,
  getSelectedCustomerContext,
  membershipRoleLabel,
  partnerTypeLabel,
  type CustomerAccountContext,
} from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Profile } from '@/lib/types';

const closedStatuses = new Set(['Closed', 'Settled', 'Rejected', 'Claim Complete']);

type Breakdown = { corporate: number; individual: number; dealership: number; inReview: number };

export function GroupProfileScreen() {
  const router = useLoadingRouter();
  const { runWithLoader } = useAppLoading();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [context, setContext] = useState<CustomerAccountContext | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [associatedCount, setAssociatedCount] = useState(0);
  const [associatedBreakdown, setAssociatedBreakdown] = useState<Breakdown>({ corporate: 0, individual: 0, dealership: 0, inReview: 0 });
  const [recentActivity, setRecentActivity] = useState({ renewals: 0, pendingClaims: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, selected, contexts] = await Promise.all([
          getProfile(session.user.id),
          getSelectedCustomerContext(),
          getAccessibleCustomerContexts(),
        ]);
        const parent = selected && canManageAssociatedAccounts(selected)
          ? selected
          : contexts.find((item) => item.access_source === 'direct' && canManageAssociatedAccounts(item)) ?? null;
        const customerResult = parent ? await supabase.from('customers').select('*').eq('id', parent.customer_id).maybeSingle() : { data: null };
        const associated = contexts.filter((item) => item.access_source === 'group_child' && item.group_customer_id === parent?.customer_id);
        const overview = parent ? await getGroupChildAccountOverview(parent.customer_id) : [];
        const visibleAssociated = overview.length ? overview : associated;
        const accountIds = Array.from(new Set([parent?.customer_id, ...visibleAssociated.map((item) => item.customer_id)].filter((id): id is string => Boolean(id))));
        const [policyResult, claimResult] = accountIds.length ? await Promise.all([
          supabase.from('policies').select('end_date').in('customer_id', accountIds),
          supabase.from('claims').select('current_status').in('customer_id', accountIds),
        ]) : [{ data: [] }, { data: [] }];
        if (!active) return;
        const now = Date.now();
        const renewals = ((policyResult.data ?? []) as { end_date: string }[]).filter((policy) => {
          const days = Math.ceil((new Date(policy.end_date).getTime() - now) / 86400000);
          return days >= 0 && days <= 30;
        }).length;
        const pendingClaims = ((claimResult.data ?? []) as { current_status: string }[]).filter((claim) => !closedStatuses.has(claim.current_status) && /pending|awaited|document/i.test(claim.current_status)).length;
        setProfile(nextProfile);
        setContext(parent);
        setCustomer(customerResult.data);
        setAssociatedCount(visibleAssociated.length);
        setRecentActivity({ renewals, pendingClaims });
        setAssociatedBreakdown({
          corporate: visibleAssociated.filter((item) => item.partner_type === 'corporate').length,
          individual: visibleAssociated.filter((item) => item.partner_type === 'individual_proprietor').length,
          dealership: visibleAssociated.filter((item) => item.partner_type === 'dealership').length,
          inReview: overview.filter((item) => item.account_source === 'onboarding_application' && item.onboarding_status !== 'approved').length,
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router]);

  const accountName = context ? customerAccountTitle(context) : 'Customer Account';
  const partnerLabel = context ? partnerTypeLabel(context.partner_type) : 'Customer';
  const accountSectionTitle = context?.partner_type === 'group' ? 'Group Account' : `${partnerLabel} Account`;
  const allowedStats = context ? associatedStatsForParent(context, associatedBreakdown) : [];
  const signOutNow = () => void runWithLoader(() => signOut(router), 'Signing out');

  return <GroupPageShell title={`${partnerLabel} Profile`} subtitle={accountName} icon="account-circle-outline" loading={loading}>
    {loading ? <LoadingState /> : <>
      <View style={styles.identityCard}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>{(profile?.full_name?.[0] || 'U').toUpperCase()}</Text></View><View style={styles.identityCopy}><Text style={styles.profileName}>{profile?.full_name || 'Customer User'}</Text><Text style={styles.profileRole}>{partnerLabel}</Text></View><View style={styles.verifiedBadge}><MaterialCommunityIcons name="check-decagram" size={15} color="#087443" /><Text style={styles.verifiedText}>Verified</Text></View></View>
      <Text style={styles.sectionTitle}>Signed-in User</Text>
      <View style={styles.profileCard}><ProfileRow icon="account-outline" label="Name" value={profile?.full_name || '-'} /><ProfileRow icon="phone-outline" label="Mobile" value={profile?.phone || '-'} /><ProfileRow icon="email-outline" label="Email" value={profile?.email || '-'} /><ProfileRow icon="account-key-outline" label="Role" value={context ? membershipRoleLabel(context.membership_role) : '-'} /></View>
      <Text style={styles.sectionTitle}>{accountSectionTitle}</Text>
      <View style={styles.profileCard}><ProfileRow icon="office-building-outline" label={`${partnerLabel} Name`} value={accountName} /><ProfileRow icon="identifier" label="Customer Code" value={context?.customer_code || '-'} /><ProfileRow icon="account-group-outline" label="Associated Customers" value={String(associatedCount)} /><ProfileRow icon="check-decagram-outline" label="Status" value={customer?.onboarding_status === 'active' ? 'Active' : customer?.onboarding_status || '-'} /><ProfileRow icon="map-marker-outline" label="Location" value={[customer?.city, customer?.state].filter(Boolean).join(', ') || '-'} /></View>
      <Text style={styles.sectionTitle}>Associated Accounts</Text>
      <View style={styles.associatedCard}>
        <View style={styles.associatedTop}><View style={styles.associatedIcon}><MaterialCommunityIcons name="account-group-outline" size={24} color="#0A43A3" /></View><View style={styles.associatedCopy}><Text style={styles.associatedTitle}>{associatedCount} associated customer{associatedCount === 1 ? '' : 's'}</Text><Text style={styles.associatedText}>Manage the account types allowed under this {partnerLabel.toLowerCase()} account.</Text></View></View>
        <View style={styles.associatedStats}>{allowedStats.map((item) => <MiniStat key={item.label} label={item.label} value={item.value} />)}<MiniStat label="In review" value={associatedBreakdown.inReview} /></View>
        <View style={styles.associatedActions}><Pressable onPress={() => router.push('/customer/group/accounts')} style={styles.associatedSecondary}><Text style={styles.associatedSecondaryText}>View Accounts</Text></Pressable><Pressable onPress={() => router.push('/customer/group/add-account')} style={styles.associatedPrimary}><MaterialCommunityIcons name="account-plus-outline" size={17} color="#FFFFFF" /><Text style={styles.associatedPrimaryText}>Add Account</Text></Pressable></View>
      </View>
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.activityCard}>
        <ActivityRow icon="account-check-outline" title={`${associatedCount} associated account${associatedCount === 1 ? '' : 's'}`} body="Account access and portfolio links are available here." />
        <ActivityRow icon="calendar-clock-outline" title={`${recentActivity.renewals} pending renewal${recentActivity.renewals === 1 ? '' : 's'}`} body="Open policies when renewal action is needed." />
        <ActivityRow icon="shield-alert-outline" title={`${recentActivity.pendingClaims} pending claim${recentActivity.pendingClaims === 1 ? '' : 's'}`} body="Documents or processing action may be pending." last />
      </View>
      <View style={styles.profileMenu}><MenuRow icon="account-multiple-outline" title="Associated Customers" onPress={() => router.push('/customer/group/accounts')} /><MenuRow icon="bell-outline" title="Notification Preferences" onPress={() => router.push('/customer/notifications')} /><MenuRow icon="headset" title="Support" onPress={() => router.push('/customer/support')} /><MenuRow icon="logout" title="Sign out" danger onPress={signOutNow} /></View>
    </>}
  </GroupPageShell>;
}

function canManageAssociatedAccounts(context: CustomerAccountContext) {
  return ['group', 'corporate', 'dealership'].includes(context.partner_type);
}
function associatedStatsForParent(context: CustomerAccountContext, breakdown: Breakdown) {
  if (context.partner_type === 'corporate') return [{ label: 'Individual', value: breakdown.individual }];
  if (context.partner_type === 'dealership') return [{ label: 'Corporate', value: breakdown.corporate }, { label: 'Individual', value: breakdown.individual }];
  return [{ label: 'Corporate', value: breakdown.corporate }, { label: 'Individual', value: breakdown.individual }, { label: 'Dealership', value: breakdown.dealership }];
}
function ProfileRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) { return <View style={styles.profileRow}><View style={styles.profileRowIcon}><MaterialCommunityIcons name={icon} size={19} color="#0A43A3" /></View><View style={styles.profileRowCopy}><Text style={styles.profileRowLabel}>{label}</Text><Text style={styles.profileRowValue}>{value}</Text></View></View>; }
function MiniStat({ label, value }: { label: string; value: number }) { return <View style={styles.miniStat}><Text style={styles.miniStatValue}>{value}</Text><Text style={styles.miniStatLabel}>{label}</Text></View>; }
function ActivityRow({ icon, title, body, last = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body: string; last?: boolean }) { return <View style={[styles.activityRow, last && styles.activityRowLast]}><View style={styles.activityIcon}><MaterialCommunityIcons name={icon} size={17} color="#0A43A3" /></View><View style={styles.activityCopy}><Text style={styles.activityTitle}>{title}</Text><Text style={styles.activityBody}>{body}</Text></View></View>; }
function MenuRow({ icon, title, onPress, danger = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; onPress: () => void; danger?: boolean }) { return <Pressable onPress={onPress} style={styles.menuRow}><View style={[styles.profileRowIcon, danger && styles.dangerIcon]}><MaterialCommunityIcons name={icon} size={19} color={danger ? '#B42318' : '#0A43A3'} /></View><Text style={[styles.menuText, danger && styles.dangerText]}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={22} color={danger ? '#B42318' : '#7A8799'} /></Pressable>; }

const styles = StyleSheet.create({
  identityCard: { minHeight: 104, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, profileAvatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center' }, profileInitial: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' }, identityCopy: { flex: 1, minWidth: 0 }, profileName: { color: palette.navy, fontSize: 16, fontWeight: '900' }, profileRole: { color: '#0A43A3', fontSize: 10.5, fontWeight: '800', marginTop: 3 }, verifiedBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', gap: 4 }, verifiedText: { color: '#087443', fontSize: 8.5, fontWeight: '900' }, sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, profileCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12 }, profileRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, profileRowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, profileRowCopy: { flex: 1 }, profileRowLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700' }, profileRowValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 2 }, associatedCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, gap: 11 }, associatedTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, associatedIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, associatedCopy: { flex: 1, minWidth: 0 }, associatedTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, associatedText: { color: '#65758B', fontSize: 10.2, lineHeight: 14, fontWeight: '700', marginTop: 2 }, associatedStats: { flexDirection: 'row', gap: 6 }, miniStat: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#E1EAF4', alignItems: 'center', justifyContent: 'center' }, miniStatValue: { color: '#0A43A3', fontSize: 15, fontWeight: '900' }, miniStatLabel: { color: '#65758B', fontSize: 8.2, fontWeight: '800', marginTop: 1, textAlign: 'center' }, associatedActions: { flexDirection: 'row', gap: 8 }, associatedSecondary: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#C9D5E3', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, associatedSecondaryText: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, associatedPrimary: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, associatedPrimaryText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' }, activityCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12 }, activityRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, activityRowLast: { borderBottomWidth: 0 }, activityIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, activityCopy: { flex: 1 }, activityTitle: { color: palette.navy, fontSize: 10.8, fontWeight: '900' }, activityBody: { color: '#65758B', fontSize: 9, lineHeight: 12, fontWeight: '700', marginTop: 1 }, profileMenu: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12 }, menuRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, menuText: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '800' }, dangerIcon: { backgroundColor: '#FEF3F2' }, dangerText: { color: '#B42318' },
});
