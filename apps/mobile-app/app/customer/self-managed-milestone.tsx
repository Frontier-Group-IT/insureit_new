import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppDatePicker } from '@/components/design-system';
import { Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { stageBusinessDateOnly, validateStageChronology } from '@/lib/self-managed-claim-timeline';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type FieldKey =
  | 'dealership_name' | 'dealership_location' | 'claim_intimation_date' | 'gate_in_date' | 'estimate_amount'
  | 'approval_received_date' | 'cashless' | 'surveyor_name' | 'surveyor_phone' | 'surveyor_email'
  | 'repair_complete_date' | 'ri_required' | 'ri_requested_date' | 'ri_done_date'
  | 'bill_date' | 'bill_amount' | 'assessment_received' | 'do_date' | 'do_amount'
  | 'vehicle_received' | 'vehicle_received_date' | 'depreciation_submitted' | 'satisfaction_submitted'
  | 'documents_submit_date' | 'payment_received_date' | 'payment_received_amount';

type Values = Partial<Record<FieldKey, string>>;

export default function SelfManagedMilestoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const claimId = typeof params.id === 'string' ? params.id : '';
  const key = (typeof params.key === 'string' ? params.key : '') as ClaimMilestoneKey;
  const definition = SELF_MANAGED_MILESTONES.find((item) => item.key === key);
  const [values, setValues] = useState<Values>({});
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!claimId || !definition) { if (active) setLoading(false); return; }
      const { data } = await (supabase as any).from('claim_milestones').select('*').eq('claim_id', claimId);
      if (!active) return;
      const nextMilestones = (data ?? []) as ClaimMilestone[];
      setMilestones(nextMilestones);
      const current = nextMilestones.find((item) => item.milestone_key === key);
      setValues(toFormValues(current?.details));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [claimId, definition, key]);

  const step = useMemo(() => Math.max(1, SELF_MANAGED_MILESTONES.findIndex((item) => item.key === key) + 1), [key]);

  function set(field: FieldKey, value: string) { setValues((current) => ({ ...current, [field]: value })); }

  async function save() {
    setMessage('');
    if (!claimId || !definition) return setMessage('Claim milestone is unavailable.');
    const validation = validate(key, values, milestones);
    if (validation) return setMessage(validation);

    const details = normalizeDetails(key, values);
    const current = milestones.find((item) => item.milestone_key === key);
    setSaving(true);

    if (key === 'vehicle_delivery') {
      const session = await getCurrentSession();
      if (!session?.user) { setSaving(false); return router.replace('/login'); }
      const completed = values.vehicle_received === 'yes' && Boolean(values.vehicle_received_date);
      const { error } = await (supabase as any).from('claim_milestones').upsert({
        claim_id: claimId,
        milestone_key: key,
        milestone_status: completed ? 'completed' : 'in_progress',
        details,
        completed_at: completed ? (current?.completed_at ?? new Date().toISOString()) : null,
        recorded_by: session.user.id,
        recorded_by_actor: 'customer',
      }, { onConflict: 'claim_id,milestone_key' });
      setSaving(false);
      if (error) return setMessage(error.message || 'We could not save this milestone.');
      return router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: claimId } });
    }

    const { error } = await (supabase.rpc as any)('save_self_managed_milestone', {
      p_claim_id: claimId,
      p_milestone_key: key,
      p_details: details,
      p_completed_at: current?.completed_at ?? new Date().toISOString(),
    });
    setSaving(false);
    if (error) return setMessage(error.message || 'We could not save this milestone.');
    router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: claimId } });
  }

  if (!definition) return <Screen title="Claim Milestone" showTitleHeader={false}><Message type="error">This milestone is unavailable.</Message></Screen>;

  return (
    <Screen title={definition.label} showTitleHeader={false}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.eyebrow}>STEP {step} OF 9</Text>
          <Text style={styles.title}>{definition.label}</Text>
          <Text style={styles.subtitle}>{subtitleFor(key)}</Text>
        </View>
        <AppBadge label="Self Tracked" tone="info" />
      </View>

      <View style={styles.contextCard}>
        <View style={styles.contextIcon}><MaterialCommunityIcons name="shield-check-outline" size={22} color="#B7791F" /></View>
        <View style={styles.contextCopy}>
          <Text style={styles.contextLabel}>CLAIM UPDATE</Text>
          <Text style={styles.contextTitle}>{definition.label}</Text>
          <Text style={styles.contextBody}>Record the real claim-event date. Journey dates must remain in chronological order.</Text>
        </View>
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      {loading ? <Text style={styles.loading}>Loading saved details...</Text> : (
        <View style={styles.card}>
          <View style={styles.formHeading}>
            <View style={styles.formIcon}><MaterialCommunityIcons name="clipboard-edit-outline" size={20} color="#B7791F" /></View>
            <View style={styles.formHeadingCopy}><Text style={styles.formTitle}>Stage Details</Text><Text style={styles.formSub}>Use the date the event actually happened, not the date you entered it</Text></View>
          </View>
          {renderFields(key, values, set)}
        </View>
      )}

      <Pressable disabled={saving || loading} onPress={() => void save()} style={[styles.saveButton, (saving || loading) && styles.disabled]}><Text style={styles.saveText}>{saving ? 'Saving...' : `Save ${definition.label}`}</Text><MaterialCommunityIcons name="check" size={19} color="#FFFFFF" /></Pressable>
    </Screen>
  );
}

function renderFields(key: ClaimMilestoneKey, values: Values, set: (field: FieldKey, value: string) => void) {
  if (key === 'claim_intimation') return <>
    <DateField label="Claim Intimation Date *" value={values.claim_intimation_date ?? ''} onChange={(v) => set('claim_intimation_date', v)} />
    <Gap /><TextField label="Dealership Name *" value={values.dealership_name ?? ''} onChangeText={(v) => set('dealership_name', v)} />
    <Gap /><TextField label="Dealership Location *" value={values.dealership_location ?? ''} onChangeText={(v) => set('dealership_location', v)} />
    <Gap /><DateField label="Gate-in Date *" value={values.gate_in_date ?? ''} onChange={(v) => set('gate_in_date', v)} />
    <Gap /><TextField label="Estimate Amount *" value={values.estimate_amount ?? ''} onChangeText={(v) => set('estimate_amount', cleanMoney(v))} keyboardType="decimal-pad" />
  </>;
  if (key === 'work_approval') return <>
    <DateField label="Approval Received Date *" value={values.approval_received_date ?? ''} onChange={(v) => set('approval_received_date', v)} />
    <Gap /><Choice label="Cashless Claim *" value={values.cashless} options={[['true','Yes'],['false','No']]} onChange={(v) => set('cashless', v)} />
    <Gap /><TextField label="Surveyor Name (Optional)" value={values.surveyor_name ?? ''} onChangeText={(v) => set('surveyor_name', v)} />
    <Gap /><TextField label="Surveyor Phone (Optional)" value={values.surveyor_phone ?? ''} onChangeText={(v) => set('surveyor_phone', v)} keyboardType="phone-pad" />
    <Gap /><TextField label="Surveyor Email (Optional)" value={values.surveyor_email ?? ''} onChangeText={(v) => set('surveyor_email', v)} keyboardType="email-address" />
  </>;
  if (key === 'repair_ri') return <>
    <DateField label="Repair Complete Date *" value={values.repair_complete_date ?? ''} onChange={(v) => set('repair_complete_date', v)} />
    <Gap /><Choice label="Was Re-inspection Required? *" value={values.ri_required} options={[['yes','Yes'],['no','No'],['not_sure','Not sure']]} onChange={(v) => set('ri_required', v)} />
    {values.ri_required === 'yes' ? <><Gap /><DateField label="RI Requested Date (Optional)" value={values.ri_requested_date ?? ''} onChange={(v) => set('ri_requested_date', v)} /><Gap /><DateField label="RI Done Date *" value={values.ri_done_date ?? ''} onChange={(v) => set('ri_done_date', v)} /></> : null}
  </>;
  if (key === 'billing') return <>
    <DateField label="Bill Date *" value={values.bill_date ?? ''} onChange={(v) => set('bill_date', v)} />
    <Gap /><TextField label="Bill Amount *" value={values.bill_amount ?? ''} onChangeText={(v) => set('bill_amount', cleanMoney(v))} keyboardType="decimal-pad" />
  </>;
  if (key === 'delivery_order') return <>
    <Choice label="Assessment Received?" value={values.assessment_received} options={[['yes','Yes'],['no','No']]} onChange={(v) => set('assessment_received', v)} />
    <Gap /><DateField label="DO Date *" value={values.do_date ?? ''} onChange={(v) => set('do_date', v)} />
    <Gap /><TextField label="DO Amount *" value={values.do_amount ?? ''} onChangeText={(v) => set('do_amount', cleanMoney(v))} keyboardType="decimal-pad" />
    <Info text="Customer contribution is calculated automatically as Bill Amount − DO Amount." />
  </>;
  if (key === 'vehicle_delivery') return <>
    <Choice label="Vehicle Received? *" value={values.vehicle_received} options={[['yes','Yes'],['no','No']]} onChange={(v) => set('vehicle_received', v)} />
    {values.vehicle_received === 'yes' ? <><Gap /><DateField label="Vehicle Received Date *" value={values.vehicle_received_date ?? ''} onChange={(v) => set('vehicle_received_date', v)} /></> : <Info text="This stage remains in progress until the vehicle is received and the received date is recorded." />}
  </>;
  if (key === 'payment_encashment') return <>
    <Choice label="Depreciation Slip Submitted? *" value={values.depreciation_submitted} options={[['yes','Yes'],['no','No']]} onChange={(v) => set('depreciation_submitted', v)} />
    <Gap /><Choice label="Satisfaction Voucher Submitted? *" value={values.satisfaction_submitted} options={[['yes','Yes'],['no','No']]} onChange={(v) => set('satisfaction_submitted', v)} />
    <Gap /><DateField label="Documents Submit Date" value={values.documents_submit_date ?? ''} onChange={(v) => set('documents_submit_date', v)} />
    <Gap /><DateField label="Payment Received Date *" value={values.payment_received_date ?? ''} onChange={(v) => set('payment_received_date', v)} />
    <Gap /><TextField label="Amount Received *" value={values.payment_received_amount ?? ''} onChangeText={(v) => set('payment_received_amount', cleanMoney(v))} keyboardType="decimal-pad" />
    <Info text="Further deduction is calculated automatically as DO Amount − Amount Received." />
  </>;
  return <Info text="This milestone is handled by its dedicated screen." />;
}

function validate(key: ClaimMilestoneKey, v: Values, milestones: ClaimMilestone[]) {
  const required: Partial<Record<ClaimMilestoneKey, FieldKey[]>> = {
    claim_intimation: ['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount'],
    work_approval: ['approval_received_date','cashless'],
    repair_ri: ['repair_complete_date','ri_required'],
    billing: ['bill_date','bill_amount'],
    delivery_order: ['do_date','do_amount'],
    vehicle_delivery: ['vehicle_received'],
    payment_encashment: ['depreciation_submitted','satisfaction_submitted','payment_received_date','payment_received_amount'],
  };
  for (const field of required[key] ?? []) if (!v[field]?.trim()) return 'Complete all mandatory fields.';
  if (key === 'repair_ri' && v.ri_required === 'yes' && !v.ri_done_date) return 'Enter the RI done date.';
  if (key === 'repair_ri' && v.ri_requested_date && v.repair_complete_date && v.ri_requested_date < v.repair_complete_date) return 'RI Requested Date cannot be earlier than Repair Complete Date.';
  if (key === 'repair_ri' && v.ri_done_date && v.repair_complete_date && v.ri_done_date < v.repair_complete_date) return 'RI Done Date cannot be earlier than Repair Complete Date.';
  if (key === 'repair_ri' && v.ri_requested_date && v.ri_done_date && v.ri_done_date < v.ri_requested_date) return 'RI Done Date cannot be earlier than RI Requested Date.';
  if (key === 'vehicle_delivery' && v.vehicle_received === 'yes' && !v.vehicle_received_date) return 'Enter the vehicle received date.';
  if (key === 'vehicle_delivery' && v.vehicle_received === 'no') {
    const payment = milestones.find((item) => item.milestone_key === 'payment_encashment');
    if (payment && payment.milestone_status !== 'not_started') return 'Vehicle cannot be marked as not received after the Payment Encashment stage has been recorded.';
  }
  if (key === 'payment_encashment' && v.documents_submit_date && v.payment_received_date && v.payment_received_date < v.documents_submit_date) return 'Payment Received Date cannot be earlier than Documents Submit Date.';
  for (const field of ['estimate_amount','bill_amount','do_amount','payment_received_amount'] as FieldKey[]) {
    if (v[field] && (!Number.isFinite(Number(v[field])) || Number(v[field]) < 0)) return 'Enter valid non-negative amounts.';
  }
  const chronology = validateStageChronology(key, effectiveDateFor(key, v), milestones);
  if (chronology) return chronology;
  if (key === 'payment_encashment' && v.documents_submit_date) {
    const previous = milestones.find((item) => item.milestone_key === 'vehicle_delivery');
    const previousDate = stageBusinessDateOnly(previous);
    if (previousDate && v.documents_submit_date < previousDate) return 'Documents Submit Date cannot be earlier than Vehicle Delivery.';
  }
  return '';
}

function effectiveDateFor(key: ClaimMilestoneKey, v: Values): string | null {
  if (key === 'claim_intimation') return v.claim_intimation_date ?? null;
  if (key === 'work_approval') return v.approval_received_date ?? null;
  if (key === 'repair_ri') return v.ri_required === 'yes' ? (v.ri_done_date ?? null) : (v.repair_complete_date ?? null);
  if (key === 'billing') return v.bill_date ?? null;
  if (key === 'delivery_order') return v.do_date ?? null;
  if (key === 'vehicle_delivery') return v.vehicle_received === 'yes' ? (v.vehicle_received_date ?? null) : null;
  if (key === 'payment_encashment') return v.payment_received_date ?? null;
  return null;
}

function normalizeDetails(key: ClaimMilestoneKey, v: Values) {
  const result: Record<string, string | number | boolean | null> = {};
  Object.entries(v).forEach(([field, value]) => { if (value === undefined || value === '') return; result[field] = value; });
  for (const field of ['estimate_amount','bill_amount','do_amount','payment_received_amount']) if (result[field] !== undefined) result[field] = Number(result[field]);
  if (key === 'work_approval' && result.cashless !== undefined) result.cashless = result.cashless === 'true';
  return result;
}

function toFormValues(details: Record<string, unknown> | null | undefined): Values {
  if (!details) return {};
  const next: Values = {};
  Object.entries(details).forEach(([field, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'boolean') next[field as FieldKey] = value ? 'true' : 'false';
    else next[field as FieldKey] = String(value);
  });
  return next;
}

function subtitleFor(key: ClaimMilestoneKey) {
  if (key === 'claim_intimation') return 'Record the insurer intimation date, dealership and estimate.';
  if (key === 'work_approval') return 'Record insurer approval and cashless status.';
  if (key === 'repair_ri') return 'Track repair completion and re-inspection only when applicable.';
  if (key === 'billing') return 'Record the final workshop bill.';
  if (key === 'delivery_order') return 'Record delivery order and assessment details.';
  if (key === 'vehicle_delivery') return 'Confirm when the repaired vehicle is actually received.';
  if (key === 'payment_encashment') return 'Record final documents and settlement payment.';
  return 'Update this claim milestone.';
}
function Gap() { return <View style={{ height: 12 }} />; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <AppDatePicker label={label} value={value} onChange={onChange} maxDate={todayIso()} formatDisplay={formatDisplayDate} />; }
function Choice({ label, value, options, onChange }: { label: string; value?: string; options: [string,string][]; onChange: (value: string) => void }) { return <View><Text style={styles.choiceLabel}>{label}</Text><View style={styles.choiceRow}>{options.map(([id,text]) => <Pressable key={id} onPress={() => onChange(id)} style={[styles.choiceChip, value === id && styles.choiceChipActive]}><Text style={[styles.choiceText, value === id && styles.choiceTextActive]}>{text}</Text></Pressable>)}</View></View>; }
function Info({ text }: { text: string }) { return <View style={styles.info}><MaterialCommunityIcons name="information-outline" size={17} color="#B7791F" /><Text style={styles.infoText}>{text}</Text></View>; }
function cleanMoney(value: string) { return value.replace(/[^0-9.]/g, ''); }
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y,m,d] = value.split('-'); return `${d}-${m}-${y}`; }

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginTop: 0, marginBottom: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  topCopy: { flex: 1 },
  eyebrow: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  title: { color: palette.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#7A8799', fontSize: 10.3, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  contextCard: { borderWidth: 1, borderColor: '#C9DAF2', borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F7FAFF', marginBottom: 10 },
  contextIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  contextTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', marginTop: 2 },
  contextBody: { color: '#667085', fontSize: 10.3, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  card: { borderRadius: 17, padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE6F0' },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  formIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF4E2', alignItems: 'center', justifyContent: 'center' },
  formHeadingCopy: { flex: 1 },
  formTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  formSub: { color: '#7A8799', fontSize: 9.8, fontWeight: '600', marginTop: 2 },
  loading: { color: '#7A8799', fontSize: 10.5, fontWeight: '600', padding: 16 },
  saveButton: { marginTop: 12, minHeight: 48, borderRadius: 15, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  choiceLabel: { color: '#344054', fontSize: 11, fontWeight: '800', marginBottom: 8 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: '#DCE6F0', backgroundColor: '#FFFFFF', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  choiceChipActive: { backgroundColor: '#FFF4E2', borderColor: '#B7791F' },
  choiceText: { color: '#667085', fontSize: 11, fontWeight: '800' },
  choiceTextActive: { color: '#8A5B00' },
  info: { marginTop: 12, padding: 11, borderRadius: 13, flexDirection: 'row', gap: 8, backgroundColor: '#FFFBF3', borderWidth: 1, borderColor: '#F0D9AC' },
  infoText: { flex: 1, color: '#77520B', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
});