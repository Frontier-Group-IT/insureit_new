import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile, signOut } from '@/lib/auth';
import { appRoles, canManageUsers, designationOptions, roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { AppRole, Profile } from '@/lib/types';

type EditableProfile = Profile;

const emptyForm = {
  id: '',
  full_name: '',
  email: '',
  password: '',
  phone: '',
  employee_code: '',
  role: 'agent' as AppRole,
  reporting_manager_id: '',
  department: '',
  designation: '',
};

export default function ItUsersScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<EditableProfile[]>([]);
  const [selected, setSelected] = useState<EditableProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const managerOptions = useMemo(() => {
    return profiles
      .filter((item) => item.is_active && item.id !== selected?.id)
      .map((item) => ({
        value: item.id,
        label: `${item.full_name} - ${roleLabels[item.role] ?? item.role}${item.employee_code ? ` (${item.employee_code})` : ''}`,
      }));
  }, [profiles, selected?.id]);

  const roleOptions = useMemo(() => appRoles.map((item) => ({ value: item, label: roleLabels[item] })), []);

  const designationSelectOptions = useMemo(() => designationOptions.map((item) => ({ value: item, label: item })), []);

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
      console.error('IT users load failed', error);
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
      password: '',
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
    if ((!selected && (!form.email || !form.password)) || !form.full_name || !appRoles.includes(form.role)) {
      setMessage('Email, password, name, and valid role are required.');
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
      const { error } = selected
        ? await supabase.from('profiles').update(payload).eq('id', selected.id)
        : await supabase.functions.invoke('create-user', {
            body: {
              email: form.email.trim(),
              password: form.password,
              full_name: form.full_name.trim(),
              role: form.role,
              phone: nullable(form.phone),
              employee_code: nullable(form.employee_code),
              reporting_manager_id: nullable(form.reporting_manager_id),
              department: nullable(form.department),
              designation: nullable(form.designation),
              email_confirm: true,
            },
          });
      if (error) throw error;
      setMessage(selected ? 'Profile updated.' : 'User created.');
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

  if (loading) return <Screen title="User Management"><LoadingState /></Screen>;

  return (
    <Screen title="User Management" subtitle="Create, edit, deactivate, and reactivate profiles." showLogout>
      {message ? <Message type={message.includes('could not') ? 'error' : 'success'}>{message}</Message> : null}
      <Card>
        <Text style={styles.sectionTitle}>{selected ? 'Edit Profile' : 'Create User'}</Text>
        <Text style={styles.helpText}>{selected ? 'Edit role and reporting hierarchy details.' : 'Create login access and a matching profile.'}</Text>
        {selected ? <TextField label="User ID" value={form.id} onChangeText={(value) => setForm((current) => ({ ...current, id: value }))} editable={false} /> : null}
        <TextField label="Full name" value={form.full_name} onChangeText={(value) => setForm((current) => ({ ...current, full_name: value }))} />
        <TextField label="Email" value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} autoCapitalize="none" />
        {!selected ? <TextField label="Temporary password" value={form.password} onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} secureTextEntry /> : null}
        <TextField label="Phone" value={form.phone} onChangeText={(value) => setForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
        <TextField label="Employee code" value={form.employee_code} onChangeText={(value) => setForm((current) => ({ ...current, employee_code: value }))} />
        <OptionSelect
          id="role"
          label="Role"
          value={form.role}
          options={roleOptions}
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={(value) => setForm((current) => ({ ...current, role: value as AppRole }))}
        />
        <OptionSelect
          id="reporting_manager"
          label="Reporting manager"
          value={form.reporting_manager_id}
          options={managerOptions}
          placeholder="No reporting manager"
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={(value) => setForm((current) => ({ ...current, reporting_manager_id: value }))}
        />
        <TextField label="Department" value={form.department} onChangeText={(value) => setForm((current) => ({ ...current, department: value }))} />
        <OptionSelect
          id="designation"
          label="Designation"
          value={form.designation}
          options={designationSelectOptions}
          placeholder="Select designation"
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={(value) => setForm((current) => ({ ...current, designation: value }))}
        />
        <Button label={selected ? 'Save profile' : 'Create user'} onPress={saveProfile} />
        {selected ? <Button label="Cancel edit" variant="secondary" onPress={() => { setSelected(null); setForm(emptyForm); }} /> : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Organization Users</Text>
        <TextField label="Search" value={search} onChangeText={setSearch} />
        <OptionSelect
          id="role_filter"
          label="Role filter"
          value={roleFilter}
          options={roleOptions}
          placeholder="All roles"
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={setRoleFilter}
        />
        {filteredProfiles.map((user) => (
          <View key={user.id} style={styles.userRow}>
            <Pressable style={styles.userText} onPress={() => pickUser(user)}>
              <Text style={styles.userName}>{user.full_name}</Text>
              <Text style={styles.userMeta}>{roleLabels[user.role]} | {user.employee_code ?? user.email ?? user.id}</Text>
              <Text style={styles.userMeta}>{user.is_active ? 'Active' : 'Inactive'} | Manager: {managerName(user.reporting_manager_id, profiles)}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void toggleActive(user)} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>{user.is_active ? 'Deactivate' : 'Reactivate'}</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Button label="Back to dashboard" variant="secondary" onPress={() => router.replace('/it/dashboard')} />
      <Button label="Sign out" variant="secondary" onPress={() => void signOut(router)} />
    </Screen>
  );
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function managerName(managerId: string | null, profiles: EditableProfile[]) {
  if (!managerId) return 'None';
  return profiles.find((item) => item.id === managerId)?.full_name ?? 'Linked manager';
}

function OptionSelect({
  id,
  label,
  value,
  options,
  placeholder = 'Select',
  openSelect,
  setOpenSelect,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  openSelect: string | null;
  setOpenSelect: (id: string | null) => void;
  onChange: (value: string) => void;
}) {
  const isOpen = openSelect === id;
  const selectedLabel = options.find((item) => item.value === value)?.label ?? placeholder;

  return (
    <View style={styles.selectWrap}>
      <Text style={styles.selectLabel}>{label}</Text>
      <Pressable accessibilityRole="button" style={styles.selectButton} onPress={() => setOpenSelect(isOpen ? null : id)}>
        <Text style={[styles.selectButtonText, !value && styles.selectPlaceholder]} numberOfLines={2}>{selectedLabel}</Text>
        <Text style={styles.selectChevron}>{isOpen ? 'Up' : 'Down'}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.optionsPanel}>
          <Pressable
            accessibilityRole="button"
            style={[styles.optionRow, !value && styles.optionRowSelected]}
            onPress={() => {
              onChange('');
              setOpenSelect(null);
            }}
          >
            <Text style={styles.optionText}>{placeholder}</Text>
          </Pressable>
          {options.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.value}
              style={[styles.optionRow, item.value === value && styles.optionRowSelected]}
              onPress={() => {
                onChange(item.value);
                setOpenSelect(null);
              }}
            >
              <Text style={styles.optionText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: '#0B1F3A', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  helpText: { color: '#6B7280', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  selectWrap: { marginBottom: 12 },
  selectLabel: { color: '#0B1F3A', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  selectButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#D8DEE8', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectButtonText: { color: '#0B1F3A', flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  selectPlaceholder: { color: '#8A94A6' },
  selectChevron: { color: '#18A058', fontSize: 12, fontWeight: '900' },
  optionsPanel: { borderWidth: 1, borderColor: '#D8DEE8', borderRadius: 14, backgroundColor: '#FFFFFF', marginTop: 6, overflow: 'hidden' },
  optionRow: { borderTopWidth: 1, borderTopColor: '#EEF2F6', paddingHorizontal: 12, paddingVertical: 11 },
  optionRowSelected: { backgroundColor: '#EAF8F0' },
  optionText: { color: '#0B1F3A', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  userRow: { borderTopWidth: 1, borderTopColor: '#D8DEE8', paddingVertical: 12, gap: 10 },
  userText: { gap: 3 },
  userName: { color: '#0B1F3A', fontSize: 16, fontWeight: '900' },
  userMeta: { color: '#6B7280', fontSize: 12, lineHeight: 17 },
  smallButton: { alignSelf: 'flex-start', borderRadius: 12, borderWidth: 1, borderColor: '#0B1F3A', paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#0B1F3A', fontSize: 12, fontWeight: '800' },
});
