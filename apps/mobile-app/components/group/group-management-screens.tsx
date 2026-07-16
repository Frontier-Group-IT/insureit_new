import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { customerAccountTitle, getAccessibleCustomerContexts, getSelectedCustomerContext, membershipRoleLabel, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { getCurrentSession, getProfile, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Profile } from '@/lib/types';

type AccountType = 'corporate' | 'individual_proprietor' | 'dealership';

export function AddAssociatedAccountScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<AccountType | null>(null);
  const [values, setValues] = useState({ accountName: '', contactName: '', mobile: '', email: '', city: '', state: '' });
  const [message, setMessage] = useState('');

  const ready = Boolean(type && values.accountName.trim() && values.contactName.trim() && values.mobile.replace(/\D/g, '').length === 10 && values.city.trim() && values.state.trim());
  const label = type === 'corporate' ? 'Company Name' : type === 'dealership' ? 'Dealership Name' : 'Customer / Trade Name';

  function next() { setMessage(''); if (step === 1 && !type) return setMessage('Select an account type to continue.'); if (step === 2 && !ready) return setMessage('Complete all required details before continuing.'); setStep((current) => current === 1 ? 2 : 3); }

  return <Screen title="Add Associated Customer" showLogout>
    <View style={styles.stepHeader}><Text style={styles.pageTitle}>Add Associated Customer</Text><Text style={styles.pageSub}>Add a business or customer account to the Group portfolio.</Text><View style={styles.stepTrack}>{[1,2,3].map((item) => <View key={item} style={[styles.stepDot, item <= step && styles.stepDotActive]} />)}</View></View>
    {message ? <Message type="error">{message}</Message> : null}

    {step === 1 ? <View style={styles.section}><Text style={styles.sectionTitle}>Select account type</Text><Text style={styles.sectionText}>Choose the type of customer you want to associate with this Group.</Text>{([
      ['corporate','office-building-outline','Corporate','Companies and fleet-owning businesses'],
      ['individual_proprietor','account-outline','Individual / Proprietor','Individual owners and proprietorship firms'],
      ['dealership','storefront-outline','Dealership','Vehicle dealers and authorized outlets'],
    ] as const).map(([value,icon,title,body]) => <Pressable key={value} onPress={() => setType(value)} style={[styles.typeCard, type === value && styles.typeCardSelected]}><View style={[styles.typeIcon, type === value && styles.typeIconSelected]}><MaterialCommunityIcons name={icon} size={25} color={type === value ? '#FFFFFF' : '#0A43A3'} /></View><View style={styles.typeCopy}><Text style={styles.typeTitle}>{title}</Text><Text style={styles.typeBody}>{body}</Text></View>{type === value ? <MaterialCommunityIcons name="check-circle" size={23} color="#0A43A3" /> : <MaterialCommunityIcons name="chevron-right" size={23} color="#7A8799" />}</Pressable>)}</View> : null}

    {step === 2 ? <View style={styles.section}><Text style={styles.sectionTitle}>Basic information</Text><Text style={styles.sectionText}>Enter the primary details. Complete KYC and documents can be collected in the next stage.</Text><Field label={`${label} *`} value={values.accountName} onChangeText={(accountName) => setValues((current) => ({ ...current, accountName }))} /><Field label="Contact Person *" value={values.contactName} onChangeText={(contactName) => setValues((current) => ({ ...current, contactName }))} /><Field label="Mobile Number *" value={values.mobile} keyboardType="phone-pad" onChangeText={(mobile) => setValues((current) => ({ ...current, mobile: mobile.replace(/\D/g, '').slice(0, 10) }))} /><Field label="Email" value={values.email} keyboardType="email-address" onChangeText={(email) => setValues((current) => ({ ...current, email }))} /><View style={styles.twoColumn}><View style={styles.flex}><Field label="City *" value={values.city} onChangeText={(city) => setValues((current) => ({ ...current, city }))} /></View><View style={styles.flex}><Field label="State *" value={values.state} onChangeText={(state) => setValues((current) => ({ ...current, state }))} /></View></View></View> : null}

    {step === 3 ? <View style={styles.section}><Text style={styles.sectionTitle}>Review details</Text><Text style={styles.sectionText}>Confirm the account information before starting onboarding.</Text><View style={styles.reviewCard}><Review label="Account Type" value={type ? partnerTypeLabel(type) : '—'} /><Review label="Account Name" value={values.accountName} /><Review label="Contact Person" value={values.contactName} /><Review label="Mobile" value={values.mobile} /><Review label="Email" value={values.email || '—'} /><Review label="Location" value={`${values.city}, ${values.state}`} /></View><View style={styles.infoCard}><MaterialCommunityIcons name="information-outline" size={20} color="#0A43A3" /><Text style={styles.infoText}>The production action should reuse the same validated onboarding service used by the web portal. This test layout does not create database records.</Text></View></View> : null}

    <View style={styles.footerActions}>{step > 1 ? <Pressable onPress={() => setStep((current) => current === 3 ? 2 : 1)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Back</Text></Pressable> : <Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>}<Pressable onPress={step === 3 ? () => { setMessage('Layout preview complete. Connect this action to the approved onboarding RPC after testing.'); } : next} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{step === 3 ? 'Create Account' : 'Continue'}</Text><MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" /></Pressable></View>
  </Screen>;
}

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

  if (loading) return <Screen title="Profile"><LoadingState /></Screen>;
  const groupName = context ? customerAccountTitle(context) : 'Group Account';
  return <Screen title="Profile" showTitleHeader={false}>
    <View style={styles.profileHeading}><Text style={styles.pageTitle}>Profile</Text><Pressable onPress={() => void signOut(router)}><Text style={styles.signOut}>Sign out</Text></Pressable></View>
    <View style={styles.profileHero}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>{(profile?.full_name?.[0] || 'U').toUpperCase()}</Text></View><View style={styles.profileHeroCopy}><Text style={styles.profileName}>{profile?.full_name || 'Group User'}</Text><Text style={styles.profileRole}>{context ? membershipRoleLabel(context.membership_role) : 'Group Member'}</Text><Text style={styles.profileAccount}>{groupName}</Text></View></View>
    <Text style={styles.sectionTitle}>Signed-in User</Text>
    <View style={styles.profileCard}><ProfileRow icon="account-outline" label="Name" value={profile?.full_name || '—'} /><ProfileRow icon="phone-outline" label="Mobile" value={profile?.phone || '—'} /><ProfileRow icon="email-outline" label="Email" value={profile?.email || '—'} /><ProfileRow icon="account-key-outline" label="Role" value={context ? membershipRoleLabel(context.membership_role) : '—'} /></View>
    <Text style={styles.sectionTitle}>Group Account</Text>
    <View style={styles.profileCard}><ProfileRow icon="office-building-outline" label="Group Name" value={groupName} /><ProfileRow icon="identifier" label="Customer Code" value={context?.customer_code || '—'} /><ProfileRow icon="account-group-outline" label="Associated Customers" value={String(associatedCount)} /><ProfileRow icon="check-decagram-outline" label="Status" value={customer?.onboarding_status === 'active' ? 'Active' : customer?.onboarding_status || '—'} /><ProfileRow icon="map-marker-outline" label="Location" value={[customer?.city, customer?.state].filter(Boolean).join(', ') || '—'} /></View>
    <View style={styles.profileMenu}><MenuRow icon="account-multiple-outline" title="Associated Customers" onPress={() => router.push('/customer/group/accounts')} /><MenuRow icon="bell-outline" title="Notification Preferences" onPress={() => router.push('/customer/notifications')} /><MenuRow icon="headset" title="Support" onPress={() => router.push('/customer/support')} /></View>
  </Screen>;
}

function Field({ label, value, onChangeText, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'phone-pad' | 'email-address' }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'} style={styles.input} /></View>; }
function Review({ label, value }: { label: string; value: string }) { return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>; }
function ProfileRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) { return <View style={styles.profileRow}><View style={styles.profileRowIcon}><MaterialCommunityIcons name={icon} size={19} color="#0A43A3" /></View><View style={styles.profileRowCopy}><Text style={styles.profileRowLabel}>{label}</Text><Text style={styles.profileRowValue}>{value}</Text></View></View>; }
function MenuRow({ icon, title, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.menuRow}><View style={styles.profileRowIcon}><MaterialCommunityIcons name={icon} size={19} color="#0A43A3" /></View><Text style={styles.menuText}>{title}</Text><MaterialCommunityIcons name="chevron-right" size={22} color="#7A8799" /></Pressable>; }

const styles = StyleSheet.create({
  stepHeader: { marginBottom: 13 }, pageTitle: { color: palette.navy, fontSize: 21, fontWeight: '900' }, pageSub: { color: '#65758B', fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 3 }, stepTrack: { flexDirection: 'row', gap: 6, marginTop: 12 }, stepDot: { flex: 1, height: 4, borderRadius: 999, backgroundColor: '#DCE5EF' }, stepDotActive: { backgroundColor: '#0A43A3' }, section: { gap: 9 }, sectionTitle: { color: palette.navy, fontSize: 14.5, fontWeight: '900', marginTop: 4 }, sectionText: { color: '#65758B', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginBottom: 2 }, typeCard: { minHeight: 77, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }, typeCardSelected: { borderColor: '#0A43A3', backgroundColor: '#F5F9FF' }, typeIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, typeIconSelected: { backgroundColor: '#0A43A3' }, typeCopy: { flex: 1 }, typeTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, typeBody: { color: '#65758B', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 2 }, field: { marginBottom: 1 }, fieldLabel: { color: '#334155', fontSize: 10.5, fontWeight: '800', marginBottom: 5 }, input: { minHeight: 47, borderRadius: 13, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', paddingHorizontal: 12, color: palette.navy, fontSize: 13, fontWeight: '600' }, twoColumn: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 }, footerActions: { flexDirection: 'row', gap: 8, marginTop: 16 }, secondaryButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#C9D5E3', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: palette.navy, fontSize: 12, fontWeight: '900' }, primaryButton: { flex: 1.5, minHeight: 48, borderRadius: 13, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, reviewCard: { borderRadius: 17, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 13 }, reviewRow: { minHeight: 40, borderBottomWidth: 1, borderBottomColor: '#EEF2F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, reviewLabel: { color: '#65758B', fontSize: 10.5, fontWeight: '700' }, reviewValue: { flex: 1, textAlign: 'right', color: palette.navy, fontSize: 11.5, fontWeight: '900' }, infoCard: { borderRadius: 14, backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#CFE0F8', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, infoText: { flex: 1, color: '#315277', fontSize: 10.5, lineHeight: 15, fontWeight: '600' },
  profileHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }, signOut: { color: '#B42318', fontSize: 11, fontWeight: '900' }, profileHero: { minHeight: 112, borderRadius: 19, backgroundColor: palette.navy, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 14 }, profileAvatar: { width: 67, height: 67, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#D7E6FF' }, profileInitial: { color: palette.navy, fontSize: 27, fontWeight: '900' }, profileHeroCopy: { flex: 1 }, profileName: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' }, profileRole: { color: '#D7E6FF', fontSize: 10.5, fontWeight: '700', marginTop: 2 }, profileAccount: { color: '#F5C451', fontSize: 11, fontWeight: '900', marginTop: 6 }, profileCard: { borderRadius: 17, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingHorizontal: 12, marginTop: 7, marginBottom: 13 }, profileRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, profileRowIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, profileRowCopy: { flex: 1 }, profileRowLabel: { color: '#65758B', fontSize: 9.5, fontWeight: '700' }, profileRowValue: { color: palette.navy, fontSize: 12.5, fontWeight: '900', marginTop: 2 }, profileMenu: { borderRadius: 17, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingHorizontal: 12 }, menuRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, menuText: { flex: 1, color: palette.navy, fontSize: 12, fontWeight: '900' },
});