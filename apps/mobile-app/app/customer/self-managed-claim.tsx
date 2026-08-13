import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

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
  const [insurer, setInsurer] = useState<InsuranceCompany | null>(null);
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      if (!externalPolicyId) {
        if (active) { setMessage('Select an external policy before starting a self-tracked claim.'); setLoading(false); }
        return;
      }
      const { data: nextPolicy, error } = await (supabase as any).from('external_policies').select('*').eq('id', externalPolicyId).maybeSingle();
      if (!active) return;
      if (error || !nextPolicy) {
        setMessage('This external policy is not available to your account.');
        setLoading(false);
        return;
      }
      const [vehicleResult, insurerResult] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', nextPolicy.vehicle_id).maybeSingle(),
        supabase.from('insurance_companies').select('*').eq('id', nextPolicy.insurance_company_id).maybeSingle(),
      ]);
      if (!active) return;
      setPolicy(nextPolicy as ExternalPolicy);
      setVehicle((vehicleResult.data ?? null) as Vehicle | null);
      setInsurer((insurerResult.data ?? null) as InsuranceCompany | null);
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [externalPolicyId, router]);

  async function submit() {
    setMessage('');
    if (!policy || !vehicle) return setMessage('External policy and vehicle details are required.');
    const incidentAt = buildIncidentDateTime(incidentDate, incidentTime);
    if (!incidentAt) return setMessage('Enter the accident date and time. Use HH:MM in 24-hour format.');
    if (incidentAt.getTime() > Date.now()) return setMessage('Accident date and time cannot be in the future.');

    setSubmitting(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const { data, error } = await (supabase.rpc as any)('create_self_managed_external_claim', {
        p_customer_id: policy.customer_id,
        p_vehicle_id: policy.vehicle_id,
        p_external_policy_id: policy.id,
        p_accident_at: incidentAt.toISOString(),
        p_driver_name: driverName.trim() || null,
        p_driver_phone: driverPhone.trim() || null,
        p_location: location.trim() || null,
      });
      if (error) {
        console.warn('External self-managed claim creation failed', error);
        setMessage(error.message || 'We could not start claim tracking. Please try again.');
        return;
      }
      const created = Array.isArray(data) ? data[0] : data;
      if (!created?.claim_id) return setMessage('The claim was not created. Please try again.');
      router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: created.claim_id } });
    } catch (error) {
      console.error('External self-managed claim submit failed', error);
      setMessage('We could not start claim tracking right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Screen title="Self-Tracked Claim"><LoadingState label="Opening external policy" /></Screen>;

  return (
    <Screen title="Self-Tracked Claim" showTitleHeader={false}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.topCopy}><Text style={styles.eyebrow}>EXTERNAL POLICY • STEP 1 OF 9</Text><Text style={styles.title}>Spot Intimation</Text><Text style={styles.subtitle}>The policy source is already verified as external. Record the accident details to start your tracker.</Text></View>
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      {policy ? <View style={styles.policyCard}>
        <View style={styles.policyTop}><View style={styles.policyIcon}><MaterialCommunityIcons name="shield-outline" size={24} color="#0A43A3" /></View><View style={styles.policyCopy}><Text style={styles.sourceBadge}>EXTERNAL POLICY</Text><Text style={styles.policyNo}>{policy.policy_no}</Text><Text style={styles.policyMeta}>{insurer?.name ?? 'Insurance company'} • {policy.policy_type}</Text></View></View>
        <View style={styles.divider} />
        <View style={styles.infoRow}><Info label="Vehicle" value={vehicle?.vehicle_no ?? '-'} /><Info label="Policy expiry" value={formatDate(policy.end_date)} /></View>
      </View> : null}

      <View style={styles.noticeBox}><MaterialCommunityIcons name="account-edit-outline" size={21} color="#8A5B00" /><Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text></View>

      <View style={styles.formCard}>
        <View style={styles.sectionTitleRow}><View style={styles.sectionIcon}><MaterialCommunityIcons name="car-emergency" size={19} color="#0A43A3" /></View><View><Text style={styles.sectionTitle}>Accident details</Text><Text style={styles.sectionSub}>Date and time are mandatory. Other details can be added later.</Text></View></View>
        <AppDatePicker label="Accident Date *" value={incidentDate} onChange={setIncidentDate} maxDate={todayIsoDate()} formatDisplay={formatDisplayDate} />
        <View style={styles.gap} /><TextField label="Accident Time *" placeholder="HH:MM (24-hour)" value={incidentTime} onChangeText={setIncidentTime} keyboardType="numbers-and-punctuation" />
        <View style={styles.gap} /><TextField label="Driver Name (Optional)" value={driverName} onChangeText={setDriverName} />
        <View style={styles.gap} /><TextField label="Driver Number (Optional)" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />
        <View style={styles.gap} /><TextField label="Location (Optional)" placeholder="Accident location or landmark" value={location} onChangeText={setLocation} />
      </View>

      <View style={styles.documentHint}><MaterialCommunityIcons name="file-multiple-outline" size={21} color="#0A43A3" /><View style={styles.documentCopy}><Text style={styles.documentTitle}>Documents can be added after creation</Text><Text style={styles.documentText}>RC, policy copy, driving licence and GR will belong to this external claim tracker and will not enter Sankalp policy-business records.</Text></View></View>

      <Pressable accessibilityRole="button" disabled={submitting || !policy} onPress={() => void submit()} style={[styles.submitButton, (submitting || !policy) && styles.submitDisabled]}><Text style={styles.submitText}>{submitting ? 'Starting tracker...' : 'Start Self-Tracked Claim'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={1}>{value}</Text></View>; }
function buildIncidentDateTime(dateValue: string, timeValue: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeValue.trim())) return null; const [year, month, day] = dateValue.split('-').map(Number); const [hour, minute] = timeValue.trim().split(':').map(Number); const value = new Date(year, month - 1, day, hour, minute, 0, 0); return Number.isNaN(value.getTime()) ? null : value; }
function todayIsoDate() { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y, m, d] = value.split('-'); return `${d}-${m}-${y}`; }
function formatDate(value?: string | null) { if (!value) return '-'; return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: -12, marginBottom: 16 }, backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, topCopy: { flex: 1 }, eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.9 }, title: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 2 }, subtitle: { color: '#667085', fontSize: 11.5, lineHeight: 17, fontWeight: '600', marginTop: 4 },
  policyCard: { borderRadius: 18, borderWidth: 1, borderColor: '#C9DCF7', backgroundColor: '#F7FAFF', padding: 13, marginBottom: 12 }, policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, policyIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, policyCopy: { flex: 1 }, sourceBadge: { alignSelf: 'flex-start', color: '#0A43A3', backgroundColor: '#EAF2FF', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 }, policyNo: { color: palette.navy, fontSize: 14.5, fontWeight: '900', marginTop: 4 }, policyMeta: { color: '#53647B', fontSize: 10.5, fontWeight: '700', marginTop: 2 }, divider: { height: 1, backgroundColor: '#DCE8F4', marginVertical: 10 }, infoRow: { flexDirection: 'row', gap: 10 }, info: { flex: 1 }, infoLabel: { color: '#7A8799', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' }, infoValue: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 2 },
  noticeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 15, borderWidth: 1, borderColor: '#F0D59B', backgroundColor: '#FFF8E8', padding: 12, marginBottom: 13 }, noticeText: { flex: 1, color: '#7A5409', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  formCard: { borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', padding: 14, marginBottom: 12 }, sectionTitleRow: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 13 }, sectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, sectionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' }, sectionSub: { color: '#7A8799', fontSize: 9.8, lineHeight: 13, fontWeight: '600', marginTop: 2, maxWidth: 330 }, gap: { height: 10 },
  documentHint: { flexDirection: 'row', gap: 9, borderRadius: 15, backgroundColor: '#F3F8FF', borderWidth: 1, borderColor: '#D4E2F7', padding: 12, marginBottom: 14 }, documentCopy: { flex: 1 }, documentTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, documentText: { color: '#667085', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  submitButton: { height: 52, borderRadius: 16, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }, submitDisabled: { opacity: 0.45 }, submitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
