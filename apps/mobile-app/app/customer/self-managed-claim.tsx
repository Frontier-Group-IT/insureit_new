import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppDatePicker } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Vehicle } from '@/lib/types';

type ExternalPolicy = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
};

export default function SelfManagedClaimScreen() {
  const router = useRouter();
  const { externalPolicyId } = useLocalSearchParams<{ externalPolicyId?: string }>();
  const [policy, setPolicy] = useState<ExternalPolicy | null>(null);
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
      if (!externalPolicyId) { setMessage('Select a policy before starting a claim.'); setLoading(false); return; }
      const { data } = await (supabase as any).from('external_policies').select('*').eq('id', externalPolicyId).maybeSingle();
      if (!active) return;
      const next = data as ExternalPolicy | null;
      if (!next) { setMessage('This customer-added policy is not available.'); setLoading(false); return; }
      const result = await supabase.from('vehicles').select('*').eq('id', next.vehicle_id).maybeSingle();
      if (!active) return;
      setPolicy(next);
      setVehicle(result.data ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [externalPolicyId]);

  async function submit() {
    if (!policy || !vehicle || saving) return;
    setMessage('');
    const accidentAt = parseIncident(date, time);
    if (!accidentAt) return setMessage('Enter a valid accident date and time.');
    if (accidentAt.getTime() > Date.now()) return setMessage('Accident date and time cannot be in the future.');
    setSaving(true);
    const { data, error } = await (supabase.rpc as any)('create_self_managed_external_claim', {
      p_customer_id: policy.customer_id,
      p_vehicle_id: policy.vehicle_id,
      p_external_policy_id: policy.id,
      p_accident_at: accidentAt.toISOString(),
      p_driver_name: driver.trim() || null,
      p_driver_phone: phone.trim() || null,
      p_location: location.trim() || null,
    });
    setSaving(false);
    if (error) return setMessage(error.message || 'We could not start claim tracking.');
    const created = Array.isArray(data) ? data[0] : data;
    if (created?.claim_id) router.replace({ pathname: '/customer/claim-detail', params: { id: created.claim_id } });
    else setMessage('The claim was not created. Please try again.');
  }

  if (loading) return <Screen title="Spot Intimation"><LoadingState label="Opening policy" /></Screen>;
  return <Screen title="Spot Intimation" showTitleHeader={false}>
    <View style={styles.pageHeader}>
      <View style={styles.stepIcon}>
        <MaterialCommunityIcons name="car-emergency" size={22} color="#0A43A3" />
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>EXTERNAL CLAIM · STEP 1 OF 9</Text>
        <Text style={styles.pageTitle}>Spot Intimation</Text>
        <Text style={styles.pageSubtitle}>Start tracking an incident under your customer-added policy.</Text>
      </View>
      <AppBadge label="Self Tracked" tone="info" />
    </View>
    {message ? <Message type="error">{message}</Message> : null}
    {policy ? <Card style={styles.policyCard}>
      <View style={styles.policyTop}>
        <View style={styles.policyIcon}><MaterialCommunityIcons name="file-document-outline" size={20} color="#0A43A3" /></View>
        <View style={styles.policyCopy}>
          <Text style={styles.policyLabel}>CUSTOMER-ADDED POLICY</Text>
          <Text style={styles.policyNumber}>{policy.policy_no}</Text>
          <Text style={styles.policyVehicle}>{vehicle?.vehicle_no ?? 'Vehicle'}</Text>
        </View>
      </View>
      <View style={styles.noticeRow}>
        <MaterialCommunityIcons name="information-outline" size={18} color="#0A43A3" />
        <Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text>
      </View>
    </Card> : null}
    <Card style={styles.formCard}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}><MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#0A43A3" /></View>
        <View>
          <Text style={styles.sectionTitle}>Incident details</Text>
          <Text style={styles.sectionSubtitle}>Accident date and time are required</Text>
        </View>
      </View>
      <AppDatePicker label="Accident Date *" value={date} onChange={setDate} maxDate={new Date().toISOString().slice(0, 10)} />
      <TextField label="Accident Time *" placeholder="HH:MM" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
      <TextField label="Driver Name (Optional)" value={driver} onChangeText={setDriver} />
      <TextField label="Driver Number (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Location (Optional)" value={location} onChangeText={setLocation} />
    </Card>
    <Button label={saving ? 'Starting claim...' : 'Start Claim'} onPress={submit} disabled={saving || !policy} />
  </Screen>;
}

function parseIncident(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.trim().split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(value.getTime()) ? null : value;
}

const styles = StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  pageTitle: { color: palette.navy, fontSize: 22, fontWeight: '900', marginTop: 2 },
  pageSubtitle: { color: palette.slate, fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 3 },
  policyCard: { padding: 14, marginBottom: 10 },
  policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  policyLabel: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  policyNumber: { color: palette.navy, fontSize: 15, fontWeight: '900', marginTop: 2 },
  policyVehicle: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, borderTopColor: '#E7EEF7', marginTop: 12, paddingTop: 11 },
  noticeText: { flex: 1, color: '#4F6380', fontSize: 10.3, lineHeight: 15, fontWeight: '600' },
  formCard: { padding: 14, marginBottom: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { color: palette.slate, fontSize: 10, fontWeight: '600', marginTop: 2 },
});
