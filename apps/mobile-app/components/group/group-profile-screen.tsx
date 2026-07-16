import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupPageShell } from '@/components/group/group-page-shell';
import { LoadingState } from '@/components/ui';
import { customerAccountTitle, getAccessibleCustomerContexts, getSelectedCustomerContext, membershipRoleLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { getCurrentSession, getProfile, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export function GroupProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [context, setContext] = useState<CustomerAccountContext | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [associatedCount, setAssociatedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { let active = true; void (async () => {
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const [nextProfile, selected, contexts] = await Promise.all([getProfile(session.user.id), getSelectedCustomerContext(), getAccessibleCustomerContexts()]);
      const group = selected?.partner_type === 'group' ? selected : contexts.find((item) => item.partner_type === 'group' && item.access_source === 'direct') ?? null;
      const customerResult = group ? await supabase.from('customers').select('*').eq('id', group.customer_id).maybeSingle() : { data: null };
      if (!active) return;
      setProfile(nextProfile); setContext(group); setCustomer(customerResult.data); setAssociatedCount(contexts.filter((item) => item.access_source === 'group_child' && item.group_customer_id === group?.customer_id).length);
    } finally { if (active) setLoading(false); }
  })(); return () => { active = false; }; }, [router]);

  const groupName = context ? customerAccountTitle(context) : 'Group Account';
  return <GroupPageShell title="Group Profile" subtitle={groupName} icon="account-circle-outline">
    {loading ? <LoadingState /> : <>
      <View style={styles.identityCard}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>{(profile?.full_name?.[0] || 'U').toUpperCase()}</Text></View><View style={styles.identityCopy}><Text style={styles.profileName}>{profile?.full_name || 'Group User'}</Text><Text style={styles.profileRole}>{context ? membershipRoleLabel(context.membership_role) : 'Group Member'}</Text><Text style={styles.profileAccount}>{groupName}</Text></View><View style={styles.verifiedBadge}><MaterialCommunityIcons name="check-decagram" size={15} color="#087443" /><Text style={styles.verifiedText}>Verified</Text></View></View>
      <Text style={styles.sectionTitle}>Signed-in User</Text>
      <View style={styles.profileCard}><ProfileRow icon="account-outline" label="Name" value={profile?.full_name || '—'} /><ProfileRow icon="phone-outline" label="Mobile" value={profile?.phone || '—'} /><ProfileRow icon="email-outline" label="Email" value={profile?.email || '—'} /><ProfileRow icon="account-key-outline" label="Role" value={context ? membershipRoleLabel(context.membership_role) : '—'} /></View>
      <Text style={styles.sectionTitle}>Group Account</Text>
      <View style={styles.profileCard}><ProfileRow icon="office-building-outline" label="Group Name" value={groupName} /><ProfileRow icon="identifier" label="Customer Code" value={context?.customer_code || '—'} /><ProfileRow icon="account-group-outline" label="Associated Customers" value={String(associatedCount)} /><ProfileRow icon="check-decagram-outline" label="Status" value={customer?.onboarding_status === 'active' ? 'Active' : customer?.onboarding_status || '—'} /><ProfileRow icon="map-marker-outline" label="Location" value={[customer?.city, customer?.state].filter(Boolean).join(', ') || '—'} /></View>
      <View style={styles.profileMenu}><MenuRow icon="account-multiple-outline" title="Associated Customers" onPress={() => router.push('/customer/group/accounts')} /><MenuRow icon="bell-outline" title="Notification Preferences" onPress={() => router.push('/customer/notifications')} /><MenuRow icon="headset" title="Support" onPress={() => router.push('/customer/support')} /><MenuRow icon="logout" title="Sign out" danger onPress={() => void signOut(router)} /></View>
    </>}
  </GroupPageShell>;
}

function ProfileRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) { return <View style={styles.profileRow}><View style={styles.profileRowIcon}><MaterialCommunityIcons name={icon} size={19} color="#0A43A3" /></View><View style={styles.profileRowCopy}><Text style={styles.profileRowLabel}>{label}</Text><Text style={styles.profileRowValue}>{value}</Text></View></View>; }
function MenuRow({ icon, title, onPress, danger = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; onPress: () => void; danger?: boolean }) { return <Pressable onPress={onPress} style={styles.menuRow}><View style={[styles.profileRowIcon, danger && styles.dangerIcon]}><MaterialCommunityIcons name={icon} size={19} color={danger ? '#B42318' : '#0A43A3'} /></View><Text style={[styles.menuText, danger && styles.dangerText]}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={22} color={danger ? '#B42318' : '#7A8799'} /></Pressable>; }

const styles = StyleSheet.create({
  identityCard: { minHeight: 104, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }, profileAvatar: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center' }, profileInitial: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' }, identityCopy: { flex: 1, minWidth: 0 }, profileName: { color: palette.navy, fontSize: 16, fontWeight: '900' }, profileRole: { color: '#0A43A3', fontSize: 10.5, fontWeight: '800', marginTop: 3 }, profileAccount: { color: '#65758B', fontSize: 10, fontWeight: '600', marginTop: 2 }, verifiedBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#ECFDF3', flexDirection: 'row', alignItems: 'center', gap: 4 }, verifiedText: { color: '#087443', fontSize: 8.5, fontWeight: '900' }, sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, profileCard: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12 }, profileRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, profileRowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, profileRowCopy: { flex: 1 }, profileRowLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700' }, profileRowValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 2 }, profileMenu: { borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12 }, menuRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, menuText: { flex: 1, color: palette.navy, fontSize: 11.5, fontWeight: '800' }, dangerIcon: { backgroundColor: '#FEF3F2' }, dangerText: { color: '#B42318' },
});