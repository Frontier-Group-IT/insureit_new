import { INTERNAL_JOURNEY_STAGES, projectInternalClaim, type InternalJourneyStageKey } from '@insureit/claim-journey';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { CompactDocumentStageHeader } from '@/components/compact-document-upload-navigation';
import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimDocumentTabs } from '@/components/external-claim-document-tabs';
import {
  ClaimActionBar,
  ClaimChoice,
  ClaimFinancialSummary,
  ClaimFormSection,
  ClaimIdentityCard,
  ClaimInlineNote,
  ExternalClaimStageHeader,
} from '@/components/external-claim-ui';
import { EmptyState, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type ManagedClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  customer_id: string;
  vehicle_id: string;
  policy_id?: string | null;
  current_status: string;
  claim_service_mode?: 'broker_managed' | 'self_managed' | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
};

type StageDetail = {
  stage: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

const STAGE_STATUSES: Record<InternalJourneyStageKey, Set<string>> = {
  spot_intimation: new Set(['Draft', 'Accident Reported', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Pending', 'Documents Submitted']),
  spot_status: new Set(['Claim Intimated', 'Surveyor Appointed']),
  claim_intimation: new Set(['Spot Survey Completed', 'Vehicle Inspected', 'Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Claim Intimation', 'Final Surveyor Details', 'Survey Status']),
  work_approval: new Set(['Survey Done', 'Estimate Submitted', 'Approval Pending', 'Work Approval Status', 'Work Approval Received']),
  repair_ri: new Set(['Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation', 'RA Intimation Done']),
  billing: new Set(['Final Bill Submitted']),
  delivery_order: new Set(['DO Status', 'DO Submitted']),
  vehicle_delivery: new Set(['Payment Stage', 'Claim Completion In Progress']),
  payment_encashment: new Set(['Settlement Under Process', 'Claim Complete', 'Settled', 'Closed']),
};

const UPLOAD_STATUSES = new Set([
  'Spot Survey Completed',
  'Vehicle Inspected',
  'Final Documents Awaited',
  'Final Documents Verification Pending',
  'Final Documents Submitted',
]);

export default function InternalClaimStageParity() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const claimId = typeof params.id === 'string' ? params.id : '';
  const stageKey = (typeof params.key === 'string' ? params.key : '') as InternalJourneyStageKey;
  const definition = INTERNAL_JOURNEY_STAGES.find((item) => item.key === stageKey);

  const [claim, setClaim] = useState<ManagedClaim | null>(null);
  const [details, setDetails] = useState<StageDetail[]>([]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleMeta, setVehicleMeta] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [insurerName, setInsurerName] = useState('Insurance company');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!claimId || !definition) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const [claimResult, detailResult] = await Promise.all([
        supabase
          .from('claims')
          .select('id,claim_no,insurer_claim_no,customer_id,vehicle_id,policy_id,current_status,claim_service_mode,estimated_loss,approved_amount,settlement_amount')
          .eq('id', claimId)
          .maybeSingle(),
        supabase
          .from('claim_stage_details')
          .select('stage,details,created_at')
          .eq('claim_id', claimId)
          .order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      if (claimResult.error || !claimResult.data) {
        setMessage('This claim stage could not be loaded.');
        setLoading(false);
        return;
      }
      const nextClaim = claimResult.data as unknown as ManagedClaim;
      if (nextClaim.claim_service_mode !== 'broker_managed') {
        setMessage('This stage belongs to a different claim tracking mode.');
        setLoading(false);
        return;
      }
      setClaim(nextClaim);
      setDetails((detailResult.data ?? []) as unknown as StageDetail[]);

      const vehicleResult = await supabase.from('vehicles').select('vehicle_no,make,model').eq('id', nextClaim.vehicle_id).maybeSingle();
      if (!active) return;
      setVehicleNo(vehicleResult.data?.vehicle_no ?? '');
      setVehicleMeta([vehicleResult.data?.make, vehicleResult.data?.model].filter(Boolean).join(' · '));

      if (nextClaim.policy_id) {
        const policyResult = await supabase.from('policies').select('policy_no,insurance_company_id').eq('id', nextClaim.policy_id).maybeSingle();
        if (!active) return;
        setPolicyNo(policyResult.data?.policy_no ?? '');
        if (policyResult.data?.insurance_company_id) {
          const insurerResult = await supabase.from('insurance_companies').select('name').eq('id', policyResult.data.insurance_company_id).maybeSingle();
          if (active && insurerResult.data?.name) setInsurerName(insurerResult.data.name);
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId, definition]);

  useEffect(() => {
    if (!claimId || !definition) return;
    const channel = supabase
      .channel(`internal-parity-${claimId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'claims', filter: `id=eq.${claimId}` }, (payload) => {
        const next = payload.new as Partial<ManagedClaim>;
        setClaim((current) => current ? { ...current, ...next } : current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_stage_details', filter: `claim_id=eq.${claimId}` }, () => {
        void supabase
          .from('claim_stage_details')
          .select('stage,details,created_at')
          .eq('claim_id', claimId)
          .order('created_at', { ascending: false })
          .then((result) => {
            if (!result.error) setDetails((result.data ?? []) as unknown as StageDetail[]);
          });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [claimId, definition]);

  const projection = useMemo(() => projectInternalClaim(claim?.current_status), [claim?.current_status]);
  const step = Math.max(1, INTERNAL_JOURNEY_STAGES.findIndex((item) => item.key === stageKey) + 1);
  const values = useMemo(() => mergeStageDetails(details, stageKey, claim), [claim, details, stageKey]);

  if (loading) return <Screen title="Claim Stage"><LoadingState /></Screen>;
  if (!claim || !definition || step < 3) {
    return <Screen title="Claim Stage"><EmptyState title="Stage unavailable" body={message || 'Return to the claim tracker and choose another stage.'} /></Screen>;
  }

  const activeClaimId = claim.id;
  const claimNo = claim.insurer_claim_no || claim.claim_no;
  const subtitle = subtitleFor(stageKey);

  function openAssistance() {
    router.push({ pathname: '/customer/request-claim-assistance', params: { id: activeClaimId, returnStage: stageKey } });
  }

  function continueStage() {
    const current = INTERNAL_JOURNEY_STAGES.findIndex((item) => item.key === stageKey);
    const next = INTERNAL_JOURNEY_STAGES[current + 1];
    if (!next) {
      router.replace({ pathname: '/customer/claim-detail', params: { id: activeClaimId } });
      return;
    }
    router.replace({ pathname: '/customer/internal-claim-stage', params: { id: activeClaimId, key: next.key } });
  }

  return (
    <Screen title={definition.label} showTitleHeader={false}>
      {stageKey === 'claim_intimation' ? (
        <CompactDocumentStageHeader
          step={3}
          title="Claim Intimation"
          subtitle="Record dealership, gate-in and estimate details."
          vehicleNo={vehicleNo}
          claimNo={claimNo}
        />
      ) : (
        <ExternalClaimStageHeader
          step={step}
          title={definition.label}
          subtitle={subtitle}
          vehicleNo={vehicleNo}
          claimNo={claimNo}
          serviceLabel="Sankalp Managed"
          onBack={() => router.back()}
        />
      )}

      <ClaimIdentityCard
        claimNo={claimNo}
        insurerName={insurerName}
        vehicleNo={vehicleNo || 'Vehicle'}
        policyNo={policyNo || undefined}
        vehicleMeta={vehicleMeta}
      />

      {message ? <Message type="error">{message}</Message> : null}

      <View pointerEvents="none">
        {renderStage(stageKey, values, details)}
      </View>

      {stageKey === 'claim_intimation' ? (
        <ExternalClaimDocumentTabs
          claimId={claim.id}
          customerId={claim.customer_id}
          mode="broker-managed"
          uploadsEnabled={UPLOAD_STATUSES.has(claim.current_status)}
        />
      ) : null}

      {stageKey !== 'claim_intimation' ? (
        <ClaimActionBar
          primaryLabel={stageKey === 'payment_encashment' || projection.isTerminal ? 'Back to Claim' : 'Continue'}
          primaryIcon={stageKey === 'payment_encashment' || projection.isTerminal ? 'check' : 'arrow-right'}
          onAssistance={openAssistance}
          onPrimary={continueStage}
        />
      ) : null}
    </Screen>
  );
}

function renderStage(key: InternalJourneyStageKey, values: Record<string, unknown>, allDetails: StageDetail[]) {
  if (key === 'claim_intimation') {
    return (
      <ClaimFormSection title="Stage Details" subtitle="Record claim intimation, workshop and estimate details" iconImage={require('../assets/claims/claim-intimation.png')}>
        <ReadOnlyDate label="Claim Intimation Date *" value={first(values, ['claim_intimation_date', 'intimation_date'])} />
        <Gap /><ReadOnlyText label="Dealership Name *" value={first(values, ['dealership_name', 'garage_name'])} />
        <Gap /><ReadOnlyText label="Dealership Location *" value={first(values, ['dealership_location', 'dealership_address', 'garage_address'])} />
        <Gap /><ReadOnlyDate label="Gate-in Date *" value={first(values, ['gate_in_date', 'gate_in_at'])} />
        <Gap /><ReadOnlyMoney label="Estimate Amount *" value={first(values, ['estimate_amount', 'estimated_loss'])} />
      </ClaimFormSection>
    );
  }

  if (key === 'work_approval') {
    return (
      <ClaimFormSection title="Stage Details" subtitle="Record approval and surveyor details" iconImage={require('../assets/claims/claim-approval.png')}>
        <ReadOnlyDate label="Approval Received Date *" value={first(values, ['approval_received_date', 'approved_at'])} />
        <Gap /><ReadOnlyChoice label="Cashless Claim *" value={first(values, ['cashless'])} yesValue="true" noValue="false" />
        <Gap /><ReadOnlyText label="Surveyor Name (Optional)" value={first(values, ['surveyor_name', 'name'])} />
        <Gap /><ReadOnlyText label="Surveyor Phone (Optional)" value={first(values, ['surveyor_phone', 'surveyor_mobile', 'mobile'])} />
        <Gap /><ReadOnlyText label="Surveyor Email (Optional)" value={first(values, ['surveyor_email', 'email'])} />
      </ClaimFormSection>
    );
  }

  if (key === 'repair_ri') {
    return (
      <ClaimFormSection title="Stage Details" subtitle="Repair completion and re-inspection details" iconImage={require('../assets/claims/claim-assessment.png')}>
        <ReadOnlyDate label="Repair Complete Date *" value={first(values, ['repair_complete_date', 'repair_completed_date'])} />
        <View style={{ marginTop: 16, marginBottom: 8, borderTopWidth: 1, borderTopColor: '#E7EBF0', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: '#071D49', fontSize: 12.5, fontWeight: '900' }}>Re-inspection</Text>
          <Text style={{ color: '#718198', fontSize: 9.5, fontWeight: '800' }}>Always available</Text>
        </View>
        <ReadOnlyDate label="RI Requested Date (Optional)" value={first(values, ['ri_requested_date', 'ra_intimation_date'])} />
        <Gap /><ReadOnlyDate label="RI Done Date *" value={first(values, ['ri_done_date', 'reinspection_date', 'ra_done_date'])} />
      </ClaimFormSection>
    );
  }

  if (key === 'billing') {
    return (
      <ClaimFormSection title="Stage Details" subtitle="Record the final workshop bill" iconImage={require('../assets/claims/receipts-posted.png')}>
        <ReadOnlyDate label="Bill Date *" value={first(values, ['bill_date', 'final_bill_date'])} />
        <Gap /><ReadOnlyMoney label="Bill Amount *" value={first(values, ['bill_amount', 'final_bill_amount'])} />
      </ClaimFormSection>
    );
  }

  if (key === 'delivery_order') {
    const bill = numeric(stageValue(allDetails, 'billing', ['bill_amount', 'final_bill_amount']));
    const doAmount = numeric(first(values, ['do_amount', 'delivery_order_amount']));
    const contribution = bill !== null && doAmount !== null ? Math.max(0, bill - doAmount) : null;
    return (
      <ClaimFormSection title="Stage Details" subtitle="Record assessment and delivery order details" iconImage={require('../assets/claims/claim-documents.png')}>
        <ReadOnlyChoice label="Assessment Received? *" value={first(values, ['assessment_received', 'assessment_status'])} yesValue="yes" noValue="no" />
        <Gap /><ReadOnlyDate label="DO Date *" value={first(values, ['do_date', 'delivery_order_date'])} />
        <Gap /><ReadOnlyMoney label="DO Amount *" value={first(values, ['do_amount', 'delivery_order_amount'])} />
        <ClaimFinancialSummary rows={[
          ...(bill !== null ? [{ label: 'Bill Amount', value: currency(bill) }] : []),
          ...(doAmount !== null ? [{ label: 'DO Amount', value: currency(doAmount) }] : []),
          ...(contribution !== null ? [{ label: 'Customer Contribution', value: currency(contribution), emphasis: true }] : []),
        ]} />
      </ClaimFormSection>
    );
  }

  if (key === 'vehicle_delivery') {
    const received = normalizedChoice(first(values, ['vehicle_received', 'delivery_status', 'status']));
    return (
      <ClaimFormSection title="Stage Details" subtitle="Confirm whether the repaired vehicle has been received" iconImage={require('../assets/claims/fleet-vehicle.png')}>
        <ReadOnlyChoice label="Vehicle Received? *" value={received} yesValue="yes" noValue="no" noLabel="Not Yet" />
        {received === 'yes' ? <><Gap /><ReadOnlyDate label="Vehicle Received Date *" value={first(values, ['vehicle_received_date', 'vehicle_delivery_date'])} /></> : <ClaimInlineNote tone="warning">This stage stays in progress until the vehicle is received.</ClaimInlineNote>}
      </ClaimFormSection>
    );
  }

  if (key === 'payment_encashment') {
    const doAmount = numeric(stageValue(allDetails, 'delivery_order', ['do_amount', 'delivery_order_amount']));
    const received = numeric(first(values, ['payment_received_amount', 'settlement_amount']));
    const deduction = doAmount !== null && received !== null ? Math.max(0, doAmount - received) : null;
    return (
      <ClaimFormSection title="Stage Details" subtitle="Record final documents and settlement payment" iconImage={require('../assets/claims/accounts-finance.png')}>
        <ReadOnlyChoice label="Depreciation Slip Submitted? *" value={first(values, ['depreciation_submitted', 'depreciation_status'])} yesValue="yes" noValue="no" />
        <Gap /><ReadOnlyChoice label="Satisfaction Voucher Submitted? *" value={first(values, ['satisfaction_submitted', 'satisfaction_status'])} yesValue="yes" noValue="no" />
        <Gap /><ReadOnlyDate label="Documents Submit Date" value={first(values, ['documents_submit_date', 'documents_submitted_date'])} />
        <Gap /><ReadOnlyDate label="Payment Received Date *" value={first(values, ['payment_received_date', 'settlement_date'])} />
        <Gap /><ReadOnlyMoney label="Amount Received *" value={first(values, ['payment_received_amount', 'settlement_amount'])} />
        <ClaimFinancialSummary rows={[
          ...(doAmount !== null ? [{ label: 'DO Amount', value: currency(doAmount) }] : []),
          ...(received !== null ? [{ label: 'Amount Received', value: currency(received) }] : []),
          ...(deduction !== null ? [{ label: 'Further Deduction', value: currency(deduction), emphasis: true }] : []),
        ]} />
      </ClaimFormSection>
    );
  }

  return null;
}

function ReadOnlyDate({ label, value }: { label: string; value: unknown }) {
  return <AppDatePicker label={label} value={isoDate(value)} onChange={() => undefined} formatDisplay={displayDate} />;
}

function ReadOnlyText({ label, value }: { label: string; value: unknown }) {
  return <TextField label={label} value={display(value)} />;
}

function ReadOnlyMoney({ label, value }: { label: string; value: unknown }) {
  const amount = numeric(value);
  return <TextField label={label} value={amount === null ? '' : String(amount)} keyboardType="decimal-pad" />;
}

function ReadOnlyChoice({ label, value, yesValue, noValue, noLabel = 'No' }: { label: string; value: unknown; yesValue: string; noValue: string; noLabel?: string }) {
  const normalized = normalizedChoice(value);
  const selected = yesValue === 'true'
    ? (normalized === 'yes' || normalized === 'true' ? 'true' : normalized === 'no' || normalized === 'false' ? 'false' : normalized)
    : normalized;
  return <ClaimChoice label={label} value={selected} options={[{ value: yesValue, label: 'Yes' }, { value: noValue, label: noLabel }]} onChange={() => undefined} />;
}

function Gap() { return <View style={{ height: 10 }} />; }

function mergeStageDetails(rows: StageDetail[], key: InternalJourneyStageKey, claim: ManagedClaim | null) {
  const merged: Record<string, unknown> = {};
  const statuses = STAGE_STATUSES[key];
  for (const row of [...rows].reverse()) {
    if (statuses.has(row.stage)) Object.assign(merged, row.details ?? {});
  }
  if (claim) {
    Object.assign(merged, {
      insurer_claim_no: claim.insurer_claim_no,
      estimated_loss: claim.estimated_loss,
      approved_amount: claim.approved_amount,
      settlement_amount: claim.settlement_amount,
    });
  }
  return merged;
}

function stageValue(rows: StageDetail[], key: InternalJourneyStageKey, keys: string[]) {
  const merged = mergeStageDetails(rows, key, null);
  return first(merged, keys);
}

function first(values: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = values[key];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return '';
}

function display(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function normalizedChoice(value: unknown) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const raw = display(value).trim().toLowerCase();
  if (['yes', 'true', '1', 'received', 'completed', 'submitted'].includes(raw)) return raw === 'true' ? 'true' : 'yes';
  if (['no', 'false', '0', 'not yet', 'pending'].includes(raw)) return raw === 'false' ? 'false' : 'no';
  return raw;
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function currency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function isoDate(value: unknown) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function displayDate(value: string) {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${d}-${m}-${y}`;
}

function subtitleFor(key: InternalJourneyStageKey) {
  if (key === 'claim_intimation') return 'Record dealership, gate-in and estimate details.';
  if (key === 'work_approval') return 'Record approval and surveyor details';
  if (key === 'repair_ri') return 'Repair completion and re-inspection details';
  if (key === 'billing') return 'Record the final workshop bill';
  if (key === 'delivery_order') return 'Record assessment and delivery order details';
  if (key === 'vehicle_delivery') return 'Confirm whether the repaired vehicle has been received';
  if (key === 'payment_encashment') return 'Record final documents and settlement payment';
  return '';
}
