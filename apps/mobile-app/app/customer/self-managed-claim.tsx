import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const { externalPolicyId, id } = useLocalSearchParams<{ externalPolicyId?: string; id?: string }>();
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
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const claimResult = id ? await supabase.from('claims').select('id,external_policy_id,accident_at,accident_location').eq('id', id).maybeSingle() : null;
      const policyId = id ? (claimResult?.data as { external_policy_id?: string | null } | null)?.external_policy_id : externalPolicyId;
      if (!policyId) { setMessage('Select a policy before starting a claim.'); setLoading(false); return; }
      const { data } = await (supabase as any).from('external_policies').select('*').eq('id', policyId).maybeSingle();
      if (!active) return;
      const next = data as ExternalPolicy | null;
      if (!next) { setMessage('This customer-added policy is not available.'); setLoading(false); return; }
      const result = await supabase.from('vehicles').select('*').eq('id', next.vehicle_id).maybeSingle();
      if (!active) return;
      if (claimResult?.error) { setMessage('We could not load this claim for editing.'); setLoading(false); return; }
      setPolicy(next);
      setVehicle(result.data ?? null);
      if (claimResult?.data) {
        const accident = claimResult.data.accident_at ? new Date(claimResult.data.accident_at) : null;
        if (accident && !Number.isNaN(accident.getTime())) {
          setDate(formatIsoDate(accident));
          setTime(`${String(accident.getHours()).padStart(2, '0')}:${String(accident.getMinutes()).padStart(2, '0')}`);
        }
        setLocation(claimResult.data.accident_location ?? '');
        const milestoneResult = await (supabase as any).from('claim_milestones').select('details').eq('claim_id', id).eq('milestone_key', 'spot_intimation').maybeSingle();
        const details = milestoneResult.data?.details as { driver_name?: string; driver_phone?: string } | null;
        setDriver(details?.driver_name ?? '');
        setPhone(details?.driver_phone ?? '');
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [externalPolicyId, id]);

  async function submit() {
    if (!policy || !vehicle || saving) return;
    setMessage('');
    const accidentAt = parseIncident(date, time);
    if (!accidentAt) return setMessage('Enter a valid accident date and time.');
    if (accidentAt.getTime() > Date.now()) return setMessage('Accident date and time cannot be in the future.');
    setSaving(true);
    const result = id
      ? await Promise.all([
        supabase.from('claims').update({ accident_at: accidentAt.toISOString(), accident_location: location.trim() || null }).eq('id', id),
        (supabase as any).from('claim_milestones').update({
          details: { accident_at: accidentAt.toISOString(), driver_name: driver.trim() || null, driver_phone: phone.trim() || null, location: location.trim() || null, external_policy_id: policy.id, policy_no: policy.policy_no, insurance_company_id: policy.insurance_company_id },
          completed_at: new Date().toISOString(),
        }).eq('claim_id', id).eq('milestone_key', 'spot_intimation'),
      ])
      : [await (supabase.rpc as any)('create_self_managed_external_claim', {
        p_customer_id: policy.customer_id,
        p_vehicle_id: policy.vehicle_id,
        p_external_policy_id: policy.id,
        p_accident_at: accidentAt.toISOString(),
        p_driver_name: driver.trim() || null,
        p_driver_phone: phone.trim() || null,
        p_location: location.trim() || null,
      })];
    setSaving(false);
    const error = result.find((item) => item.error)?.error;
    if (error) return setMessage(error.message || 'We could not save claim details.');
    if (id) { router.replace({ pathname: '/customer/claim-detail', params: { id } }); return; }
    const data = result[0].data;
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
        <Text style={styles.eyebrow}>{id ? 'EDIT STEP 1 OF 9' : 'STEP 1 OF 9'}</Text>
        <Text style={styles.pageTitle}>Spot Intimation</Text>
        <Text style={styles.pageSubtitle}>{id ? 'Review and update incident details' : 'Start tracking an incident'}</Text>
      </View>
      <AppBadge label="Self Tracked" tone="info" />
    </View>
    {message ? <Message type="error">{message}</Message> : null}
    {policy ? <Card style={styles.policyCard}>
      <View style={styles.policyTop}>
        <View style={styles.policyIcon}><MaterialCommunityIcons name="file-document-outline" size={20} color="#0A43A3" /></View>
        <View style={styles.policyCopy}>
          <Text style={styles.policyLabel}>EXTERNAL POLICY</Text>
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
      <TimePickerField value={time} onPress={() => setTimePickerOpen(true)} />
      <TextField label="Driver Name (Optional)" value={driver} onChangeText={setDriver} />
      <TextField label="Driver Number (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Location (Optional)" value={location} onChangeText={setLocation} />
    </Card>
    <Button label={saving ? id ? 'Saving changes...' : 'Starting claim...' : id ? 'Save Spot Intimation' : 'Start Claim'} onPress={submit} disabled={saving || !policy} />
    <TimePickerModal value={time} visible={timePickerOpen} onClose={() => setTimePickerOpen(false)} onSelect={(value) => { setTime(value); setTimePickerOpen(false); }} />
  </Screen>;
}

function formatIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function TimePickerField({ value, onPress }: { value: string; onPress: () => void }) {
  return <View style={styles.timeField}>
    <Text style={styles.timeLabel}>Accident Time *</Text>
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.timeButton}>
      <MaterialCommunityIcons name="clock-outline" size={19} color="#0A43A3" />
      <Text style={[styles.timeValue, !value && styles.timePlaceholder]}>{value || 'Select time'}</Text>
      <MaterialCommunityIcons name="chevron-down" size={21} color={palette.navy} />
    </Pressable>
  </View>;
}

function TimePickerModal({ value, visible, onClose, onSelect }: { value: string; visible: boolean; onClose: () => void; onSelect: (value: string) => void }) {
  const [hour, setHour] = useState(() => parseTime(value).hour);
  const [minute, setMinute] = useState(() => parseTime(value).minute);
  useEffect(() => {
    if (!visible) return;
    const parsed = parseTime(value);
    setHour(parsed.hour);
    setMinute(parsed.minute);
  }, [value, visible]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.timeModalBackdrop}>
      <View style={styles.timeModalCard}>
        <View style={styles.timeModalHeader}><View><Text style={styles.timeModalEyebrow}>INCIDENT DETAILS</Text><Text style={styles.timeModalTitle}>Select accident time</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={styles.timeClose}><MaterialCommunityIcons name="close" size={21} color={palette.navy} /></Pressable></View>
        <View style={styles.timeColumns}>
          <TimeColumn label="Hour" value={hour} options={Array.from({ length: 24 }, (_, index) => index)} onSelect={setHour} />
          <Text style={styles.timeColon}>:</Text>
          <TimeColumn label="Minute" value={minute} options={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]} onSelect={setMinute} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => onSelect(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)} style={styles.timeDone}><Text style={styles.timeDoneText}>Use this time</Text><MaterialCommunityIcons name="check" size={19} color="#FFFFFF" /></Pressable>
      </View>
    </View>
  </Modal>;
}

function TimeColumn({ label, value, options, onSelect }: { label: string; value: number; options: number[]; onSelect: (value: number) => void }) {
  return <View style={styles.timeColumn}><Text style={styles.timeColumnLabel}>{label}</Text><View style={styles.timeOptions}>{options.map((option) => <Pressable key={option} accessibilityRole="button" onPress={() => onSelect(option)} style={[styles.timeOption, option === value && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, option === value && styles.timeOptionTextSelected]}>{String(option).padStart(2, '0')}</Text></Pressable>)}</View></View>;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: new Date().getHours(), minute: Math.floor(new Date().getMinutes() / 5) * 5 };
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
  timeField: { gap: 5, marginBottom: 10 },
  timeLabel: { color: '#3F4D63', fontSize: 10.5, fontWeight: '700' },
  timeButton: { minHeight: 45, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  timePlaceholder: { color: '#8A94A6' },
  timeModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 28, 62, 0.38)' },
  timeModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  timeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  timeModalEyebrow: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  timeModalTitle: { color: palette.navy, fontSize: 19, fontWeight: '900', marginTop: 3 },
  timeClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  timeColumns: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 },
  timeColumn: { flex: 1, minWidth: 0 },
  timeColumnLabel: { color: '#667085', fontSize: 10, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  timeOption: { width: 48, height: 38, borderRadius: 10, backgroundColor: '#F5F8FC', alignItems: 'center', justifyContent: 'center' },
  timeOptionSelected: { backgroundColor: '#0A43A3' },
  timeOptionText: { color: '#56657A', fontSize: 12, fontWeight: '800' },
  timeOptionTextSelected: { color: '#FFFFFF' },
  timeColon: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 23 },
  timeDone: { minHeight: 48, marginTop: 18, borderRadius: 14, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
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
