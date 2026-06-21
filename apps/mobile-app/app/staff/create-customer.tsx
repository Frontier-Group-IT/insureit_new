import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppSearchSelect, AppSectionHeader } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { canCreateCustomers } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Profile } from '@/lib/types';

type AgentOption = Pick<Profile, 'id' | 'full_name' | 'employee_code' | 'role' | 'is_active'>;

export default function StaffCreateCustomerScreen() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const profile = await getProfile(session.user.id);
      if (!isValidProfile(profile) || !canCreateCustomers(profile.role)) return router.replace('/access-denied');
      const { data, error } = await supabase.functions.invoke<{ assignable_agents: AgentOption[] }>('profile-context', { method: 'GET' });
      if (error) throw error;
      const nextAgents = data?.assignable_agents ?? [];
      setAgents(nextAgents);
      if (nextAgents.length === 1) setSelectedAgentId(nextAgents[0].id);
      setLoading(false);
    }
    void load();
  }, [router]);

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? null, [agents, selectedAgentId]);

  async function save() {
    setMessage('');
    setSuccess('');
    if (!fullName.trim() || !email.trim() || !password || !phone.trim() || !selectedAgentId) {
      setMessage('Customer name, email, password, phone, and assigned agent are required.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role: 'customer',
          phone: phone.trim(),
          reporting_manager_id: selectedAgentId,
          customer: {
            contact_name: fullName.trim(),
            company_name: nullable(companyName),
            phone: phone.trim(),
            email: email.trim(),
            address: nullable(address),
            city: nullable(city),
            state: nullable(state),
            postal_code: nullable(postalCode),
            assigned_agent_id: selectedAgentId,
          },
        },
      });
      if (error) throw error;
      setSuccess(`Customer created${data?.email ? `: ${data.email}` : ''}.`);
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setCompanyName('');
      setAddress('');
      setCity('');
      setState('');
      setPostalCode('');
    } catch (error) {
      console.error('Manager customer creation failed', error);
      setMessage('We could not create this customer. Please check the details and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title="Create Customer"><LoadingState label="Loading agents" /></Screen>;

  return (
    <Screen title="Create Customer" subtitle="Create login and customer profile.">
      {message ? <Message type="error">{message}</Message> : null}
      {success ? <Message type="success">{success}</Message> : null}
      <View style={styles.setupHero}>
        <View style={styles.setupIcon}>
          <MaterialCommunityIcons name="account-plus-outline" size={24} color={roleTheme.ops.accent} />
        </View>
        <View style={styles.setupCopy}>
          <Text style={styles.setupTitle}>Customer onboarding</Text>
          <Text style={styles.setupText}>Create the customer login, assign the serving agent, and save contact details in one pass.</Text>
        </View>
      </View>
      <Card>
        <AppSectionHeader title="Customer login" />
        <TextField label="Customer name" value={fullName} onChangeText={setFullName} />
        <TextField label="Customer email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Temporary password" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Card>
      <Card>
        <AppSectionHeader title="Assigned agent" />
        <AppSearchSelect
          label="Agent"
          placeholder="Search agent by name or code"
          options={agents}
          selectedId={selectedAgentId}
          onSelect={(agent) => setSelectedAgentId(agent.id)}
          getTitle={(agent) => agent.full_name}
          getSubtitle={(agent) => agent.employee_code ?? 'Agent'}
        />
        <Row label="Selected agent" value={selectedAgent?.full_name} />
      </Card>
      <Card>
        <AppSectionHeader title="Customer details" />
        <TextField label="Company name" value={companyName} onChangeText={setCompanyName} />
        <TextField label="Address" value={address} onChangeText={setAddress} />
        <TextField label="City" value={city} onChangeText={setCity} />
        <TextField label="State" value={state} onChangeText={setState} />
        <TextField label="Postal code" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />
        <Button label={saving ? 'Creating customer...' : 'Create customer'} onPress={save} disabled={saving || !agents.length} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  setupHero: { borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 13, shadowColor: palette.ink, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  setupIcon: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  setupCopy: { flex: 1, minWidth: 0 },
  setupTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', lineHeight: 23 },
  setupText: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 4 },
});

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
