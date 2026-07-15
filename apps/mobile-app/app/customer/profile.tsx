import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { customerAccountTitle, membershipRoleLabel, partnerTypeLabel } from '@/lib/customer-context';
import { getCurrentSession, getProfile, signOut } from '@/lib/auth';
import { getSelectedCustomerRecord } from '@/lib/selected-customer';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { Customer, Profile } from '@/lib/types';
import type { CustomerAccountContext } from '@/lib/customer-context';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [context, setContext] = useState<CustomerAccountContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, selected] = await Promise.all([
          getProfile(session.user.id),
          getSelectedCustomerRecord(),
        ]);
        if (!active) return;
        setProfile(nextProfile);
        setCustomer(selected?.customer ?? null);
        setContext(selected?.context ?? null);
        setDraft({
          name: nextProfile?.full_name ?? '',
          phone: nextProfile?.phone ?? '',
          email: nextProfile?.email ?? '',
        });
      } catch (error) {
        console.warn('Profile load failed', error);
        if (active) setMessage('We could not load your profile.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  async function saveSignedInUser() {
    if (!profile || saving) return;
    setSaving(true);
    setMessage('');
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: draft.name.trim(),
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
      })
      .eq('id', profile.id)
      .select('*')
      .single();
    if (error) setMessage('Your personal contact details could not be saved.');
    else {
      setProfile(data);
      setEditing(false);
      setMessage('Personal contact details saved.');
    }
    setSaving(false);
  }

  if (loading) return <Screen title="Profile"><LoadingState /></Screen>;

  const accountName = context ? customerAccountTitle(context) : customer?.company_name || customer?.contact_name || 'No active account';
  const isInherited = context?.access_source === 'group_child';

  return (
    <Screen title="Profile" showTitleHeader={false}>
      <View style={styles.headingRow}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Pressable onPress={() => void signOut(router)}><Text style={styles.signOut}>Sign out</Text></Pressable>
      </View>

      {message ? <Message type={/saved/i.test(message) ? 'success' : 'error'}>{message}</Message> : null}

      <View style={styles.identityCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial(profile?.full_name)}</Text></View>
        <View style={styles.identityCopy}>
          <Text style={styles.userName}>{profile?.full_name || 'Signed-in user'}</Text>
          <Text style={styles.userMeta}>{profile?.phone || profile?.email || 'Customer login'}</Text>
          {context ? <Text style={styles.role}>{membershipRoleLabel(context.membership_role)}</Text> : null}
        </View>
      </View>

      <View style={styles.accountCard}>
        <View style={styles.accountTop}>
          <View style={styles.accountIcon}><MaterialCommunityIcons name={context?.partner_type === 'group' ? 'domain' : 'office-building-outline'} size={24} color={palette.navy} /></View>
          <View style={styles.accountCopy}>
            <Text style={styles.label}>ACTIVE ACCOUNT</Text>
            <Text style={styles.accountName}>{accountName}</Text>
            <Text style={styles.accountMeta}>{context ? `${partnerTypeLabel(context.partner_type)} · ${context.customer_code}` : 'No selected customer context'}</Text>
          </View>
        </View>
        {isInherited ? <View style={styles.notice}><MaterialCommunityIcons name="shield-lock-outline" size={18} color="#92400E" /><Text style={styles.noticeText}>You are viewing this child account through Group access. Account identity and customer contact fields are read-only here.</Text></View> : null}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Your personal contact details</Text>
          <Pressable onPress={() => setEditing((value) => !value)}><Text style={styles.editAction}>{editing ? 'Cancel' : 'Edit'}</Text></Pressable>
        </View>
        <Field label="Full name" value={draft.name} editable={editing} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} />
        <Field label="Mobile" value={draft.phone} editable={editing} onChangeText={(phone) => setDraft((current) => ({ ...current, phone }))} />
        <Field label="Email" value={draft.email} editable={editing} onChangeText={(email) => setDraft((current) => ({ ...current, email }))} />
        {editing ? <Pressable disabled={saving || !draft.name.trim()} onPress={() => void saveSignedInUser()} style={[styles.saveButton, (saving || !draft.name.trim()) && styles.saveDisabled]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save personal details'}</Text></Pressable> : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Account information</Text>
        <Info label="Account name" value={accountName} />
        <Info label="Customer code" value={context?.customer_code ?? customer?.customer_code ?? '—'} />
        <Info label="Partner type" value={context ? partnerTypeLabel(context.partner_type) : '—'} />
        <Info label="Account contact" value={customer?.contact_name ?? '—'} />
        <Info label="Company" value={customer?.company_name ?? '—'} />
        <Info label="Access source" value={isInherited ? `Group access${context?.group_name ? ` via ${context.group_name}` : ''}` : 'Direct membership'} />
      </View>
    </Screen>
  );
}

function Field({ label, value, editable, onChangeText }: { label: string; value: string; editable: boolean; onChangeText: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} editable={editable} onChangeText={onChangeText} style={[styles.input, !editable && styles.inputReadOnly]} /></View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>;
}

function initial(name?: string | null) { return (name?.trim()[0] || 'U').toUpperCase(); }

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageTitle: { color: palette.navy, fontSize: 22, fontWeight: '900' },
  signOut: { color: '#B42318', fontSize: 12, fontWeight: '800' },
  identityCard: { borderRadius: 18, backgroundColor: palette.navy, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.navy, fontSize: 22, fontWeight: '900' },
  identityCopy: { flex: 1 },
  userName: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  userMeta: { marginTop: 3, color: '#D8E6FA', fontSize: 11.5, fontWeight: '600' },
  role: { marginTop: 5, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 8, paddingVertical: 3, color: '#FFFFFF', fontSize: 9.5, fontWeight: '800' },
  accountCard: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5F0', backgroundColor: '#FFFFFF', padding: 13, marginBottom: 10 },
  accountTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  accountIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, minWidth: 0 },
  label: { color: palette.slate, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  accountName: { marginTop: 2, color: palette.ink, fontSize: 16, fontWeight: '900' },
  accountMeta: { marginTop: 2, color: palette.slate, fontSize: 10.5, fontWeight: '700' },
  notice: { marginTop: 11, borderRadius: 12, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', padding: 9, flexDirection: 'row', gap: 8 },
  noticeText: { flex: 1, color: '#92400E', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  panel: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5F0', backgroundColor: '#FFFFFF', padding: 13, marginBottom: 10 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { color: palette.ink, fontSize: 13, fontWeight: '900', marginBottom: 10 },
  editAction: { color: '#2563EB', fontSize: 11, fontWeight: '800' },
  field: { marginBottom: 9 },
  fieldLabel: { marginBottom: 4, color: palette.slate, fontSize: 9.5, fontWeight: '800' },
  input: { minHeight: 42, borderRadius: radii.sm, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 11, color: palette.ink, backgroundColor: '#FFFFFF', fontSize: 12 },
  inputReadOnly: { backgroundColor: '#F8FAFC', color: '#64748B' },
  saveButton: { minHeight: 44, borderRadius: 12, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  infoLabel: { color: palette.slate, fontSize: 10.5, fontWeight: '700' },
  infoValue: { flex: 1, color: palette.ink, fontSize: 10.5, fontWeight: '800', textAlign: 'right' },
});