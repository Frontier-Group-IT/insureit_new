import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { appRoles, canManageUsers, designationOptions, roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
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

const emptyCustomerForm = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  company_name: '',
  assigned_agent_id: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
};

export default function ItUsersScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<EditableProfile[]>([]);
  const [selected, setSelected] = useState<EditableProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const managerOptions = useMemo(() => {
    return profiles
      .filter((item) => item.is_active && item.role !== 'customer' && item.id !== selected?.id)
      .map((item) => ({
        value: item.id,
        label: `${item.full_name} - ${roleLabels[item.role] ?? item.role}${item.employee_code ? ` (${item.employee_code})` : ''}`,
      }));
  }, [profiles, selected?.id]);

  const employeeRoleOptions = useMemo(() => appRoles.filter((item) => item !== 'customer').map((item) => ({ value: item, label: roleLabels[item] })), []);

  const roleFilterOptions = useMemo(() => appRoles.map((item) => ({ value: item, label: roleLabels[item] })), []);

  const agentOptions = useMemo(() => {
    return profiles
      .filter((item) => item.is_active && item.role === 'agent')
      .map((item) => ({
        value: item.id,
        label: `${item.full_name}${item.employee_code ? ` (${item.employee_code})` : ''}`,
      }));
  }, [profiles]);

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
    if (savingEmployee) return;
    setMessage('');
    if ((!selected && (!form.email || !form.password)) || !form.full_name || !appRoles.includes(form.role) || form.role === 'customer') {
      setMessage('Email, password, name, and valid employee role are required.');
      return;
    }
    setSavingEmployee(true);
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
    } finally {
      setSavingEmployee(false);
    }
  }

  async function saveCustomer() {
    if (savingCustomer) return;
    setMessage('');
    if (!customerForm.full_name || !customerForm.email || !customerForm.password || !customerForm.phone || !customerForm.assigned_agent_id) {
      setMessage('Customer name, email, password, phone, and assigned agent are required.');
      return;
    }
    setSavingCustomer(true);
    try {
      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          email: customerForm.email.trim(),
          password: customerForm.password,
          full_name: customerForm.full_name.trim(),
          role: 'customer',
          phone: nullable(customerForm.phone),
          reporting_manager_id: nullable(customerForm.assigned_agent_id),
          department: 'Customer',
          designation: 'Customer',
          email_confirm: true,
          customer: {
            contact_name: customerForm.full_name.trim(),
            company_name: nullable(customerForm.company_name),
            phone: nullable(customerForm.phone),
            email: customerForm.email.trim(),
            address: nullable(customerForm.address),
            city: nullable(customerForm.city),
            state: nullable(customerForm.state),
            postal_code: nullable(customerForm.postal_code),
            assigned_agent_id: nullable(customerForm.assigned_agent_id),
          },
        },
      });
      if (error) throw error;
      setMessage('Customer user created and linked to the selected agent.');
      setCustomerForm(emptyCustomerForm);
      await load();
    } catch (error) {
      console.error('IT customer save failed', { error, customerForm });
      setMessage('We could not create this customer user.');
    } finally {
      setSavingCustomer(false);
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
    <Screen title="Users" subtitle="Roles and reporting access." showLogout>
      {message ? <Message type={message.includes('could not') ? 'error' : 'success'}>{message}</Message> : null}
      <Card>
        <Text style={styles.sectionTitle}>{selected ? 'Edit user' : 'Create user'}</Text>
        <Text style={styles.helpText}>{selected ? 'Role and reporting details.' : 'Internal department profile.'}</Text>
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
          options={employeeRoleOptions}
          openSelect={openSelect}
          setOpenSelect={setOpenSelect}
          onChange={(value) => {
            const nextRole = value as AppRole;
            setForm((current) => ({
              ...current,
              role: nextRole,
              designation: shouldSyncDesignation(current.role, current.designation) ? roleLabels[nextRole] : current.designation,
            }));
          }}
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
        {savingEmployee ? <SavingPanel label={selected ? 'Saving employee profile' : 'Creating department user'} /> : null}
        <Button label={savingEmployee ? 'Processing...' : selected ? 'Save profile' : 'Create department user'} onPress={saveProfile} disabled={savingEmployee || savingCustomer} />
        {selected ? <Button label="Cancel edit" variant="secondary" onPress={() => { setSelected(null); setForm(emptyForm); }} disabled={savingEmployee} /> : null}
      </Card>

      {!selected ? (
        <Card>
          <Text style={styles.sectionTitle}>Add customer</Text>
          <Text style={styles.helpText}>Link the customer to an active agent.</Text>
          <TextField label="Customer name" value={customerForm.full_name} onChangeText={(value) => setCustomerForm((current) => ({ ...current, full_name: value }))} />
          <TextField label="Customer email" value={customerForm.email} onChangeText={(value) => setCustomerForm((current) => ({ ...current, email: value }))} autoCapitalize="none" />
          <TextField label="Temporary password" value={customerForm.password} onChangeText={(value) => setCustomerForm((current) => ({ ...current, password: value }))} secureTextEntry />
          <TextField label="Phone" value={customerForm.phone} onChangeText={(value) => setCustomerForm((current) => ({ ...current, phone: value }))} keyboardType="phone-pad" />
          <TextField label="Company name" value={customerForm.company_name} onChangeText={(value) => setCustomerForm((current) => ({ ...current, company_name: value }))} />
          <OptionSelect
            id="assigned_agent"
            label="Linked agent"
            value={customerForm.assigned_agent_id}
            options={agentOptions}
            placeholder={agentOptions.length ? 'Select agent' : 'No active agents available'}
            openSelect={openSelect}
            setOpenSelect={setOpenSelect}
            onChange={(value) => setCustomerForm((current) => ({ ...current, assigned_agent_id: value }))}
          />
          <TextField label="Address" value={customerForm.address} onChangeText={(value) => setCustomerForm((current) => ({ ...current, address: value }))} />
          <TextField label="City" value={customerForm.city} onChangeText={(value) => setCustomerForm((current) => ({ ...current, city: value }))} />
          <TextField label="State" value={customerForm.state} onChangeText={(value) => setCustomerForm((current) => ({ ...current, state: value }))} />
          <TextField label="Postal code" value={customerForm.postal_code} onChangeText={(value) => setCustomerForm((current) => ({ ...current, postal_code: value }))} keyboardType="number-pad" />
          {savingCustomer ? <SavingPanel label="Creating customer and linking agent" /> : null}
          <Button label={savingCustomer ? 'Processing...' : 'Create customer user'} onPress={saveCustomer} disabled={savingCustomer || savingEmployee || !agentOptions.length} />
        </Card>
      ) : null}
      <Card>
        <Text style={styles.sectionTitle}>Directory</Text>
        <TextField label="Search" value={search} onChangeText={setSearch} />
        <OptionSelect
          id="role_filter"
          label="Role filter"
          value={roleFilter}
          options={roleFilterOptions}
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

function shouldSyncDesignation(role: AppRole, designation: string) {
  return !designation || designation === roleLabels[role];
}

function SavingPanel({ label }: { label: string }) {
  return (
    <View style={styles.savingPanel}>
      <ActivityIndicator color="#18A058" />
      <View style={styles.savingCopy}>
        <Text style={styles.savingTitle}>{label}</Text>
        <Text style={styles.savingText}>Saving records.</Text>
      </View>
    </View>
  );
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
        <Text style={styles.selectChevron}>{isOpen ? '⌃' : '⌄'}</Text>
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
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginBottom: 5 },
  helpText: { color: palette.slate, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  savingPanel: { borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, borderWidth: 1, borderColor: '#BFEBD0', padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  savingCopy: { flex: 1 },
  savingTitle: { color: '#067647', fontSize: 14, fontWeight: '700' },
  savingText: { color: '#367A55', fontSize: 12, lineHeight: 17, marginTop: 2 },
  selectWrap: { marginBottom: 12 },
  selectLabel: { color: palette.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  selectButton: { minHeight: 50, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectButtonText: { color: palette.ink, flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  selectPlaceholder: { color: '#8A94A6' },
  selectChevron: { color: palette.emerald, fontSize: 17, fontWeight: '700' },
  optionsPanel: { borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, backgroundColor: palette.surface, marginTop: 6, overflow: 'hidden' },
  optionRow: { borderTopWidth: 1, borderTopColor: '#EEF2F6', paddingHorizontal: 12, paddingVertical: 11 },
  optionRowSelected: { backgroundColor: '#EAF8F0' },
  optionText: { color: palette.ink, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  userRow: { borderTopWidth: 1, borderTopColor: palette.line, paddingVertical: 12, gap: 10 },
  userText: { gap: 3 },
  userName: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  userMeta: { color: palette.slate, fontSize: 12, lineHeight: 17 },
  smallButton: { alignSelf: 'flex-start', borderRadius: radii.sm, borderWidth: 1, borderColor: palette.lineStrong, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
});
