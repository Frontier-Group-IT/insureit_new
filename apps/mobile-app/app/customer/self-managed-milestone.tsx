import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ClaimChoice, ClaimContextStrip, ClaimFinancialSummary, ClaimFormSection, ClaimInlineNote, ClaimPrimaryAction, ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_MILESTONES, type ClaimMilestone, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { formatJourneyAmount, formatJourneyDate, stageBusinessDateOnly, stageMainAmount, validateStageChronology } from '@/lib/self-managed-claim-timeline';
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

type ClaimIdentity = { claim_no?: string | null; vehicle_id?: string | null };

export default function SelfManagedMilestoneScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const claimId = typeof params.id === 'string' ? params.id : '';
  const key = (typeof params.key === 'string' ? params.key : '') as ClaimMilestoneKey;
  const definition = SELF_MANAGED_MILESTONES.find((item) => item.key === key);
  const [values, setValues] = useState<Values>({});
  const [milestones, setMilestones] = useState<ClaimMilestone[]>([]);
  const [claimNo, setClaimNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!claimId || !definition) { if (active) setLoading(false); return; }
      const [milestoneResult, claimResult] = await Promise.all([
        (supabase as any).from('claim_milestones').select('*').eq('claim_id', claimId),
        supabase.from('claims').select('claim_no, vehicle_id').eq('id', claimId).maybeSingle(),
      ]);
      if (!active) return;
      const nextMilestones = (milestoneResult.data ?? []) as ClaimMilestone[];
      setMilestones(nextMilestones);
      const current = nextMilestones.find((item) => item.milestone_key === key);
      setValues(toFormValues(current?.details));
      const identity = (claimResult.data ?? {}) as ClaimIdentity;
      setClaimNo(identity.claim_no ?? '');
      if (identity.vehicle_id) {
        const vehicleResult = await supabase.from('vehicles').select('vehicle_no').eq('id', identity.vehicle_id).maybeSingle();
        if (active && vehicleResult.data) setVehicleNo((vehicleResult.data as any).vehicle_no ?? '');
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [claimId, definition, key]);

  const step = useMemo(() => Math.max(1, SELF_MANAGED_MILESTONES.findIndex((item) => item.key === key) + 1), [key]);
  const previousStage = step > 1 ? SELF_MANAGED_MILESTONES[step - 2] : null;
  const previousMilestone = previousStage ? milestones.find((item) => item.milestone_key === previousStage.key) : null;

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
      <ExternalClaimStageHeader
        step={step}
        title={definition.label}
        subtitle={subtitleFor(key)}
        vehicleNo={vehicleNo}
        claimNo={claimNo}
        onBack={() => router.back()}
      />

      <ClaimContextStrip
        previousLabel={previousStage?.label}
        previousValue={previousMilestone ? formatJourneyDate(previousMilestone) : 'Date not recorded'}
        amount={previousMilestone ? formatJourneyAmount(stageMainAmount(previousMilestone)) : null}
      />

      {message ? <Message type="error">{message}</Message> : null}

      {loading ? <Text style={styles.loading}>Loading saved details...</Text> : renderStage(key, values, set, milestones)}

      <ClaimPrimaryAction
        disabled={saving || loading}
        icon={key === 'payment_encashment' ? 'check-decagram-outline' : 'check'}
        label={saving ? 'Saving...' : key === 'payment_encashment' ? 'Complete Claim' : `Save ${definition.label}`}
        onPress={() => void save()}
      />
    </Screen>
  );
}

function renderStage(key: ClaimMilestoneKey, values: Values, set: (field: FieldKey, value: string) => void, milestones: ClaimMilestone[]) {
  if (key === 'claim_intimation') return <>
    <ClaimFormSection title="Claim registration" subtitle="Record when the insurer claim was intimated" icon="shield-edit-outline">
      <DateField label="Claim Intimation Date *" value={values.claim_intimation_date ?? ''} onChange={(v) => set('claim_intimation_date', v)} />
    </ClaimFormSection>
    <ClaimFormSection title="Workshop" subtitle="Where the vehicle was taken for repair" icon="garage-variant">
      <TextField label="Dealership Name *" value={values.dealership_name ?? ''} onChangeText={(v) => set('dealership_name', v)} />
      <Gap /><TextField label="Dealership Location *" value={values.dealership_location ?? ''} onChangeText={(v) => set('dealership_location', v)} />
      <Gap /><DateField label="Gate-in Date *" value={values.gate_in_date ?? ''} onChange={(v) => set('gate_in_date', v)} />
    </ClaimFormSection>
    <ClaimFormSection title="Estimate" subtitle="Initial repair estimate submitted for the claim" icon="cash-multiple">
      <MoneyField label="Estimate Amount *" value={values.estimate_amount ?? ''} onChange={(v) => set('estimate_amount', v)} />
    </ClaimFormSection>
  </>;

  if (key === 'work_approval') return <>
    <ClaimFormSection title="Approval" subtitle="Record insurer approval and settlement method" icon="check-decagram-outline">
      <DateField label="Approval Received Date *" value={values.approval_received_date ?? ''} onChange={(v) => set('approval_received_date', v)} />
      <Gap /><ClaimChoice label="Settlement Method *" value={values.cashless} options={[{ value: 'true', label: 'Cashless' }, { value: 'false', label: 'Reimbursement' }]} onChange={(v) => set('cashless', v)} />
    </ClaimFormSection>
    <ClaimFormSection title="Surveyor details" subtitle="Keep these for reference when available" optional icon="account-tie-outline">
      <TextField label="Surveyor Name (Optional)" value={values.surveyor_name ?? ''} onChangeText={(v) => set('surveyor_name', v)} />
      <Gap /><TextField label="Surveyor Phone (Optional)" value={values.surveyor_phone ?? ''} onChangeText={(v) => set('surveyor_phone', v)} keyboardType="phone-pad" />
      <Gap /><TextField label="Surveyor Email (Optional)" value={values.surveyor_email ?? ''} onChangeText={(v) => set('surveyor_email', v)} keyboardType="email-address" autoCapitalize="none" />
    </ClaimFormSection>
  </>;

  if (key === 'repair_ri') return <>
    <ClaimFormSection title="Repair" subtitle="Record when workshop repair work was completed" icon="wrench-outline">
      <DateField label="Repair Complete Date *" value={values.repair_complete_date ?? ''} onChange={(v) => set('repair_complete_date', v)} />
    </ClaimFormSection>
    <ClaimFormSection title="Re-inspection" subtitle="Record the RI request and completion dates" icon="clipboard-search-outline">
      <DateField label="RI Requested Date (Optional)" value={values.ri_requested_date ?? ''} onChange={(v) => set('ri_requested_date', v)} />
      <Gap /><DateField label="RI Done Date *" value={values.ri_done_date ?? ''} onChange={(v) => set('ri_done_date', v)} />
    </ClaimFormSection>
  </>;

  if (key === 'billing') return <ClaimFormSection title="Final workshop bill" subtitle="Record the final repair bill issued by the workshop" icon="receipt-text-outline">
    <DateField label="Bill Date *" value={values.bill_date ?? ''} onChange={(v) => set('bill_date', v)} />
    <Gap /><MoneyField label="Bill Amount *" value={values.bill_amount ?? ''} onChange={(v) => set('bill_amount', v)} />
  </ClaimFormSection>;

  if (key === 'delivery_order') {
    const bill = milestoneAmount(milestones, 'billing', 'bill_amount');
    const currentDo = numberValue(values.do_amount);
    const contribution = bill !== null && currentDo !== null ? Math.max(0, bill - currentDo) : null;
    return <>
      <ClaimFormSection title="Assessment" subtitle="Record whether the insurer assessment has been received" icon="clipboard-text-outline">
        <ClaimChoice label="Assessment Received?" value={values.assessment_received} options={[{ value: 'yes', label: 'Received' }, { value: 'no', label: 'Pending' }]} onChange={(v) => set('assessment_received', v)} />
      </ClaimFormSection>
      <ClaimFormSection title="Delivery order" subtitle="Record the DO date and approved amount" icon="file-check-outline">
        <DateField label="DO Date *" value={values.do_date ?? ''} onChange={(v) => set('do_date', v)} />
        <Gap /><MoneyField label="DO Amount *" value={values.do_amount ?? ''} onChange={(v) => set('do_amount', v)} />
        <ClaimFinancialSummary rows={[
          ...(bill !== null ? [{ label: 'Bill Amount', value: currency(bill) }] : []),
          ...(currentDo !== null ? [{ label: 'DO Amount', value: currency(currentDo) }] : []),
          ...(contribution !== null ? [{ label: 'Your Contribution', value: currency(contribution), emphasis: true }] : []),
        ]} />
      </ClaimFormSection>
    </>;
  }

  if (key === 'vehicle_delivery') return <ClaimFormSection title="Vehicle delivery" subtitle="Confirm whether the repaired vehicle has been received" icon="truck-check-outline">
    <ClaimChoice label="Vehicle Received? *" value={values.vehicle_received} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'Not Yet' }]} onChange={(v) => set('vehicle_received', v)} />
    {values.vehicle_received === 'yes' ? <><Gap /><DateField label="Vehicle Received Date *" value={values.vehicle_received_date ?? ''} onChange={(v) => set('vehicle_received_date', v)} /></> : <ClaimInlineNote tone="warning">This stage remains in progress until the vehicle is received and the received date is recorded.</ClaimInlineNote>}
  </ClaimFormSection>;

  if (key === 'payment_encashment') {
    const doAmount = milestoneAmount(milestones, 'delivery_order', 'do_amount');
    const received = numberValue(values.payment_received_amount);
    const deduction = doAmount !== null && received !== null ? Math.max(0, doAmount - received) : null;
    return <>
      <ClaimFormSection title="Settlement documents" subtitle="Track the documents required before final settlement" icon="file-document-check-outline">
        <ClaimChoice label="Depreciation Slip *" value={values.depreciation_submitted} options={[{ value: 'yes', label: 'Submitted' }, { value: 'no', label: 'Pending' }]} onChange={(v) => set('depreciation_submitted', v)} />
        <Gap /><ClaimChoice label="Satisfaction Voucher *" value={values.satisfaction_submitted} options={[{ value: 'yes', label: 'Submitted' }, { value: 'no', label: 'Pending' }]} onChange={(v) => set('satisfaction_submitted', v)} />
        <Gap /><DateField label="Documents Submit Date" value={values.documents_submit_date ?? ''} onChange={(v) => set('documents_submit_date', v)} />
      </ClaimFormSection>
      <ClaimFormSection title="Payment" subtitle="Record the final claim settlement received" icon="bank-transfer-in">
        <DateField label="Payment Received Date *" value={values.payment_received_date ?? ''} onChange={(v) => set('payment_received_date', v)} />
        <Gap /><MoneyField label="Amount Received *" value={values.payment_received_amount ?? ''} onChange={(v) => set('payment_received_amount', v)} />
        <ClaimFinancialSummary rows={[
          ...(doAmount !== null ? [{ label: 'DO Amount', value: currency(doAmount) }] : []),
          ...(received !== null ? [{ label: 'Amount Received', value: currency(received) }] : []),
          ...(deduction !== null ? [{ label: 'Further Deduction', value: currency(deduction), emphasis: true }] : []),
        ]} />
      </ClaimFormSection>
    </>;
  }

  return <ClaimInlineNote>This milestone is handled by its dedicated screen.</ClaimInlineNote>;
}

function validate(key: ClaimMilestoneKey, v: Values, milestones: ClaimMilestone[]) {
  const required: Partial<Record<ClaimMilestoneKey, FieldKey[]>> = {
    claim_intimation: ['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount'],
    work_approval: ['approval_received_date','cashless'],
    repair_ri: ['repair_complete_date','ri_done_date'],
    billing: ['bill_date','bill_amount'],
    delivery_order: ['do_date','do_amount'],
    vehicle_delivery: ['vehicle_received'],
    payment_encashment: ['depreciation_submitted','satisfaction_submitted','payment_received_date','payment_received_amount'],
  };
  for (const field of required[key] ?? []) if (!v[field]?.trim()) return 'Complete all mandatory fields.';
  if (key === 'repair_ri' && v.ri_requested_date && v.repair_complete_date && v.ri_requested_date < v.repair_complete_date) return 'RI Requested Date cannot be earlier than Repair Complete Date.';
  if (key === 'repair_ri' && v.ri_done_date && v.repair_complete_date && v.ri_done_date < v.repair_complete_date) return 'RI Done Date cannot be earlier than Repair Complete Date.';
  if (key === 'repair_ri' && v.ri_requested_date && v.ri_done_date && v.ri_done_date < v.ri_requested_date) return 'RI Done Date cannot be earlier than RI Requested Date.';
  if (key === 'vehicle_delivery' && v.vehicle_received === 'yes' && !v.vehicle_received_date) return 'Enter the vehicle received date.';
  if (key === 'vehicle_delivery' && v.vehicle_received === 'no') {
    const payment = milestones.find((item) => item.milestone_key === 'payment_encashment');
    if (payment && payment.milestone_status !== 'not_started') return 'Vehicle cannot be marked as not received after the Payment Encashment stage has been recorded.';
  }
  if (key === 'payment_encashment' && v.documents_submit_date && v.payment_received_date && v.payment_received_date < v.documents_submit_date) return 'Payment Received Date cannot be earlier than Documents Submit Date.';
  for (const field of ['estimate_amount','bill_amount','do_amount','payment_received_amount'] as FieldKey[]) if (v[field] && (!Number.isFinite(Number(v[field])) || Number(v[field]) < 0)) return 'Enter valid non-negative amounts.';
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
  if (key === 'repair_ri') return v.ri_done_date ?? v.repair_complete_date ?? null;
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
  if (key === 'repair_ri') result.ri_required = 'yes';
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
  if (key === 'claim_intimation') return 'Record insurer intimation, workshop details and estimate.';
  if (key === 'work_approval') return 'Record approval and how the claim will be settled.';
  if (key === 'repair_ri') return 'Track repair completion and re-inspection.';
  if (key === 'billing') return 'Record the final workshop bill.';
  if (key === 'delivery_order') return 'Record assessment and delivery order details.';
  if (key === 'vehicle_delivery') return 'Confirm when the repaired vehicle is actually received.';
  if (key === 'payment_encashment') return 'Record settlement documents and final payment.';
  return 'Update this claim milestone.';
}

function Gap() { return <View style={styles.gap} />; }
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <AppDatePicker label={label} value={value} onChange={onChange} maxDate={todayIso()} formatDisplay={formatDisplayDate} />; }
function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <View><TextField label={label} value={value} onChangeText={(v) => onChange(cleanMoney(v))} keyboardType="decimal-pad" />{value ? <Text style={styles.moneyPreview}>{currency(Number(value))}</Text> : null}</View>; }
function cleanMoney(value: string) { return value.replace(/[^0-9.]/g, ''); }
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDisplayDate(value: string) { if (!value) return ''; const [y,m,d] = value.split('-'); return `${d}-${m}-${y}`; }
function numberValue(value?: string) { if (!value) return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function milestoneAmount(milestones: ClaimMilestone[], key: ClaimMilestoneKey, field: string) { const milestone = milestones.find((item) => item.milestone_key === key); const value = milestone?.details?.[field]; return typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null; }
function currency(value: number) { return `₹${Math.round(value).toLocaleString('en-IN')}`; }

const styles = StyleSheet.create({
  loading: { color: '#7A8799', fontSize: 11, fontWeight: '600', padding: 16 },
  gap: { height: 10 },
  moneyPreview: { color: palette.navy, fontSize: 11.5, fontWeight: '900', marginTop: 6, textAlign: 'right' },
});