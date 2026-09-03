import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  INTERNAL_JOURNEY_STAGES,
  projectInternalClaim,
  type InternalJourneyStageKey,
} from '@insureit/claim-journey';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExternalClaimDocumentTabs } from '@/components/external-claim-document-tabs';
import { ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type ManagedClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  customer_id: string;
  vehicle_id: string;
  current_status: string;
  claim_service_mode?: 'broker_managed' | 'self_managed' | null;
  accident_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
};

type StageDetail = {
  stage: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type ReadOnlyField = {
  label: string;
  keys: string[];
  fallback?: string | number | null;
  money?: boolean;
};

const CLAIM_INTIMATION_UPLOAD_STATUSES = new Set([
  'Spot Survey Completed',
  'Vehicle Inspected',
  'Final Documents Awaited',
  'Final Documents Verification Pending',
  'Final Documents Submitted',
]);

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

const STAGE_FIELDS: Record<InternalJourneyStageKey, ReadOnlyField[]> = {
  spot_intimation: [
    { label: 'Accident date & time', keys: ['accident_at'] },
    { label: 'Accident location', keys: ['accident_location'] },
    { label: 'Accident description', keys: ['accident_description'] },
  ],
  spot_status: [
    { label: 'Surveyor name', keys: ['surveyor_name', 'name'] },
    { label: 'Surveyor mobile', keys: ['surveyor_phone', 'surveyor_mobile', 'mobile'] },
    { label: 'Survey status', keys: ['survey_status', 'status'] },
    { label: 'Inspection date', keys: ['inspection_date', 'survey_date', 'completed_at'] },
  ],
  claim_intimation: [
    { label: 'Insurer claim number', keys: ['insurer_claim_no', 'claim_number'] },
    { label: 'Dealership / workshop', keys: ['dealership_name', 'garage_name'] },
    { label: 'Workshop address', keys: ['dealership_address', 'dealership_location', 'garage_address'] },
    { label: 'Contact person', keys: ['contact_person_name', 'contact_person'] },
    { label: 'Contact number', keys: ['contact_number', 'contact_phone'] },
    { label: 'Estimated loss', keys: ['estimate_amount', 'estimated_loss'], money: true },
  ],
  work_approval: [
    { label: 'Approval status', keys: ['approval_status', 'status'] },
    { label: 'Approval received date', keys: ['approval_received_date', 'approved_at'] },
    { label: 'Approved amount', keys: ['approved_amount'], money: true },
    { label: 'Cashless', keys: ['cashless'] },
  ],
  repair_ri: [
    { label: 'Repair status', keys: ['repair_status', 'status'] },
    { label: 'Repair start date', keys: ['repair_started_date', 'repair_start_date'] },
    { label: 'Repair completion date', keys: ['repair_complete_date', 'repair_completed_date'] },
    { label: 'Re-inspection status', keys: ['ri_status', 'ri_required'] },
  ],
  billing: [
    { label: 'Bill date', keys: ['bill_date', 'final_bill_date'] },
    { label: 'Final bill amount', keys: ['bill_amount', 'final_bill_amount'], money: true },
    { label: 'Assessment received', keys: ['assessment_received', 'assessment_status'] },
  ],
  delivery_order: [
    { label: 'Delivery order status', keys: ['do_status', 'status'] },
    { label: 'Delivery order date', keys: ['do_date', 'delivery_order_date'] },
    { label: 'Delivery order amount', keys: ['do_amount', 'delivery_order_amount'], money: true },
  ],
  vehicle_delivery: [
    { label: 'Vehicle delivery status', keys: ['vehicle_received', 'delivery_status', 'status'] },
    { label: 'Vehicle delivery date', keys: ['vehicle_received_date', 'vehicle_delivery_date'] },
    { label: 'Satisfaction voucher', keys: ['satisfaction_submitted', 'satisfaction_status'] },
  ],
  payment_encashment: [
    { label: 'Payment status', keys: ['payment_status', 'status'] },
    { label: 'Payment received date', keys: ['payment_received_date', 'settlement_date'] },
    { label: 'Settlement amount', keys: ['payment_received_amount', 'settlement_amount'], money: true },
  ],
};

export default function InternalClaimStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const claimId = typeof params.id === 'string' ? params.id : '';
  const stageKey = (typeof params.key === 'string' ? params.key : '') as InternalJourneyStageKey;
  const definition = INTERNAL_JOURNEY_STAGES.find((stage) => stage.key === stageKey);
  const [claim, setClaim] = useState<ManagedClaim | null>(null);
  const [vehicleNo, setVehicleNo] = useState('');
  const [stageDetails, setStageDetails] = useState<StageDetail[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!claimId || !definition) {
        if (active) setLoading(false);
        return;
      }

      const [claimResult, detailsResult] = await Promise.all([
        supabase.from('claims').select('id,claim_no,insurer_claim_no,customer_id,vehicle_id,current_status,claim_service_mode,accident_at,accident_location,accident_description,estimated_loss,approved_amount,settlement_amount').eq('id', claimId).maybeSingle(),
        supabase.from('claim_stage_details').select('stage,details,created_at').eq('claim_id', claimId).order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      if (claimResult.error || !claimResult.data) {
        setMessage('This claim stage could not be loaded.');
        setLoading(false);
        return;
      }

      const nextClaim = claimResult.data as unknown as ManagedClaim;
      if (nextClaim.claim_service_mode !== 'broker_managed') {
        setMessage('This read-only stage view is available only for Sankalp-managed claims.');
        setLoading(false);
        return;
      }

      setClaim(nextClaim);
      setStageDetails((detailsResult.data ?? []) as unknown as StageDetail[]);
      const vehicleResult = await supabase.from('vehicles').select('vehicle_no').eq('id', nextClaim.vehicle_id).maybeSingle();
      if (active) {
        setVehicleNo(vehicleResult.data?.vehicle_no ?? '');
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [claimId, definition]);

  const projection = useMemo(
    () => projectInternalClaim(claim?.current_status),
    [claim?.current_status],
  );
  const step = Math.max(1, INTERNAL_JOURNEY_STAGES.findIndex((stage) => stage.key === stageKey) + 1);
  const mergedDetails = useMemo(() => {
    const merged: Record<string, unknown> = {};
    const relevantStatuses = STAGE_STATUSES[stageKey];
    for (const row of [...stageDetails].reverse()) {
      if (relevantStatuses.has(row.stage)) Object.assign(merged, row.details ?? {});
    }
    if (claim) {
      Object.assign(merged, {
        accident_at: claim.accident_at,
        accident_location: claim.accident_location,
        accident_description: claim.accident_description,
        insurer_claim_no: claim.insurer_claim_no,
        estimated_loss: claim.estimated_loss,
        approved_amount: claim.approved_amount,
        settlement_amount: claim.settlement_amount,
      });
    }
    return merged;
  }, [claim, stageDetails, stageKey]);

  if (loading) return <Screen title="Claim Stage"><LoadingState /></Screen>;
  if (!claim || !definition) {
    return <Screen title="Claim Stage"><EmptyState title="Stage unavailable" body={message || 'Return to the claim and choose another stage.'} /></Screen>;
  }

  const uploadsEnabled = CLAIM_INTIMATION_UPLOAD_STATUSES.has(claim.current_status);
  const isCompleted = step - 1 < projection.completedStageCount;
  const isCurrent = step - 1 === projection.stageIndex && !projection.isTerminal;

  return (
    <Screen title={definition.label} showTitleHeader={false}>
      <ExternalClaimStageHeader
        step={step}
        title={definition.label}
        subtitle={isCompleted ? 'Completed by the claims desk' : isCurrent ? projection.substage : 'Awaiting this operations stage'}
        vehicleNo={vehicleNo}
        claimNo={claim.insurer_claim_no || claim.claim_no}
        serviceLabel="Sankalp Managed"
        onBack={() => router.back()}
      />

      <View style={styles.readOnlyNotice}>
        <View style={styles.noticeIcon}><MaterialCommunityIcons name="shield-lock-outline" size={20} color="#0A43A3" /></View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Claims desk controlled</Text>
          <Text style={styles.noticeText}>You can review this stage and upload requested documents. Operational details stay read-only and are updated by the Claims Desk.</Text>
        </View>
      </View>

      {message ? <Message type="error">{message}</Message> : null}

      <View style={styles.fieldsCard}>
        <View style={styles.fieldsHeader}>
          <Text style={styles.fieldsTitle}>Stage details</Text>
          <View style={styles.readOnlyBadge}><MaterialCommunityIcons name="eye-outline" size={13} color="#526178" /><Text style={styles.readOnlyBadgeText}>READ ONLY</Text></View>
        </View>
        <View style={styles.fieldGrid}>
          {STAGE_FIELDS[stageKey].map((field) => (
            <ReadOnlyValue
              key={field.label}
              label={field.label}
              value={firstValue(mergedDetails, field.keys, field.fallback)}
              money={field.money}
            />
          ))}
        </View>
      </View>

      {stageKey === 'spot_intimation' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/customer/upload-documents', params: { claimId: claim.id } })}
          style={({ pressed }) => [styles.initialDocumentsAction, pressed && styles.initialDocumentsActionPressed]}
        >
          <View style={styles.initialDocumentsIcon}><MaterialCommunityIcons name="file-upload-outline" size={21} color="#FFFFFF" /></View>
          <View style={styles.initialDocumentsCopy}>
            <Text style={styles.initialDocumentsTitle}>Initial claim documents</Text>
            <Text style={styles.initialDocumentsText}>Upload or replace the Spot Intimation documents requested by Operations.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {stageKey === 'claim_intimation' ? (
        <ExternalClaimDocumentTabs
          claimId={claim.id}
          customerId={claim.customer_id}
          mode="broker-managed"
          uploadsEnabled={uploadsEnabled}
        />
      ) : null}
    </Screen>
  );
}

function ReadOnlyValue({ label, value, money }: { label: string; value: unknown; money?: boolean }) {
  const display = formatValue(value, money);
  return (
    <View style={styles.readOnlyField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, !display && styles.fieldValueEmpty]}>{display || 'Awaiting Claims Desk'}</Text>
      <MaterialCommunityIcons name="lock-outline" size={13} color="#94A3B8" style={styles.fieldLock} />
    </View>
  );
}

function firstValue(values: Record<string, unknown>, keys: string[], fallback?: string | number | null) {
  for (const key of keys) {
    const value = values[key];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return fallback;
}

function formatValue(value: unknown, money?: boolean) {
  if (value === null || value === undefined || value === '') return '';
  if (money) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(numeric);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return '';
  return String(value);
}

const styles = StyleSheet.create({
  readOnlyNotice: { marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: '#CFE0F7', backgroundColor: '#F3F8FF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E1EDFF', alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  noticeText: { color: '#526178', fontSize: 10.2, lineHeight: 14.5, fontWeight: '600', marginTop: 2 },
  fieldsCard: { marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', padding: 11 },
  fieldsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  fieldsTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  readOnlyBadge: { borderRadius: 999, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  readOnlyBadgeText: { color: '#526178', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  readOnlyField: { width: '48.5%', minHeight: 67, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 9, paddingRight: 25, position: 'relative' },
  fieldLabel: { color: '#64748B', fontSize: 8.8, lineHeight: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.35 },
  fieldValue: { color: '#334155', fontSize: 11.2, lineHeight: 15, fontWeight: '800', marginTop: 5 },
  fieldValueEmpty: { color: '#94A3B8', fontWeight: '700' },
  fieldLock: { position: 'absolute', right: 8, top: 9 },
  initialDocumentsAction: { minHeight: 72, marginBottom: 10, borderRadius: 17, backgroundColor: '#0A43A3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  initialDocumentsActionPressed: { opacity: 0.9 },
  initialDocumentsIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  initialDocumentsCopy: { flex: 1 },
  initialDocumentsTitle: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  initialDocumentsText: { color: '#DDE9FF', fontSize: 9.5, lineHeight: 13.5, fontWeight: '600', marginTop: 2 },
});
