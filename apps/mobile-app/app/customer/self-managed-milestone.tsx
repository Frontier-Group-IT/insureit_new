import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimDocumentTabs } from '@/components/external-claim-document-tabs';
import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { ClaimActionBar, ClaimChoice, ClaimFinancialSummary, ClaimFormSection, ClaimInlineNote, ClaimStageSummaryCard, ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { Screen, TextField } from '@/components/ui';
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
type ClaimIdentity = { claim_no?: string | null; vehicle_id?: string | null; customer_id?: string | null };

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
  const [customerId, setCustomerId] = useState('');
  const [message, setMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [definitionErrorVisible, setDefinitionErrorVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!claimId || !definition) { if (active) setLoading(false); return; }
      const [milestoneResult, claimResult] = await Promise.all([
        (supabase as any).from('claim_milestones').select('*').eq('claim_id', claimId),
        supabase.from('claims').select('claim_no, vehicle_id, customer_id').eq('id', claimId).maybeSingle(),
      ]);
      if (!active) return;
      const nextMilestones = (milestoneResult.data ?? []) as ClaimMilestone[];
      setMilestones(nextMilestones);
      const current = nextMilestones.find((item) => item.milestone_key === key);
      setValues(toFormValues(current?.details));
      const identity = (claimResult.data ?? {}) as ClaimIdentity;
      setClaimNo(identity.claim_no ?? '');
      setCustomerId(identity.customer_id ?? '');
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

  function set(field: FieldKey, value: string) { setValues((current) => ({ ...current, [field]: value })); }

  function openAssistance() {
    router.push({ pathname: '/customer/request-claim-assistance', params: { id: claimId } });
  }

  function continueAfterSave(completed = true) {
    if (!completed) {
      router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: claimId } });
      return;
    }
    const index = SELF_MANAGED_MILESTONES.findIndex((item) => item.key === key);
    const next = SELF_MANAGED_MILESTONES[index + 1];
    if (!next) {
      router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: claimId } });
      return;
    }
    if (next.key === 'spot_status') {
      router.replace({ pathname: '/customer/self-managed-spot-status', params: { id: claimId } });
      return;
    }
    router.replace({ pathname: '/customer/self-managed-milestone', params: { id: claimId, key: next.key } });
  }

  async function save() {
    setMessage('');
    setValidationMessage('');
    if (!claimId || !definition) return setMessage('Claim milestone is unavailable.');
    const validation = validate(key, values, milestones);
    if (validation) return setValidationMessage(validation);

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
      continueAfterSave(completed);
      return;
    }

    const { error } = await (supabase.rpc as any)('save_self_managed_milestone', {
      p_claim_id: claimId,
      p_milestone_key: key,
      p_details: details,
      p_completed_at: current?.completed_at ?? new Date().toISOString(),
    });
    setSaving(false);
    if (error) return setMessage(error.message || 'We could not save this milestone.');
    continueAfterSave(true);
  }

  if (!definition) return (
    <Screen title="Claim Milestone" showTitleHeader={false}>
      <ExternalClaimErrorPopup
        visible={definitionErrorVisible}
        message="This milestone is unavailable."
        title="Something went wrong"
        onClose={() => setDefinitionErrorVisible(false)}
      />
    </Screen>
  );

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

      <ClaimStageSummaryCard
        title={definition.label}
        body={summaryBodyFor(key)}
        label={key === 'vehicle_delivery' ? 'CLAIM STATUS' : 'CLAIM UPDATE'}
        icon={summaryIconFor(key)}
      />

      {loading ? <Text style={styles.loading}>Loading saved details...</Text> : renderStage(key, values, set, milestones, claimId, customerId)}

      <ClaimActionBar
        primaryDisabled={saving || loading}
        primaryIcon={key === 'payment_encashment' ? 'check' : 'arrow-right'}
        primaryLabel={saving ? 'Saving...' : key === 'payment_encashment' ? 'Complete Claim' : key === 'vehicle_delivery' && values.vehicle_received !== 'yes' ? 'Save Vehicle Status' : 'Save & Continue'}
        onAssistance={openAssistance}
        onPrimary={() => void save()}
      />

      <ExternalClaimErrorPopup
        visible={Boolean(validationMessage)}
        message={validationMessage}
        onClose={() => setValidationMessage('')}
      />
      <ExternalClaimErrorPopup
        visible={Boolean(message)}
        message={message}
        title="Something went wrong"
        onClose={() => setMessage('')}
      />
    </Screen>
  );
}

function renderStage(key: ClaimMilestoneKey, values: Values, set: (field: FieldKey, value: string) => void, milestones: ClaimMilestone[], claimId: string, customerId: string) {
  if (key === 'claim_intimation') return <>
    <ClaimFormSection title="Stage Details" subtitle="Record claim intimation, workshop and estimate details" icon="clipboard-edit-outline">
      <DateField label="Claim Intimation Date *" value={values.claim_intimation_date ?? ''} onChange={(v) => set('claim_intimation_date', v)} />
      <Gap /><TextField label="Dealership Name *" value={values.dealership_name ?? ''} onChangeText={(v) => set('dealership_name', v)} />
      <Gap /><TextField label="Dealership Location *" value={values.dealership_location ?? ''} onChangeText={(v) => set('dealership_location', v)} />
      <Gap /><DateField label="Gate-in Date *" value={values.gate_in_date ?? ''} onChange={(v) => set('gate_in_date', v)} />
      <Gap /><MoneyField label="Estimate Amount *" value={values.estimate_amount ?? ''} onChange={(v) => set('estimate_amount', v)} />
    </ClaimFormSection>
    {claimId && customerId ? <ExternalClaimDocumentTabs claimId={claimId} customerId={customerId} /> : null}
  </>;

  if (key === 'work_approval') return <ClaimFormSection title="Stage Details" subtitle="Record approval and surveyor details" icon="clipboard-check-outline">
    <DateField label="Approval Received Date *" value={values.approval_received_date ?? ''} onChange={(v) => set('approval_received_date', v)} />
    <Gap /><ClaimChoice label="Cashless Claim *" value={values.cashless} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} onChange={(v) => set('cashless', v)} />
    <Gap /><TextField label="Surveyor Name (Optional)" value={values.surveyor_name ?? ''} onChangeText={(v) => set('surveyor_name', v)} />
    <Gap /><TextField label="Surveyor Phone (Optional)" value={values.surveyor_phone ?? ''} onChangeText={(v) => set('surveyor_phone', v)} keyboardType="phone-pad" />
    <Gap /><TextField label="Surveyor Email (Optional)" value={values.surveyor_email ?? ''} onChangeText={(v) => set('surveyor_email', v)} keyboardType="email-address" autoCapitalize="none" />
  </ClaimFormSection>;

  if (key === 'repair_ri') return <ClaimFormSection title="Stage Details" subtitle="Repair completion and re-inspection details" icon="tools">
    <DateField label="Repair Complete Date *" value={values.repair_complete_date ?? ''} onChange={(v) => set('repair_complete_date', v)} />
    <View style={styles.subsectionHeader}><Text style={styles.subsectionTitle}>Re-inspection</Text><Text style={styles.subsectionMeta}>Always available</Text></View>
    <DateField label="RI Requested Date (Optional)" value={values.ri_requested_date ?? ''} onChange={(v) => set('ri_requested_date', v)} />
    <Gap /><DateField label="RI Done Date *" value={values.ri_done_date ?? ''} onChange={(v) => set('ri_done_date', v)} />
  </ClaimFormSection>;

  if (key === 'billing') return <ClaimFormSection title="Stage Details" subtitle="Record the final workshop bill" icon="receipt-text-outline">
    <DateField label="Bill Date *" value={values.bill_date ?? ''} onChange={(v) => set('bill_date', v)} />
    <Gap /><MoneyField label="Bill Amount *" value={values.bill_amount ?? ''} onChange={(v) => set('bill_amount', v)} />
  </ClaimFormSection>;

  if (key === 'delivery_order') {
    const bill = milestoneAmount(milestones, 'billing', 'bill_amount');
    const currentDo = numberValue(values.do_amount);
    const contribution = bill !== null && currentDo !== null ? Math.max(0, bill - currentDo) : null;
    return <ClaimFormSection title="Stage Details" subtitle="Record assessment and delivery order details" icon="clipboard-plus-outline">
      <ClaimChoice label="Assessment Received? *" value={values.assessment_received} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => set('assessment_received', v)} />
      <Gap /><DateField label="DO Date *" value={values.do_date ?? ''} onChange={(v) => set('do_date', v)} />
      <Gap /><MoneyField label="DO Amount *" value={values.do_amount ?? ''} onChange={(v) => set('do_amount', v)} />
      <ClaimFinancialSummary rows={[
        ...(bill !== null ? [{ label: 'Bill Amount', value: currency(bill) }] : []),
        ...(currentDo !== null ? [{ label: 'DO Amount', value: currency(currentDo) }] : []),
        ...(contribution !== null ? [{ label: 'Customer Contribution', value: currency(contribution), emphasis: true }] : []),
      ]} />
    </ClaimFormSection>;
  }

  if (key === 'vehicle_delivery') return <ClaimFormSection title="Stage Details" subtitle="Confirm whether the repaired vehicle has been received" icon="truck-check-outline">
    <ClaimChoice label="Vehicle Received? *" value={values.vehicle_received} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'Not Yet' }]} onChange={(v) => set('vehicle_received', v)} />
    {values.vehicle_received === 'yes' ? <><Gap /><DateField label="Vehicle Received Date *" value={values.vehicle_received_date ?? ''} onChange={(v) => set('vehicle_received_date', v)} /></> : <ClaimInlineNote tone="warning">This stage stays in progress until the vehicle is received.</ClaimInlineNote>}
  </ClaimFormSection>;

  if (key === 'payment_encashment') {
    const doAmount = milestoneAmount(milestones, 'delivery_order', 'do_amount');
    const received = numberValue(values.payment_received_amount);
    const deduction = doAmount !== null && received !== null ? Math.max(0, doAmount - received) : null;
    return <ClaimFormSection title="Stage Details" subtitle="Record final documents and settlement payment" icon="cash-check">
      <ClaimChoice label="Depreciation Slip Submitted? *" value={values.depreciation_submitted} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => set('depreciation_submitted', v)} />
      <Gap /><ClaimChoice label="Satisfaction Voucher Submitted? *" value={values.satisfaction_submitted} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => set('satisfaction_submitted', v)} />
      <Gap /><DateField label="Documents Submit Date" value={values.documents_submit_date ?? ''} onChange={(v) => set('documents_submit_date', v)} />
      <Gap /><DateField label="Payment Received Date *" value={values.payment_received_date ?? ''} onChange={(v) => set('payment_received_date', v)} />
      <Gap /><MoneyField label="Amount Received *" value={values.payment_received_amount ?? ''} onChange={(v) => set('payment_received_amount', v)} />
      <ClaimFinancialSummary rows={[
        ...(doAmount !== null ? [{ label: 'DO Amount', value: currency(doAmount) }] : []),
        ...(received !== null ? [{ label: 'Amount Received', value: currency(received) }] : []),
        ...(deduction !== null ? [{ label: 'Further Deduction', value: currency(deduction), emphasis: true }] : []),
      ]} />
    </ClaimFormSection>;
  }

  return <ClaimInlineNote>This milestone is handled by its dedicated screen.</ClaimInlineNote>;
}

function validate(key: ClaimMilestoneKey, v: Values, milestones: ClaimMilestone[]) {
  const required: Partial<Record<ClaimMilestoneKey, FieldKey[]>> = {
    claim_intimation: ['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount'],
    work_approval: ['approval_received_date','cashless'],
    repair_ri: ['repair_complete_date','ri_done_date'],
    billing: ['bill_date','bill_amount'],
    delivery_order: ['assessment_received','do_date','do_amount'],
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
  if (key === 'claim_intimation') return 'Record dealership, gate-in and estimate details.';
  if (key === 'work_approval') return 'Record insurer approval and cashless status.';
  if (key === 'repair_ri') return 'Track repair completion and re-inspection.';
  if (key === 'billing') return 'Record the final workshop bill.';
  if (key === 'delivery_order') return 'Record delivery order and assessment details.';
  if (key === 'vehicle_delivery') return 'Confirm when the repaired vehicle is received.';
  if (key === 'payment_encashment') return 'Record final documents and settlement payment.';
  return 'Update this claim milestone.';
}

function summaryBodyFor(key: ClaimMilestoneKey) {
  if (key === 'claim_intimation') return 'Record this intimation using updates received from the insurer, surveyor, or workshop.';
  if (key === 'vehicle_delivery') return 'Confirm the repaired vehicle delivery status and received date.';
  if (key === 'payment_encashment') return 'Record the final settlement documents and payment received.';
  return 'Record this milestone using updates received from the insurer, surveyor, or workshop.';
}

function summaryIconFor(key: ClaimMilestoneKey): keyof typeof import('@expo/vector-icons').MaterialCommunityIcons.glyphMap {
  if (key === 'claim_intimation') return 'shield-edit-outline';
  if (key === 'work_approval') return 'clipboard-check-outline';
  if (key === 'repair_ri') return 'tools';
  if (key === 'billing') return 'receipt-text-outline';
  if (key === 'delivery_order') return 'clipboard-plus-outline';
  if (key === 'vehicle_delivery') return 'truck-check-outline';
  if (key === 'payment_encashment') return 'cash-check';
  return 'shield-check-outline';
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
  subsectionHeader: { marginTop: 17, marginBottom: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5EAF0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subsectionTitle: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  subsectionMeta: { color: '#145ED7', fontSize: 9.5, fontWeight: '800', backgroundColor: '#EEF4FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
});