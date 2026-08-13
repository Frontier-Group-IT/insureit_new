import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppDatePicker } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import type { Policy, Vehicle } from '@/lib/types';

type CustomerPolicy = Policy & { policy_service_source?: 'sibl' | 'external' | null };

export default function SelfManagedClaimScreen() {
  const router = useRouter();
  const { policyId } = useLocalSearchParams<{ policyId?: string }>();
  const [policy, setPolicy] = useState<CustomerPolicy | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [driver, setDriver] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!policyId) { setMessage('Select a policy before starting a claim.'); setLoading(false); return; }
      const { data } = await supabase.from('policies').select('*').eq('id', policyId).maybeSingle();
      if (!active) return;
      const next = data as CustomerPolicy | null;
      if (!next || next.policy_service_source !== 'external') { setMessage('This policy is not available for self-tracked claim processing.'); setLoading(false); return; }
      const result = await supabase.from('vehicles').select('*').eq('id', next.vehicle_id).maybeSingle();
      if (!active) return;
      setPolicy(next); setVehicle(result.data ?? null); setLoading(false);
    })();
    return () => { active = false; };
  }, [policyId]);

  async function submit() {
    if (!policy || !vehicle || saving) return;
    setMessage('');
    const accidentAt = parseIncident(date, time);
    if (!accidentAt) return setMessage('Enter a valid accident date and time.');
    if (accidentAt.getTime() > Date.now()) return setMessage('Accident date and time cannot be in the future.');
    setSaving(true);
    const { data, error } = await (supabase.rpc as any)('create_self_managed_customer_policy_claim', {
      p_customer_id: policy.customer_id,
      p_vehicle_id: policy.vehicle_id,
      p_policy_id: policy.id,
      p_accident_at: accidentAt.toISOString(),
      p_driver_name: driver.trim() || null,
      p_driver_phone: phone.trim() || null,
      p_location: location.trim() || null,
    });
    setSaving(false);
    if (error) return setMessage(error.message || 'We could not start claim tracking.');
    const created = Array.isArray(data) ? data[0] : data;
    if (created?.claim_id) router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: created.claim_id } });
    else setMessage('The claim was not created. Please try again.');
  }

  if (loading) return <Screen title="Spot Intimation"><LoadingState label="Opening policy" /></Screen>;
  return <Screen title="Spot Intimation" subtitle="Self-tracked claim • Step 1 of 9" showLogout>
    {message ? <Message type="error">{message}</Message> : null}
    {policy ? <Card title={policy.policy_no} subtitle={`${vehicle?.vehicle_no ?? 'Vehicle'} • Policy added by you`}><Message type="info">{SELF_MANAGED_CLAIM_NOTICE}</Message></Card> : null}
    <Card title="Accident details" subtitle="Date and time are required">
      <AppDatePicker label="Accident Date *" value={date} onChange={setDate} maxDate={new Date().toISOString().slice(0, 10)} />
      <View style={{ height: 10 }} />
      <TextField label="Accident Time *" placeholder="HH:MM" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
      <View style={{ height: 10 }} />
      <TextField label="Driver Name (Optional)" value={driver} onChangeText={setDriver} />
      <View style={{ height: 10 }} />
      <TextField label="Driver Number (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <View style={{ height: 10 }} />
      <TextField label="Location (Optional)" value={location} onChangeText={setLocation} />
    </Card>
    <Button label={saving ? 'Starting tracker...' : 'Start Self-Tracked Claim'} onPress={submit} disabled={saving || !policy} />
  </Screen>;
}

function parseIncident(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.trim().split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(value.getTime()) ? null : value;
}
