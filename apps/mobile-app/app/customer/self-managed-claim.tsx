import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppDatePicker } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_CLAIM_NOTICE, type ClaimMilestone } from '@/lib/claim-service-mode';
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
      return router.replace({ pathname: '/customer/claim-detail', params: { id: claimId } });
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
    router.replace({ pathname: '/customer/claim-detail', params: { id: created.claim_id } });
  }

  if (loading) return <Screen title="Spot Intimation"><LoadingState label={editing ? 'Opening Spot Intimation' : 'Opening policy'} /></Screen>;
  return <Screen title="Spot Intimation" showTitleHeader={false}>
    <View style={styles.pageHeader}>
      <View style={styles.stepIcon}><MaterialCommunityIcons name="car-emergency" size={22} color="#0A43A3" /></View>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>STEP 1 OF 9</Text>
        <Text style={styles.pageTitle}>Spot Intimation</Text>
        <Text style={styles.pageSubtitle}>{editing ? 'Review the incident and insurer intimation timing' : 'Start tracking the incident and first insurer intimation'}</Text>
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
      <View style={styles.noticeRow}><MaterialCommunityIcons name="information-outline" size={18} color="#0A43A3" /><Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text></View>
    </Card> : null}

    <Card style={styles.formCard}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}><MaterialCommunityIcons name="car-clock" size={20} color="#0A43A3" /></View>
        <View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>Incident</Text><Text style={styles.sectionSubtitle}>When the accident actually happened</Text></View>
      </View>
      <AppDatePicker label="Incident Date *" value={incidentDate} onChange={setIncidentDate} maxDate={todayIsoDate()} />
      <TimePickerField label="Incident Time *" value={incidentTime} onPress={() => setTimeTarget('incident')} />
    </Card>

    <Card style={styles.formCard}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}><MaterialCommunityIcons name="shield-phone-outline" size={20} color="#0A43A3" /></View>
        <View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>Spot Intimation</Text><Text style={styles.sectionSubtitle}>When the insurer was first informed</Text></View>
      </View>
      <AppDatePicker label="Spot Intimation Date *" value={intimationDate} onChange={setIntimationDate} maxDate={todayIsoDate()} />
      <TimePickerField label="Spot Intimation Time *" value={intimationTime} onPress={() => setTimeTarget('intimation')} />
      <View style={styles.ruleRow}><MaterialCommunityIcons name="timeline-check-outline" size={17} color="#0A43A3" /><Text style={styles.ruleText}>Spot Intimation cannot be earlier than the incident or later than an already-recorded next stage.</Text></View>
    </Card>

    <Card style={styles.formCard}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}><MaterialCommunityIcons name="account-details-outline" size={20} color="#0A43A3" /></View>
        <View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>Incident context</Text><Text style={styles.sectionSubtitle}>Optional operational details</Text></View>
      </View>
      <TextField label="Driver Name (Optional)" value={driver} onChangeText={setDriver} />
      <TextField label="Driver Number (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextField label="Location (Optional)" value={location} onChangeText={setLocation} />
    </Card>
    <Button label={saving ? 'Saving...' : editing ? 'Save Spot Intimation' : 'Start Claim'} onPress={submit} disabled={saving || !policy} />
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
  </Screen>;
}

function TimePickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.timeField}>
    <Text style={styles.timeLabel}>{label}</Text>
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.timeButton}>
      <MaterialCommunityIcons name="clock-outline" size={19} color="#0A43A3" />
      <Text style={[styles.timeValue, !value && styles.timePlaceholder]}>{value ? formatTime(value) : 'Select time'}</Text>
      <MaterialCommunityIcons name="chevron-down" size={21} color={palette.navy} />
    </Pressable>
  </View>;
}

function TimePickerModal({ value, visible, title, onClose, onSelect }: { value: string; visible: boolean; title: string; onClose: () => void; onSelect: (value: string) => void }) {
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
        <View style={styles.timeModalHeader}><View><Text style={styles.timeModalEyebrow}>CLAIM TIMELINE</Text><Text style={styles.timeModalTitle}>{title}</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={styles.timeClose}><MaterialCommunityIcons name="close" size={21} color={palette.navy} /></Pressable></View>
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
function parseDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.trim().split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(value.getTime()) ? null : value;
}
function parseStoredDateTime(value: string) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function toLocalDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function toLocalTime(value: Date) { return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`; }
function todayIsoDate() { return toLocalDate(new Date()); }
function formatTime(value: string) { const parsed = parseTime(value); const date = new Date(2000, 0, 1, parsed.hour, parsed.minute); return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }

const styles = StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  pageTitle: { color: palette.navy, fontSize: 22, fontWeight: '900', marginTop: 2 },
  pageSubtitle: { color: palette.slate, fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 3 },
  timeField: { gap: 5, marginTop: 10 },
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
  sectionHeadingCopy: { flex: 1 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { color: palette.slate, fontSize: 10, fontWeight: '600', marginTop: 2 },
  ruleRow: { marginTop: 11, padding: 10, borderRadius: 12, backgroundColor: '#F6FAFF', flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  ruleText: { flex: 1, color: '#4F6380', fontSize: 9.8, lineHeight: 14, fontWeight: '700' },
});