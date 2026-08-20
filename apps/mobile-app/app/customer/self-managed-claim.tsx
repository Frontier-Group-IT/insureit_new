import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ClaimActionBar, ClaimFormSection, ClaimStageSummaryCard, ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { type ClaimMilestone } from '@/lib/claim-service-mode';
import { detailRecord, stringValue, validateStageChronology } from '@/lib/self-managed-claim-timeline';
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

type TimeTarget = 'incident' | 'intimation' | null;

export default function SelfManagedClaimScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ externalPolicyId?: string; id?: string }>();
  const externalPolicyId = typeof params.externalPolicyId === 'string' ? params.externalPolicyId : '';
  const claimId = typeof params.id === 'string' ? params.id : '';
  const editing = Boolean(claimId);
  const [policy, setPolicy] = useState<ExternalPolicy | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [intimationDate, setIntimationDate] = useState('');
  const [intimationTime, setIntimationTime] = useState('');
  const [driver, setDriver] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timeTarget, setTimeTarget] = useState<TimeTarget>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (editing) {
        const [claimResult, milestoneResult] = await Promise.all([
          (supabase as any).from('claims').select('id,customer_id,vehicle_id,external_policy_id,accident_at,accident_location,claim_service_mode').eq('id', claimId).maybeSingle(),
          (supabase as any).from('claim_milestones').select('*').eq('claim_id', claimId),
        ]);
        if (!active) return;
        const claim = claimResult.data as any;
        if (!claim || claim.claim_service_mode !== 'self_managed' || !claim.external_policy_id) {
          setMessage('This external claim is not available for self-tracked editing.');
          setLoading(false);
          return;
        }
        const [policyResult, vehicleResult] = await Promise.all([
          (supabase as any).from('external_policies').select('*').eq('id', claim.external_policy_id).maybeSingle(),
          supabase.from('vehicles').select('*').eq('id', claim.vehicle_id).maybeSingle(),
        ]);
        if (!active) return;
        setPolicy(policyResult.data as ExternalPolicy | null);
        setVehicle(vehicleResult.data ?? null);
        const nextMilestones = (milestoneResult.data ?? []) as ClaimMilestone[];
        setMilestones(nextMilestones);
        const spot = nextMilestones.find((item) => item.milestone_key === 'spot_intimation');
        const details = detailRecord(spot?.details);
        const incident = claim.accident_at ? new Date(claim.accident_at) : null;
        if (incident && !Number.isNaN(incident.getTime())) {
          setIncidentDate(toLocalDate(incident));
          setIncidentTime(toLocalTime(incident));
        }
        const intimationAt = parseStoredDateTime(stringValue(details.spot_intimation_at));
        if (intimationAt) {
          setIntimationDate(toLocalDate(intimationAt));
          setIntimationTime(toLocalTime(intimationAt));
        }
        setDriver(stringValue(details.driver_name));
        setPhone(stringValue(details.driver_phone));
        setLocation(stringValue(details.location) || claim.accident_location || '');
        setLoading(false);
        return;
      }

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
  }, [claimId, editing, externalPolicyId]);

  async function submit() {
    if (!policy || !vehicle || saving) return;
    setMessage('');
    const incidentAt = parseDateTime(incidentDate, incidentTime);
    const spotIntimationAt = parseDateTime(intimationDate, intimationTime);
    if (!incidentAt) return setMessage('Enter a valid Incident Date and Time.');
    if (!spotIntimationAt) return setMessage('Enter a valid Spot Intimation Date and Time.');
    if (incidentAt.getTime() > Date.now()) return setMessage('Incident Date / Time cannot be in the future.');
    if (spotIntimationAt.getTime() > Date.now()) return setMessage('Spot Intimation Date / Time cannot be in the future.');
    if (spotIntimationAt.getTime() < incidentAt.getTime()) return setMessage('Spot Intimation Date / Time cannot be earlier than Incident Date / Time.');
    const chronology = validateStageChronology('spot_intimation', spotIntimationAt.toISOString(), milestones);
    if (chronology) return setMessage(chronology);

    setSaving(true);
    const details = {
      incident_at: incidentAt.toISOString(),
      spot_intimation_at: spotIntimationAt.toISOString(),
      driver_name: driver.trim() || null,
      driver_phone: phone.trim() || null,
      location: location.trim() || null,
    };

    if (editing) {
      const current = milestones.find((item) => item.milestone_key === 'spot_intimation');
      const session = await getCurrentSession();
      if (!session?.user) { setSaving(false); return router.replace('/login'); }
      const [claimUpdate, milestoneUpdate] = await Promise.all([
        (supabase as any).from('claims').update({ accident_at: incidentAt.toISOString(), accident_location: location.trim() || null }).eq('id', claimId),
        (supabase as any).from('claim_milestones').upsert({
          claim_id: claimId,
          milestone_key: 'spot_intimation',
          milestone_status: 'completed',
          details: { ...detailRecord(current?.details), ...details },
          completed_at: current?.completed_at ?? new Date().toISOString(),
          recorded_by: session.user.id,
          recorded_by_actor: 'customer',
        }, { onConflict: 'claim_id,milestone_key' }),
      ]);
      setSaving(false);
      if (claimUpdate.error || milestoneUpdate.error) return setMessage(claimUpdate.error?.message || milestoneUpdate.error?.message || 'We could not update Spot Intimation.');
      router.replace({ pathname: '/customer/self-managed-spot-status', params: { id: claimId } });
      return;
    }

    const { data, error } = await (supabase.rpc as any)('create_self_managed_external_claim', {
      p_customer_id: policy.customer_id,
      p_vehicle_id: policy.vehicle_id,
      p_external_policy_id: policy.id,
      p_accident_at: incidentAt.toISOString(),
      p_driver_name: driver.trim() || null,
      p_driver_phone: phone.trim() || null,
      p_location: location.trim() || null,
    });
    if (error) { setSaving(false); return setMessage(error.message || 'We could not start claim tracking.'); }
    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.claim_id) { setSaving(false); return setMessage('The claim was not created. Please try again.'); }

    const session = await getCurrentSession();
    const existingResult = await (supabase as any).from('claim_milestones').select('*').eq('claim_id', created.claim_id).eq('milestone_key', 'spot_intimation').maybeSingle();
    const existing = existingResult.data as ClaimMilestone | null;
    const milestoneResult = await (supabase as any).from('claim_milestones').upsert({
      claim_id: created.claim_id,
      milestone_key: 'spot_intimation',
      milestone_status: 'completed',
      details: { ...detailRecord(existing?.details), ...details },
      completed_at: existing?.completed_at ?? new Date().toISOString(),
      recorded_by: session?.user?.id ?? existing?.recorded_by ?? null,
      recorded_by_actor: 'customer',
    }, { onConflict: 'claim_id,milestone_key' });
    setSaving(false);
    if (milestoneResult.error) return setMessage('The claim was created, but the Spot Intimation event time could not be saved. Open the claim and update Spot Intimation before continuing.');
    router.replace({ pathname: '/customer/self-managed-spot-status', params: { id: created.claim_id } });
  }

  if (loading) return <Screen title="Spot Intimation"><LoadingState label={editing ? 'Opening Spot Intimation' : 'Opening policy'} /></Screen>;

  return (
    <Screen title="Spot Intimation" showTitleHeader={false}>
      <ExternalClaimStageHeader
        step={1}
        title="Spot Intimation"
        subtitle="Start tracking an incident."
        vehicleNo={vehicle?.vehicle_no}
        claimNo={editing ? 'Existing claim' : undefined}
        onBack={() => router.back()}
      />

      {policy ? <ClaimStageSummaryCard
        label="EXTERNAL POLICY"
        title={policy.policy_no}
        body={vehicle?.vehicle_no ?? 'Vehicle linked to this external policy'}
        icon="file-document-outline"
      /> : null}

      {message ? <Message type="error">{message}</Message> : null}

      <ClaimFormSection title="Incident Details" subtitle="Accident date, time and first insurer intimation" icon="clipboard-text-outline">
        <AppDatePicker label="Accident Date *" value={incidentDate} onChange={setIncidentDate} maxDate={todayIsoDate()} />
        <TimePickerField label="Accident Time *" value={incidentTime} onPress={() => setTimeTarget('incident')} />
        <View style={styles.subsection}><Text style={styles.subsectionTitle}>Spot Intimation</Text></View>
        <AppDatePicker label="Spot Intimation Date *" value={intimationDate} onChange={setIntimationDate} maxDate={todayIsoDate()} />
        <TimePickerField label="Spot Intimation Time *" value={intimationTime} onPress={() => setTimeTarget('intimation')} />
        <View style={styles.gap} />
        <TextField label="Driver Name (Optional)" value={driver} onChangeText={setDriver} />
        <View style={styles.gap} />
        <TextField label="Driver Number (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={styles.gap} />
        <TextField label="Location (Optional)" value={location} onChangeText={setLocation} />
      </ClaimFormSection>

      <View style={styles.voicePlaceholder}>
        <View style={styles.voiceIcon}><MaterialCommunityIcons name="microphone-outline" size={24} color="#0A43A3" /></View>
        <View style={{ flex: 1 }}><Text style={styles.voiceTitle}>Incident Voice Note</Text><Text style={styles.voiceText}>Voice recording UI will be enabled once the audio recording module is approved for the preview build.</Text></View>
      </View>

      <ClaimActionBar
        primaryDisabled={saving || !policy}
        primaryIcon="arrow-right"
        primaryLabel={saving ? 'Saving...' : editing ? 'Save & Continue' : 'Start Claim & Continue'}
        onPrimary={() => void submit()}
        onAssistance={() => editing ? router.push({ pathname: '/customer/request-claim-assistance', params: { id: claimId } }) : router.push('/customer/support')}
      />

      <TimePickerModal
        value={timeTarget === 'intimation' ? intimationTime : incidentTime}
        visible={timeTarget !== null}
        title={timeTarget === 'intimation' ? 'Select spot intimation time' : 'Select incident time'}
        onClose={() => setTimeTarget(null)}
        onSelect={(value) => {
          if (timeTarget === 'intimation') setIntimationTime(value); else setIncidentTime(value);
          setTimeTarget(null);
        }}
      />
    </Screen>
  );
}

function TimePickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.timeField}><Text style={styles.timeLabel}>{label}</Text><Pressable accessibilityRole="button" onPress={onPress} style={styles.timeButton}><MaterialCommunityIcons name="clock-outline" size={19} color="#0A43A3" /><Text style={[styles.timeValue, !value && styles.timePlaceholder]}>{value ? formatTime(value) : 'Select time'}</Text><MaterialCommunityIcons name="chevron-down" size={21} color={palette.navy} /></Pressable></View>;
}

function TimePickerModal({ value, visible, title, onClose, onSelect }: { value: string; visible: boolean; title: string; onClose: () => void; onSelect: (value: string) => void }) {
  const [hour, setHour] = useState(() => parseTime(value).hour);
  const [minute, setMinute] = useState(() => parseTime(value).minute);
  useEffect(() => { if (!visible) return; const parsed = parseTime(value); setHour(parsed.hour); setMinute(parsed.minute); }, [value, visible]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.timeModalBackdrop}><View style={styles.timeModalCard}><View style={styles.timeModalHeader}><View><Text style={styles.timeModalEyebrow}>CLAIM TIMELINE</Text><Text style={styles.timeModalTitle}>{title}</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={styles.timeClose}><MaterialCommunityIcons name="close" size={21} color={palette.navy} /></Pressable></View><View style={styles.timeColumns}><TimeColumn label="Hour" value={hour} options={Array.from({ length: 24 }, (_, index) => index)} onSelect={setHour} /><Text style={styles.timeColon}>:</Text><TimeColumn label="Minute" value={minute} options={[0,5,10,15,20,25,30,35,40,45,50,55]} onSelect={setMinute} /></View><Pressable accessibilityRole="button" onPress={() => onSelect(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)} style={styles.timeDone}><Text style={styles.timeDoneText}>Use this time</Text><MaterialCommunityIcons name="check" size={19} color="#FFFFFF" /></Pressable></View></View></Modal>;
}

function TimeColumn({ label, value, options, onSelect }: { label: string; value: number; options: number[]; onSelect: (value: number) => void }) {
  return <View style={styles.timeColumn}><Text style={styles.timeColumnLabel}>{label}</Text><View style={styles.timeOptions}>{options.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === value }} onPress={() => onSelect(option)} style={[styles.timeOption, option === value && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, option === value && styles.timeOptionTextSelected]}>{String(option).padStart(2, '0')}</Text></Pressable>)}</View></View>;
}

function parseTime(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: new Date().getHours(), minute: Math.floor(new Date().getMinutes() / 5) * 5 }; }
function parseDateTime(date: string, time: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null; const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.trim().split(':').map(Number); const value = new Date(year, month - 1, day, hour, minute); return Number.isNaN(value.getTime()) ? null : value; }
function parseStoredDateTime(value: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function toLocalDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function toLocalTime(value: Date) { return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`; }
function todayIsoDate() { return toLocalDate(new Date()); }
function formatTime(value: string) { const parsed = parseTime(value); const date = new Date(2000, 0, 1, parsed.hour, parsed.minute); return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }

const styles = StyleSheet.create({
  gap: { height: 10 },
  subsection: { marginTop: 16, marginBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E7EBF0' }, subsectionTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  voicePlaceholder: { borderRadius: 17, borderWidth: 1, borderColor: '#CADAF0', backgroundColor: '#F5F9FF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, voiceIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E6F0FF', alignItems: 'center', justifyContent: 'center' }, voiceTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' }, voiceText: { color: '#68778D', fontSize: 9.5, lineHeight: 14, fontWeight: '600', marginTop: 2 },
  timeField: { gap: 5, marginTop: 10 }, timeLabel: { color: '#3F4D63', fontSize: 11, fontWeight: '800' }, timeButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#D2DFEC', backgroundColor: '#FBFDFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, timeValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '800' }, timePlaceholder: { color: '#8A94A6' },
  timeModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 28, 62, 0.38)' }, timeModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 }, timeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }, timeModalEyebrow: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, timeModalTitle: { color: palette.navy, fontSize: 19, fontWeight: '900', marginTop: 3 }, timeClose: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, timeColumns: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 }, timeColumn: { flex: 1, minWidth: 0 }, timeColumnLabel: { color: '#667085', fontSize: 10, fontWeight: '800', textAlign: 'center', marginBottom: 6 }, timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }, timeOption: { width: 48, height: 40, borderRadius: 10, backgroundColor: '#F5F8FC', alignItems: 'center', justifyContent: 'center' }, timeOptionSelected: { backgroundColor: '#0A43A3' }, timeOptionText: { color: '#56657A', fontSize: 12, fontWeight: '800' }, timeOptionTextSelected: { color: '#FFFFFF' }, timeColon: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 23 }, timeDone: { minHeight: 50, marginTop: 18, borderRadius: 14, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, timeDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
