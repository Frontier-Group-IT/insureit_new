import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  INTERNAL_JOURNEY_STAGES,
  projectInternalClaim,
  type InternalJourneyStageKey,
} from '@insureit/claim-journey';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CompactDocumentStageHeader } from '@/components/compact-document-upload-navigation';
import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimDocumentTabs } from '@/components/external-claim-document-tabs';
import { ClaimActionBar, ClaimFormSection, ClaimIdentityCard, ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { EmptyState, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { ExternalClaimMilestoneStageBody, externalClaimMilestoneSubtitle } from './self-managed-milestone';

type ManagedClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  customer_id: string;
  vehicle_id: string;
  policy_id?: string | null;
  current_status: string;
  claim_service_mode?: 'broker_managed' | 'self_managed' | null;
  accident_at: string | null;
  spot_intimation_at: string | null;
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

type DocumentKey = 'rc' | 'insurance' | 'licence' | 'gr' | 'accident_photo' | 'accident_video';

const CLAIM_INTIMATION_UPLOAD_STATUSES = new Set([
  'Spot Survey Completed',
  'Vehicle Inspected',
  'Final Documents Awaited',
  'Final Documents Verification Pending',
  'Final Documents Submitted',
]);

const DOCUMENT_TYPE_BY_KEY: Record<DocumentKey, string> = {
  rc: 'RC Copy',
  insurance: 'Insurance Copy',
  licence: 'Driver Licence',
  gr: 'GR / Load Bill',
  accident_photo: 'Accident Photo',
  accident_video: 'Accident Video',
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
  const [vehicleMeta, setVehicleMeta] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
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

      const [claimResult, detailsResult, documentsResult] = await Promise.all([
        supabase.from('claims').select('id,claim_no,insurer_claim_no,customer_id,vehicle_id,policy_id,current_status,claim_service_mode,accident_at,spot_intimation_at,accident_location,accident_description,estimated_loss,approved_amount,settlement_amount').eq('id', claimId).maybeSingle(),
        supabase.from('claim_stage_details').select('stage,details,created_at').eq('claim_id', claimId).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('document_type').eq('claim_id', claimId),
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
      setDocumentTypes((documentsResult.data ?? []).map((item: any) => String(item.document_type || '')).filter(Boolean));

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
          if (!active) return;
          setInsurerName(insurerResult.data?.name ?? '');
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId, definition]);

  useEffect(() => {
    if (!claimId || !definition) return;

    const refreshStageDetails = async () => {
      const result = await supabase
        .from('claim_stage_details')
        .select('stage,details,created_at')
        .eq('claim_id', claimId)
        .order('created_at', { ascending: false });
      if (!result.error) setStageDetails((result.data ?? []) as unknown as StageDetail[]);
    };

    const channel = supabase
      .channel(`managed-claim-sync-${claimId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'claims', filter: `id=eq.${claimId}` }, (payload) => {
        const next = payload.new as Partial<ManagedClaim>;
        setClaim((current) => current ? { ...current, ...next } : current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_stage_details', filter: `claim_id=eq.${claimId}` }, () => {
        void refreshStageDetails();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
        spot_intimation_at: claim.spot_intimation_at,
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

  if (stageKey === 'spot_intimation') {
    const incidentAt = parseDate(firstValue(mergedDetails, ['accident_at']));
    const intimationAt = parseDate(firstValue(mergedDetails, ['spot_intimation_at', 'intimation_at']));
    const driverName = firstValue(mergedDetails, ['driver_name', 'driver']);
    const driverPhone = firstValue(mergedDetails, ['driver_phone', 'driver_number', 'driver_mobile']);
    const location = firstValue(mergedDetails, ['location', 'accident_location']);

    return (
      <Screen title="Spot Intimation" showTitleHeader={false}>
        <InternalSpotIntimationIdentityCard
          claimNo={claim.insurer_claim_no || claim.claim_no}
          insurerName={insurerName || 'Insurance company'}
          vehicleNo={vehicleNo || 'Vehicle'}
          policyNo={policyNo || undefined}
          vehicleMeta={vehicleMeta}
        />

        {message ? <Message type="error">{message}</Message> : null}

        <ClaimFormSection
          title="Incident Details"
          subtitle="Accident date, time and first insurer intimation"
          iconImage={require('../../assets/claims/claim-intimation.png')}
        >
          <StageOneValue label="Accident Date *" value={incidentAt ? formatDate(incidentAt) : ''} icon="calendar-month-outline" />
          <StageOneValue label="Accident Time *" value={incidentAt ? formatTime(incidentAt) : ''} icon="clock-outline" />
          <View style={styles.subsection}><Text style={styles.subsectionTitle}>Spot Intimation</Text></View>
          <StageOneValue label="Spot Intimation Date *" value={intimationAt ? formatDate(intimationAt) : ''} icon="calendar-month-outline" />
          <StageOneValue label="Spot Intimation Time *" value={intimationAt ? formatTime(intimationAt) : ''} icon="clock-outline" />
          <View style={styles.gap} />
          <StageOneValue label="Driver Name (Optional)" value={stringDisplay(driverName)} />
          <View style={styles.gap} />
          <StageOneValue label="Driver Number (Optional)" value={stringDisplay(driverPhone)} />
          <View style={styles.gap} />
          <StageOneValue label="Location (Optional)" value={stringDisplay(location)} trailingLabel="Use Current Location" />
        </ClaimFormSection>

        <View style={styles.documentReadyCard}>
          <View style={styles.documentReadyHeader}>
            <View style={styles.documentReadyHeaderCopy}>
              <Text style={styles.documentReadyTitle}>Upload claim documents</Text>
            </View>
            <View style={styles.documentReadyBadge}><Text style={styles.documentReadyBadgeText}>Optional now</Text></View>
          </View>
          <View style={styles.documentReadyGrid}>
            <DocumentReadyTile title="RC Copy" source={require('../../assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png')} saved={documentTypes.includes(DOCUMENT_TYPE_BY_KEY.rc)} onPress={() => openDocuments(router, claim.id)} />
            <DocumentReadyTile title="Insurance Copy" source={require('../../assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png')} saved={documentTypes.includes(DOCUMENT_TYPE_BY_KEY.insurance)} onPress={() => openDocuments(router, claim.id)} />
            <DocumentReadyTile title="Driver Licence" source={require('../../assets/brand/spot-intimation/glossy_purple_id_card_icon.png')} saved={documentTypes.includes(DOCUMENT_TYPE_BY_KEY.licence)} onPress={() => openDocuments(router, claim.id)} />
            <DocumentReadyTile title="GR / Load Bill" source={require('../../assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png')} saved={documentTypes.includes(DOCUMENT_TYPE_BY_KEY.gr)} onPress={() => openDocuments(router, claim.id)} />
            <DocumentReadyTile title="Accident Photo" source={require('../../assets/brand/spot-intimation/glossy_pink_camera_document_icon.png')} saved={documentTypes.includes(DOCUMENT_TYPE_BY_KEY.accident_photo)} onPress={() => openDocuments(router, claim.id)} />
            <DocumentReadyTile title="Accident Video" artwork="accident-video" saved={documentTypes.includes(DOCUMENT_TYPE_BY_KEY.accident_video)} onPress={() => openDocuments(router, claim.id)} />
          </View>
          <View style={styles.bulkUploadShell}>
            <Pressable accessibilityRole="button" onPress={() => openDocuments(router, claim.id)} style={styles.bulkUpload}>
              <Image source={require('../../assets/claims/claim-documents.png')} style={styles.bulkUploadIconArtwork} resizeMode="contain" />
              <View style={styles.bulkUploadCopy}>
                <Text style={styles.bulkUploadTitle}>Upload multiple documents</Text>
                <Text style={styles.bulkUploadText}>Select several files now, or tap again later to add more.</Text>
              </View>
              <MaterialCommunityIcons name="plus-circle-outline" size={21} color="#0A43A3" />
            </Pressable>
          </View>
        </View>

        <View style={styles.voicePlaceholder}>
          <View style={styles.voiceHeadingRow}>
            <View style={styles.voiceIcon}><MaterialCommunityIcons name="microphone-outline" size={25} color="#0A43A3" /></View>
            <View style={styles.voiceCopy}>
              <Text style={styles.voiceTitle}>Incident Voice Note</Text>
              <Text style={styles.voiceText}>Describe what happened in your own words so the incident is easier to understand later.</Text>
            </View>
          </View>
          <View style={styles.voiceButton}><MaterialCommunityIcons name="microphone" size={18} color="#FFFFFF" /><Text style={styles.voiceButtonText}>Record Voice Note</Text></View>
          <View style={styles.voiceComingSoon}><MaterialCommunityIcons name="clock-outline" size={14} color="#60738B" /><Text style={styles.voiceComingSoonText}>This feature will be added soon.</Text></View>
        </View>

        <View style={styles.stageFooterActions}>
          <View style={[styles.footerButton, styles.footerButtonDisabled]}><MaterialCommunityIcons name="arrow-left" size={20} color="#C6D0DC" /><Text style={styles.footerDisabledText}>Previous</Text></View>
          <View style={[styles.footerButton, styles.footerPrimaryDisabled]}><Text style={styles.footerPrimaryText}>Save & Continue</Text><MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFF" /></View>
        </View>
        <View style={styles.stageDots}>{Array.from({ length: 9 }, (_, index) => <View key={index} style={[styles.stageDot, index === 0 && styles.stageDotCurrent]} />)}</View>
      </Screen>
    );
  }

  if (stageKey === 'spot_status') {
    const surveyDate = isoDateValue(firstValue(mergedDetails, ['spot_survey_done_date', 'inspection_date', 'survey_date', 'completed_at']));
    const surveyorName = stringDisplay(firstValue(mergedDetails, ['surveyor_name', 'name']));
    const surveyorEmail = stringDisplay(firstValue(mergedDetails, ['surveyor_email', 'email']));
    const surveyorPhone = stringDisplay(firstValue(mergedDetails, ['surveyor_phone', 'surveyor_mobile', 'mobile']));

    return (
      <Screen title="Spot Status" showTitleHeader={false}>
        <InternalSpotStatusIdentityCard
          claimNo={claim.insurer_claim_no || claim.claim_no}
          insurerName={insurerName || 'Insurance company'}
          vehicleNo={vehicleNo || 'Vehicle'}
          policyNo={policyNo || undefined}
          vehicleMeta={vehicleMeta}
        />

        {message ? <Message type="error">{message}</Message> : null}

        <ClaimFormSection title="Spot Survey" iconImage={require('../../assets/claims/claim-survey.png')}>
          <View pointerEvents="none">
            <AppDatePicker
              label="Spot Survey Done Date *"
              value={surveyDate}
              onChange={() => undefined}
              formatDisplay={formatDisplayDate}
            />
          </View>
        </ClaimFormSection>

        <ClaimFormSection title="Surveyor Details" optional iconImage={require('../../assets/claims/claim-assessment.png')}>
          <View pointerEvents="none"><TextField label="Surveyor Name (Optional)" value={surveyorName} /></View>
          <View style={styles.gap} />
          <View pointerEvents="none"><TextField label="Surveyor Email (Optional)" value={surveyorEmail} keyboardType="email-address" autoCapitalize="none" /></View>
          <View style={styles.gap} />
          <View pointerEvents="none"><TextField label="Surveyor Number (Optional)" value={surveyorPhone} keyboardType="phone-pad" /></View>
        </ClaimFormSection>
      </Screen>
    );
  }

  if (stageKey === 'claim_intimation') {
    const claimIntimationDate = isoDateValue(firstValue(mergedDetails, ['claim_intimation_date', 'intimation_date']));
    const dealershipName = stringDisplay(firstValue(mergedDetails, ['dealership_name', 'garage_name']));
    const dealershipLocation = stringDisplay(firstValue(mergedDetails, ['dealership_location', 'dealership_address', 'garage_address']));
    const gateInDate = isoDateValue(firstValue(mergedDetails, ['gate_in_date', 'gate_in_at']));
    const estimateAmount = formatValue(firstValue(mergedDetails, ['estimate_amount', 'estimated_loss']), true);

    return (
      <Screen title="Claim Intimation" showTitleHeader={false}>
        <CompactDocumentStageHeader
          step={3}
          title="Claim Intimation"
          subtitle="Record dealership, gate-in and estimate details."
          vehicleNo={vehicleNo}
          claimNo={claim.insurer_claim_no || claim.claim_no}
        />

        <ClaimIdentityCard
          claimNo={claim.insurer_claim_no || claim.claim_no}
          insurerName={insurerName || 'Insurance company'}
          vehicleNo={vehicleNo || 'Vehicle'}
          policyNo={policyNo || undefined}
          vehicleMeta={vehicleMeta}
        />

        {message ? <Message type="error">{message}</Message> : null}

        <ClaimFormSection title="Stage Details" subtitle="Record claim intimation, workshop and estimate details" iconImage={require('../../assets/claims/claim-intimation.png')}>
          <View pointerEvents="none">
            <AppDatePicker
              label="Claim Intimation Date *"
              value={claimIntimationDate}
              onChange={() => undefined}
              formatDisplay={formatDisplayDate}
            />
          </View>
          <View style={styles.gap} />
          <View pointerEvents="none"><TextField label="Dealership Name *" value={dealershipName} /></View>
          <View style={styles.gap} />
          <View pointerEvents="none"><TextField label="Dealership Location *" value={dealershipLocation} /></View>
          <View style={styles.gap} />
          <View pointerEvents="none">
            <AppDatePicker
              label="Gate-in Date *"
              value={gateInDate}
              onChange={() => undefined}
              formatDisplay={formatDisplayDate}
            />
          </View>
          <View style={styles.gap} />
          <View pointerEvents="none"><TextField label="Estimate Amount *" value={estimateAmount} keyboardType="decimal-pad" /></View>
        </ClaimFormSection>

        <ExternalClaimDocumentTabs
          claimId={claim.id}
          customerId={claim.customer_id}
          mode="broker-managed"
          uploadsEnabled={uploadsEnabled}
        />
      </Screen>
    );
  }

  const rawFormValue = (keys: string[]) => firstValue(mergedDetails, keys);
const formValue = (keys: string[]) => {
  const value = rawFormValue(keys);
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};
const yesNoValue = (keys: string[]) => {
  const value = rawFormValue(keys);
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const normalized = String(value).trim().toLowerCase();
  if (['yes', 'true', 'received', 'submitted', 'completed', 'done'].includes(normalized)) return 'yes';
  if (['no', 'false', 'not yet', 'pending'].includes(normalized)) return 'no';
  return normalized;
};
const cashlessValue = (() => {
  const value = rawFormValue(['cashless']);
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const normalized = String(value).trim().toLowerCase();
  return ['yes', 'true', 'cashless'].includes(normalized) ? 'true' : ['no', 'false', 'reimbursement'].includes(normalized) ? 'false' : normalized;
})();
const externalValues = {
  approval_received_date: isoDateValue(rawFormValue(['approval_received_date', 'approved_at'])),
  cashless: cashlessValue,
  surveyor_name: formValue(['surveyor_name', 'name']),
  surveyor_phone: formValue(['surveyor_phone', 'surveyor_mobile', 'mobile']),
  surveyor_email: formValue(['surveyor_email', 'email']),
  repair_complete_date: isoDateValue(rawFormValue(['repair_complete_date', 'repair_completed_date'])),
  ri_required: yesNoValue(['ri_required', 'ri_status']),
  ri_requested_date: isoDateValue(rawFormValue(['ri_requested_date', 'reinspection_requested_date'])),
  ri_done_date: isoDateValue(rawFormValue(['ri_done_date', 'reinspection_done_date'])),
  bill_date: isoDateValue(rawFormValue(['bill_date', 'final_bill_date'])),
  bill_amount: formValue(['bill_amount', 'final_bill_amount']),
  assessment_received: yesNoValue(['assessment_received', 'assessment_status']),
  do_date: isoDateValue(rawFormValue(['do_date', 'delivery_order_date'])),
  do_amount: formValue(['do_amount', 'delivery_order_amount']),
  vehicle_received: yesNoValue(['vehicle_received', 'delivery_status', 'status']),
  vehicle_received_date: isoDateValue(rawFormValue(['vehicle_received_date', 'vehicle_delivery_date'])),
  depreciation_submitted: yesNoValue(['depreciation_submitted', 'depreciation_status']),
  satisfaction_submitted: yesNoValue(['satisfaction_submitted', 'satisfaction_status']),
  documents_submit_date: isoDateValue(rawFormValue(['documents_submit_date', 'documents_submitted_date'])),
  payment_received_date: isoDateValue(rawFormValue(['payment_received_date', 'settlement_date'])),
  payment_received_amount: formValue(['payment_received_amount', 'settlement_amount']),
} as any;

const stageSnapshot = (target: InternalJourneyStageKey) => {
  const snapshot: Record<string, unknown> = {};
  const statuses = STAGE_STATUSES[target];
  for (const row of [...stageDetails].reverse()) {
    if (statuses.has(row.stage)) Object.assign(snapshot, row.details ?? {});
  }
  return snapshot;
};
const billingSnapshot = stageSnapshot('billing');
const deliveryOrderSnapshot = stageSnapshot('delivery_order');
const externalMilestones = [
  { milestone_key: 'billing', milestone_status: 'completed', details: billingSnapshot },
  { milestone_key: 'delivery_order', milestone_status: 'completed', details: deliveryOrderSnapshot },
] as any;
const primaryLabel = stageKey === 'payment_encashment'
  ? 'Complete Claim'
  : stageKey === 'vehicle_delivery' && externalValues.vehicle_received !== 'yes'
    ? 'Save Vehicle Status'
    : 'Save & Continue';

return (
  <Screen title={definition.label} showTitleHeader={false}>
    <ExternalClaimStageHeader
      step={step}
      title={definition.label}
      subtitle={externalClaimMilestoneSubtitle(stageKey as any)}
      vehicleNo={vehicleNo}
      claimNo={claim.insurer_claim_no || claim.claim_no}
      onBack={() => router.back()}
    />

    <ClaimIdentityCard
      claimNo={claim.insurer_claim_no || claim.claim_no}
      insurerName={insurerName || 'Insurance company'}
      vehicleNo={vehicleNo || 'Vehicle'}
      policyNo={policyNo || undefined}
      vehicleMeta={vehicleMeta}
    />

    {message ? <Message type="error">{message}</Message> : null}

    <View pointerEvents="none">
        {ExternalClaimMilestoneStageBody(stageKey as any, externalValues, () => undefined, externalMilestones, claim.id, claim.customer_id)}
      </View>

    <View pointerEvents="none">
      <ClaimActionBar
        primaryDisabled={false}
        primaryIcon={stageKey === 'payment_encashment' ? 'check' : 'arrow-right'}
        primaryLabel={primaryLabel}
        onAssistance={() => undefined}
        onPrimary={() => undefined}
      />
    </View>
  </Screen>
);
}

function InternalSpotIntimationIdentityCard({ claimNo, insurerName, vehicleNo, policyNo, vehicleMeta }: { claimNo?: string | null; insurerName?: string | null; vehicleNo?: string | null; policyNo?: string | null; vehicleMeta?: string | null }) {
  return (
    <View style={styles.spotStatusCard}>
      <View style={styles.spotStatusGlowLarge} />
      <View style={styles.spotStatusGlowSmall} />
      <View style={styles.spotStatusHeaderRow}>
        <View style={[styles.spotStatusIconBadge, styles.spotStatusStageBadge]}>
          <Image source={require('../../assets/claims/claim-intimation.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
        </View>
        <Text style={styles.spotStatusHeaderTitle} numberOfLines={1}>Spot Intimation</Text>
        <Text style={styles.spotStatusClaimNo} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>
      <View style={styles.spotStatusHeaderDivider} />
      <View style={styles.spotStatusInfoGrid}>
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusVehicleBadge]}>
              <Image source={require('../../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={styles.spotStatusMainInfoLabel}>Vehicle: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusMakeModelBadge]}>
              <Image source={require('../../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
          </View>
        </View>
        <View style={styles.spotStatusSectionDivider} />
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusPolicyBadge]}>
              <Image source={require('../../assets/claims/policy.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={[styles.spotStatusMainInfoLabel, styles.spotStatusPolicyMainLabel]}>Policy: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{policyNo || '—'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusInsurerBadge]}>
              <Image source={require('../../assets/claims/accounts-finance.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function InternalSpotStatusIdentityCard({ claimNo, insurerName, vehicleNo, policyNo, vehicleMeta }: { claimNo?: string | null; insurerName?: string | null; vehicleNo?: string | null; policyNo?: string | null; vehicleMeta?: string | null }) {
  return (
    <View style={styles.spotStatusCard}>
      <View style={styles.spotStatusGlowLarge} />
      <View style={styles.spotStatusGlowSmall} />
      <View style={styles.spotStatusHeaderRow}>
        <View style={[styles.spotStatusIconBadge, styles.spotStatusStageBadge]}>
          <Image source={require('../../assets/claims/claim-intimation.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
        </View>
        <Text style={styles.spotStatusHeaderTitle} numberOfLines={1}>Spot Status</Text>
        <Text style={styles.spotStatusClaimNo} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>
      <View style={styles.spotStatusHeaderDivider} />
      <View style={styles.spotStatusInfoGrid}>
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusVehicleBadge]}>
              <Image source={require('../../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={styles.spotStatusMainInfoLabel}>Vehicle: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusMakeModelBadge]}>
              <Image source={require('../../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
          </View>
        </View>
        <View style={styles.spotStatusSectionDivider} />
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusPolicyBadge]}>
              <Image source={require('../../assets/claims/policy.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={[styles.spotStatusMainInfoLabel, styles.spotStatusPolicyMainLabel]}>Policy: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{policyNo || '—'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusInsurerBadge]}>
              <Image source={require('../../assets/claims/accounts-finance.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function openDocuments(router: ReturnType<typeof useRouter>, claimId: string) {
  router.push({ pathname: '/customer/upload-documents', params: { claimId } });
}

function StageOneValue({ label, value, icon, trailingLabel }: { label: string; value: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; trailingLabel?: string }) {
  return (
    <View>
      <View style={styles.stageOneLabelRow}>
        <Text style={styles.stageOneLabel}>{label}</Text>
        {trailingLabel ? <View style={styles.locationReplicaAction}><MaterialCommunityIcons name="crosshairs-gps" size={16} color="#0A43A3" /><Text style={styles.locationReplicaText}>{trailingLabel}</Text></View> : null}
      </View>
      <View style={styles.stageOneInput}>
        {icon === 'clock-outline' ? <MaterialCommunityIcons name={icon} size={20} color="#0A43A3" /> : null}
        <Text style={[styles.stageOneValue, !value && styles.stageOneValueEmpty]} numberOfLines={2}>{value || 'Awaiting Claims Desk'}</Text>
        {icon && icon !== 'clock-outline' ? <MaterialCommunityIcons name={icon} size={23} color="#66758A" /> : null}
        {icon === 'clock-outline' ? <MaterialCommunityIcons name="chevron-down" size={22} color={palette.navy} /> : null}
      </View>
    </View>
  );
}

function DocumentReadyTile({ title, source, artwork, saved, onPress }: { title: string; source?: any; artwork?: 'accident-video'; saved: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: saved }} onPress={onPress} style={[styles.documentReadyTile, saved && styles.documentReadyTileSelected]}>
      {saved ? <View style={styles.documentSelectedCheck}><MaterialCommunityIcons name="check" size={15} color="#18864B" /></View> : null}
      {saved ? <View style={styles.documentRemoveButton}><MaterialCommunityIcons name="close" size={13} color="#C43232" /></View> : null}
      <View style={styles.documentReadyArtworkWrap}>
        {artwork === 'accident-video' ? <AccidentVideoArtwork /> : source ? <Image source={source} style={styles.documentReadyArtwork} resizeMode="contain" /> : null}
      </View>
      <Text style={styles.documentReadyTileText} numberOfLines={2}>{title}</Text>
      <Text style={[styles.documentReadyStatus, saved && styles.documentReadyStatusSelected]}>{saved ? 'Saved' : 'Tap to upload'}</Text>
    </Pressable>
  );
}

function AccidentVideoArtwork() {
  return (
    <View style={styles.accidentVideoArtwork}>
      <View style={styles.accidentVideoGloss} />
      <View style={styles.accidentVideoFold} />
      <MaterialCommunityIcons name="video" size={18} color="#FFFFFF" />
      <View style={styles.accidentVideoLineLong} />
      <View style={styles.accidentVideoLineShort} />
    </View>
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

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date) {
  return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value: Date) {
  return value.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function stringDisplay(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function isoDateValue(value: unknown) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = parseDate(value);
  if (!parsed) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
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
  gap: { height: 10 },
  subsection: { marginTop: 16, marginBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E7EBF0' },
  subsectionTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  stageOneLabelRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  stageOneLabel: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  stageOneInput: { minHeight: 62, borderRadius: 16, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  stageOneValue: { flex: 1, color: palette.navy, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  stageOneValueEmpty: { color: '#94A3B8', fontSize: 11.5, fontWeight: '700' },
  locationReplicaAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationReplicaText: { color: '#0A43A3', fontSize: 10.5, fontWeight: '900' },
  documentReadyCard: { borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', padding: 12, marginBottom: 12, shadowColor: '#14375F', shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  documentReadyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  documentReadyHeaderCopy: { flex: 1, minWidth: 0 },
  documentReadyTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  documentReadyBadge: { borderRadius: 999, backgroundColor: '#EEF5FF', paddingHorizontal: 9, paddingVertical: 5 },
  documentReadyBadgeText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900' },
  documentReadyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  documentReadyTile: { position: 'relative', width: '31.5%', minWidth: 0, minHeight: 106, borderRadius: 14, backgroundColor: '#F7FAFF', borderWidth: 1.5, borderColor: '#E2EAF4', paddingVertical: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  documentReadyTileSelected: { backgroundColor: '#EFFAF4', borderColor: '#52B57F', shadowColor: '#18864B', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  documentSelectedCheck: { position: 'absolute', top: 5, left: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(46, 173, 99, 0.16)', alignItems: 'center', justifyContent: 'center' },
  documentRemoveButton: { position: 'absolute', top: 5, right: 5, zIndex: 3, width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
  documentReadyArtworkWrap: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  documentReadyArtwork: { width: 43, height: 43 },
  accidentVideoArtwork: { width: 36, height: 38, borderRadius: 8, backgroundColor: '#FF1018', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingTop: 1, shadowColor: '#B60000', shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  accidentVideoGloss: { position: 'absolute', top: 2, left: 3, width: 21, height: 8, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.20)', transform: [{ rotate: '-12deg' }] },
  accidentVideoFold: { position: 'absolute', top: 0, right: 0, width: 11, height: 11, borderBottomLeftRadius: 7, backgroundColor: '#FFDDE2' },
  accidentVideoLineLong: { width: 19, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF', marginTop: 3 },
  accidentVideoLineShort: { width: 12, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF', marginTop: 2 },
  documentReadyTileText: { color: palette.navy, fontSize: 8.5, lineHeight: 11, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  documentReadyStatus: { color: '#7A8799', fontSize: 7.5, fontWeight: '800', marginTop: 3 },
  documentReadyStatusSelected: { color: '#18864B' },
  bulkUploadShell: { position: 'relative' },
  bulkUpload: { minHeight: 58, marginTop: 10, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#AFC8E8', backgroundColor: '#F7FAFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bulkUploadIconArtwork: { width: 34, height: 34 },
  bulkUploadCopy: { flex: 1, minWidth: 0 },
  bulkUploadTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  bulkUploadText: { color: '#718198', fontSize: 8.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  voicePlaceholder: { borderRadius: 18, borderWidth: 1, borderColor: '#CADAF0', backgroundColor: '#F5F9FF', padding: 13, marginBottom: 12 },
  voiceHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voiceIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#E6F0FF', alignItems: 'center', justifyContent: 'center' },
  voiceCopy: { flex: 1, minWidth: 0 },
  voiceTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  voiceText: { color: '#68778D', fontSize: 9.5, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  voiceButton: { width: '100%', minHeight: 48, marginTop: 12, borderRadius: 14, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: 0.78 },
  voiceButtonText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  voiceComingSoon: { marginTop: 9, borderTopWidth: 1, borderTopColor: '#D9E5F3', paddingTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  voiceComingSoonText: { color: '#68778D', fontSize: 9.5, fontWeight: '700' },
  stageFooterActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  footerButton: { flex: 1, minHeight: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  footerButtonDisabled: { borderWidth: 1, borderColor: '#D8E1EC', backgroundColor: '#F7F9FC' },
  footerDisabledText: { color: '#C6D0DC', fontSize: 12, fontWeight: '900' },
  footerPrimaryDisabled: { backgroundColor: '#0A43A3', opacity: 0.92 },
  footerPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  stageDots: { marginTop: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  stageDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: '#CAD5E2', backgroundColor: '#E9EEF4' },
  stageDotCurrent: { width: 10, height: 10, borderColor: '#0A43A3', backgroundColor: '#2E7BEF' },
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
  spotStatusCard: { position: 'relative', overflow: 'hidden', width: '100%', borderRadius: 18, backgroundColor: '#062D70', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 10, shadowColor: '#062D70', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  spotStatusGlowLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0C58C8', right: -95, top: -105, opacity: 0.26 },
  spotStatusGlowSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(120,169,255,0.16)', right: -20, top: -62 },
  spotStatusHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  spotStatusIconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  spotStatusBadgeArtwork: { width: 21, height: 21 },
  spotStatusStageBadge: { backgroundColor: '#0B51BE' },
  spotStatusHeaderTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  spotStatusClaimNo: { maxWidth: '38%', color: '#FFFFFF', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'right', letterSpacing: 0.1 },
  spotStatusHeaderDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 8, marginBottom: 8 },
  spotStatusInfoGrid: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  spotStatusInfoSection: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  spotStatusSectionDivider: { width: 1, backgroundColor: 'rgba(174,204,255,0.18)', marginHorizontal: 5, marginVertical: 1 },
  spotStatusMainInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  spotStatusVehicleBadge: { backgroundColor: '#EAF2FF' },
  spotStatusPolicyBadge: { backgroundColor: '#E8F7F1' },
  spotStatusMainInfoLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.4, lineHeight: 14 },
  spotStatusMainInfoLabel: { color: '#D8E7FF', fontWeight: '800' },
  spotStatusPolicyMainLabel: { color: '#A9E7D0' },
  spotStatusMainInfoValue: { color: '#FFFFFF', fontWeight: '900' },
  spotStatusSecondaryInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 },
  spotStatusMakeModelBadge: { backgroundColor: '#E8F1FF' },
  spotStatusInsurerBadge: { backgroundColor: '#FFF2D8' },
  spotStatusSecondaryValue: { flex: 1, minWidth: 0, color: '#EAF2FF', fontSize: 8.8, lineHeight: 11.5, fontWeight: '700' },
});
