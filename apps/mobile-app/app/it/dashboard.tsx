import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile, signOut } from '@/lib/auth';
import { appRoles, canManageUsers, roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { AppRole, Profile } from '@/lib/types';

type EditableProfile = Profile;

const emptyForm = {
  id: '',
  full_name: '',
  email: '',
  phone: '',
  employee_code: '',
  role: 'agent' as AppRole,
  reporting_manager_id: '',
  department: '',
  designation: '',
};

export default function ItDashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<EditableProfile[]>([]);
  const [selected, setSelected] = useState<EditableProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((item) => {
      const matchesSearch = !q || [item.full_name, item.email, item.phone, item.employee_code].some((value) => value?.toLowerCase().includes(q));
      const matchesRole = !roleFilter || item.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, roleFilter, search]);

  const load = useCallback(async function loadProfiles() {
    setLoading(true);
    setMessage('');
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextProfile = await getProfile(session.user.id);
      if (!isValidProfile(nextProfile) || !canManageUsers(nextProfile.role)) return router.replace('/access-denied');
      setProfile(nextProfile);
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      setProfiles(data ?? []);
    } catch (error) {
      console.error('IT dashboard load failed', error);
      setMessage('We could not load user records.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function pickUser(user: EditableProfile) {
    setSelected(user);
    setForm({
      id: user.id,
      full_name: user.full_name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      employee_code: user.employee_code ?? '',
      role: user.role,
      reporting_manager_id: user.reporting_manager_id ?? '',
      department: user.department ?? '',
      designation: user.designation ?? '',
    });
  }

  async function saveProfile() {
    setMessage('');
    if (!form.id || !form.full_name || !appRoles.includes(form.role)) {
      setMessage('Existing Auth user ID, name, and valid role are required.');
      return;
    }
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: nullable(form.email),
        phone: nullable(form.phone),
        employee_code: nullable(form.employee_code),
        role: form.role,
        reporting_manager_id: nullable(form.reporting_manager_id),
        department: nullable(form.department),
        designation: nullable(form.designation),
        updated_by: profile?.id ?? null,
      };
      const request = selected
        ? supabase.from('profiles').update(payload).eq('id', selected.id)
        : supabase.from('profiles').insert({ id: form.id.trim(), ...payload, is_active: true, created_by: profile?.id ?? null });
      const { error } = await request;
      if (error) throw error;
      setMessage(selected ? 'Profile updated.' : 'Profile record created.');
      setSelected(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      console.error('IT profile save failed', { error, form, selected });
      setMessage('We could not save this profile record.');
    }
  }

  async function toggleActive(user: EditableProfile) {
    setMessage('');
    try {
      const { error } = await supabase.from('profiles').update({ is_active: !user.is_active, updated_by: profile?.id ?? null }).eq('id', user.id);
      if (error) throw error;
      await load();
    } catch (error) {
      console.error('IT profile active toggle failed', { error, user });
      setMessage('We could not update user status.');
    }
  }

  if (loading) return <Screen title="IT Super User"><LoadingState /></Screen>;

  return (
    <Screen title="IT Super User" subtitle="Manage profile records and reporting hierarchy." showLogout>
      {message ? <Message type={message.includes('could not') ? 'error' : 'success'}>{message}</Message> : null}
      <Card>
        <Text style={styles.sectionTitle}>{selected ? 'Edit profile' : 'Create profile record'}</Text>
        <Text style={styles.helpText}>Use an existing Auth user ID. This screen does not create login accounts.</Text>
        <TextField label="Auth user ID" value={form.id} onChangeText={(value) => setForm((current) => ({ ...current, id: value }))} editable={!selected} />
        <TextField label="Full name" value={form.full_name} onChangeText={(value) => setForm((current) => ({ ...current, full_name: value }))} />
        <TextField label="Email" value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} autoCapitalize="none" />
        <TextField label="Phone" value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
        <TextField label="Employee code" value={form.employee_code} onChangeText={(value) => setForm((current) => ({ ...current, employee_code: value }))} />
        <TextField label="Role key" value={form.role} onChangeText={(value) => setForm((current) => ({ ...current, role: value as AppRole }))} autoCapitalize="none" />
        <TextField label="Reporting manager ID" value={form.reporting_manager_id} onChangeText={(value) => setForm((current) => ({ ...current, reporting_manager_id: value }))} />
        <TextField label="Department" value={form.department} onChangeText={(value) => setForm((current) => ({ ...current, department: value }))} />
        <TextField label="Designation" value={form.designation} onChangeText={(value) => setForm((current) => ({ ...current, designation: value }))} />
        <Button label={selected ? 'Save profile' : 'Create profile'} onPress={saveProfile} />
        {selected ? <Button label="Cancel edit" variant="secondary" onPress={() => { setSelected(null); setForm(emptyForm); }} /> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Organization users</Text>
        <TextField label="Search" value={search} onChangeText={setSearch} />
        <TextField label="Role filter key" value={roleFilter} onChangeText={setRoleFilter} autoCapitalize="none" />
        {filteredProfiles.map((user) => (
          <View key={user.id} style={styles.userRow}>
            <Pressable style={styles.userText} onPress={() => pickUser(user)}>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.userMeta}>{roleLabels[user.role]} · {user.employee_code ?? user.email ?? user.id}</Text>
              <Text style={styles.userMeta}>{user.is_active ? 'Active' : 'Inactive'} · Manager: {user.reporting_manager_id ?? 'None'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void toggleActive(user)} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>{user.is_active ? 'Deactivate' : 'Reactivate'}</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Button label="Sign out" variant="secondary" onPress={() => void signOut(router)} />
    </Screen>
  );
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const styles = StyleSheet.create({
  sectionTitle: { color: '#0B1F3A', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  helpText: { color: '#6B7280', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  userRow: { borderTopWidth: 1, borderTopColor: '#D8DEE8', paddingVertical: 12, gap: 10 },
  userText: { gap: 3 },
  userName: { color: '#0B1F3A', fontSize: 16, fontWeight: '900' },
  userMeta: { color: '#6B7280', fontSize: 12, lineHeight: 17 },
  smallButton: { alignSelf: 'flex-start', borderRadius: 12, borderWidth: 1, borderColor: '#0B1F3A', paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#0B1F3A', fontSize: 12, fontWeight: '800' },
});
