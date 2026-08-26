import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CompactDocumentActionBar, CompactDocumentStageHeader } from '@/components/compact-document-upload-navigation';
import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimDocumentTabs } from '@/components/external-claim-document-tabs';
import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { ClaimActionBar, ClaimChoice, ClaimFinancialSummary, ClaimFormSection, ClaimIdentityCard, ClaimInlineNote, ExternalClaimStageHeader } from '@/components/external-claim-ui';
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
type ClaimIdentity = { claim_no?: string | null; vehicle_id?: string | null; customer_id?: string | null; external_policy_id?: string | null };
type ApprovalDocumentRecord = { id: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };

const APPROVAL_DOCUMENT_TYPE = 'Approval PDF';
const MAX_APPROVAL_PDF_SIZE_BYTES = 5 * 1024 * 1024;
const FINAL_BILL_DOCUMENT_TYPE = 'Final Workshop Bill';
const MAX_FINAL_BILL_SIZE_BYTES = 10 * 1024 * 1024;

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
  const [vehicleMeta, setVehicleMeta] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [insurerName, setInsurerName] = useState('Insurance company');
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
        supabase.from('claims').select('claim_no, vehicle_id, customer_id, external_policy_id').eq('id', claimId).maybeSingle(),
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
        const vehicleResult = await supabase.from('vehicles').select('vehicle_no,make,model').eq('id', identity.vehicle_id).maybeSingle();
        if (active && vehicleResult.data) {
          setVehicleNo((vehicleResult.data as any).vehicle_no ?? '');
          setVehicleMeta([(vehicleResult.data as any).make, (vehicleResult.data as any).model].filter(Boolean).join(' · '));
        }
      }
      if (identity.external_policy_id) {
        const policyResult = await (supabase as any).from('external_policies').select('policy_no,insurance_company_id').eq('id', identity.external_policy_id).maybeSingle();
        if (active && policyResult.data) {
          setPolicyNo(policyResult.data.policy_no ?? '');
          if (policyResult.data.insurance_company_id) {
            const insurerResult = await supabase.from('insurance_companies').select('name').eq('id', policyResult.data.insurance_company_id).maybeSingle();
            if (active && insurerResult.data?.name) setInsurerName(insurerResult.data.name);
          }
        }
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [claimId, definition, key]);

  const step = useMemo(() => Math.max(1, SELF_MANAGED_MILESTONES.findIndex((item) => item.key === key) + 1), [key]);

  function set(field: FieldKey, value: string) { setValues((current) => ({ ...current, [field]: value })); }

  function openAssistance() {
    router.push({ pathname: '/customer/request-claim-assistance', params: { id: claimId, returnStage: key } });
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

  const documentUploadStage = key === 'claim_intimation';
  const primaryLabel = saving ? 'Saving...' : key === 'payment_encashment' ? 'Complete Claim' : key === 'vehicle_delivery' && values.vehicle_received !== 'yes' ? 'Save Vehicle Status' : 'Save & Continue';

  return (
    <Screen title={definition.label} showTitleHeader={false}>
      {documentUploadStage ? <CompactDocumentStageHeader
        step={step}
        title={definition.label}
        subtitle={subtitleFor(key)}
        vehicleNo={vehicleNo}
        claimNo={claimNo}
      /> : <ExternalClaimStageHeader
        step={step}
        title={definition.label}
        subtitle={subtitleFor(key)}
        vehicleNo={vehicleNo}
        claimNo={claimNo}
        onBack={() => router.back()}
      />}

      <ClaimIdentityCard
        claimNo={claimNo}
        insurerName={insurerName}
        vehicleNo={vehicleNo}
        policyNo={policyNo}
        vehicleMeta={vehicleMeta}
      />

      {loading ? <Text style={styles.loading}>Loading saved details...</Text> : renderStage(key, values, set, milestones, claimId, customerId)}

      {documentUploadStage ? <CompactDocumentActionBar
        claimId={claimId}
        step={step}
        milestones={milestones}
        primaryDisabled={saving || loading}
        primaryLabel={primaryLabel}
        onPrimary={() => void save()}
      /> : <ClaimActionBar
        primaryDisabled={saving || loading}
        primaryIcon={key === 'payment_encashment' ? 'check' : 'arrow-right'}
        primaryLabel={primaryLabel}
        onAssistance={openAssistance}
        onPrimary={() => void save()}
      />}

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
    {claimId && customerId ? <><Gap /><WorkApprovalPdfUpload claimId={claimId} customerId={customerId} /></> : null}
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
    {claimId && customerId ? <><Gap /><FinalBillUpload claimId={claimId} customerId={customerId} /></> : null}
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

function WorkApprovalPdfUpload({ claimId, customerId }: { claimId: string; customerId: string }) {
  const [document, setDocument] = useState<ApprovalDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error: loadError } = await (supabase as any)
        .from('claim_documents')
        .select('id,file_name,storage_bucket,storage_path')
        .eq('claim_id', claimId)
        .eq('document_type', APPROVAL_DOCUMENT_TYPE)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (loadError) setError('We could not load the saved approval PDF. Please try again.');
      else setDocument((data ?? null) as ApprovalDocumentRecord | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 2800);
    return () => clearTimeout(timer);
  }, [success]);

  async function viewApprovalPdf() {
    if (!document?.storage_bucket || !document.storage_path || uploading || removing) return;
    setError('');
    try {
      const { data, error: signedUrlError } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
      if (signedUrlError || !data?.signedUrl) {
        setError('We could not open the approval PDF. Please try again.');
        return;
      }
      const supported = await Linking.canOpenURL(data.signedUrl);
      if (!supported) {
        setError('This approval PDF could not be opened on this device.');
        return;
      }
      await Linking.openURL(data.signedUrl);
    } catch {
      setError('We could not open the approval PDF. Please try again.');
    }
  }

  async function chooseAndUpload() {
    if (uploading || removing) return;
    setError('');
    setSuccess('');
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return setError('Please select a PDF file.');
    if (file.size !== null && file.size !== undefined && file.size > MAX_APPROVAL_PDF_SIZE_BYTES) return setError('Approval PDF must be 5 MB or smaller.');

    const session = await getCurrentSession();
    if (!session?.user) return setError('Please sign in again before uploading the approval PDF.');

    setUploading(true);
    let newStoragePath = '';
    try {
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_APPROVAL_PDF_SIZE_BYTES) {
        setError('Approval PDF must be 5 MB or smaller.');
        return;
      }

      newStoragePath = `${customerId}/${claimId}/work-approval/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
      const uploadResult = await supabase.storage.from('claim-documents').upload(newStoragePath, body, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (uploadResult.error) {
        setError('The approval PDF could not be uploaded. Please try again.');
        return;
      }

      const { data: inserted, error: insertError } = await supabase.from('claim_documents').insert({
        claim_id: claimId,
        customer_id: customerId,
        document_type: APPROVAL_DOCUMENT_TYPE,
        file_name: file.name,
        storage_bucket: 'claim-documents',
        storage_path: newStoragePath,
        mime_type: 'application/pdf',
        file_size: file.size ?? body.byteLength,
        uploaded_by: session.user.id,
      }).select('id,file_name,storage_bucket,storage_path').single();

      if (insertError || !inserted) {
        await supabase.storage.from('claim-documents').remove([newStoragePath]);
        setError('The approval PDF uploaded, but its claim document record could not be saved.');
        return;
      }

      const previous = document;
      setDocument(inserted as ApprovalDocumentRecord);
      setSuccess(previous ? 'Approval PDF replaced successfully.' : 'Approval PDF uploaded successfully.');

      if (previous) {
        const removeOldRecord = await (supabase as any).from('claim_documents').delete().eq('id', previous.id).eq('claim_id', claimId);
        if (!removeOldRecord.error && previous.storage_bucket && previous.storage_path) {
          await supabase.storage.from(previous.storage_bucket).remove([previous.storage_path]);
        } else if (removeOldRecord.error) {
          setError('The new approval PDF is saved, but the previous document record could not be cleaned up.');
        }
      }
    } catch {
      if (newStoragePath) await supabase.storage.from('claim-documents').remove([newStoragePath]);
      setError('The approval PDF could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removeApprovalPdf() {
    if (!document || uploading || removing) return;
    setConfirmRemove(false);
    setError('');
    setSuccess('');
    setRemoving(true);
    const current = document;
    try {
      const removeRecord = await (supabase as any).from('claim_documents').delete().eq('id', current.id).eq('claim_id', claimId);
      if (removeRecord.error) {
        setError('We could not remove the approval PDF. Please try again.');
        return;
      }
      if (current.storage_bucket && current.storage_path) {
        const storageResult = await supabase.storage.from(current.storage_bucket).remove([current.storage_path]);
        if (storageResult.error) setError('The approval PDF was removed from the claim, but storage cleanup could not be completed.');
      }
      setDocument(null);
      setSuccess('Approval PDF deleted successfully.');
    } finally {
      setRemoving(false);
    }
  }

  return <View style={styles.approvalUploadSection}>
    <View style={styles.approvalUploadHeadingRow}>
      <View style={styles.approvalUploadIcon}>
        <MaterialCommunityIcons name="file-pdf-box" size={22} color="#0A43A3" />
      </View>
      <View style={styles.approvalUploadHeadingCopy}>
        <Text style={styles.approvalUploadTitle}>Approval Document</Text>
        <Text style={styles.approvalUploadSubtitle}>Upload insurer approval in PDF format</Text>
      </View>
      {!loading && !document ? <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.approvalUploadButton}>
        <MaterialCommunityIcons name="upload" size={19} color="#FFFFFF" />
        <Text style={styles.approvalUploadButtonText}>{uploading ? 'Uploading PDF...' : 'Upload Approval PDF'}</Text>
      </Pressable> : null}
    </View>

    {loading ? <Text style={styles.approvalUploadLoading}>Checking saved approval PDF...</Text> : document ? <>
      <View style={styles.approvalUploadedCard}>
        <View style={styles.approvalUploadedFileIcon}>
          <MaterialCommunityIcons name="file-pdf-box" size={24} color="#168161" />
        </View>
        <View style={styles.approvalUploadedCopy}>
          <Text style={styles.approvalUploadedName} numberOfLines={1}>{document.file_name}</Text>
          <View style={styles.approvalUploadedStatusRow}>
            <MaterialCommunityIcons name="check-circle" size={13} color="#168161" />
            <Text style={styles.approvalUploadedStatus}>Uploaded</Text>
          </View>
        </View>
      </View>
      <View style={styles.approvalUploadActions}>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void viewApprovalPdf()} style={styles.approvalReplaceButton}>
          <MaterialCommunityIcons name="eye-outline" size={17} color="#0A43A3" />
          <Text style={styles.approvalReplaceText}>View</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.approvalReplaceButton}>
          <MaterialCommunityIcons name="refresh" size={17} color="#0A43A3" />
          <Text style={styles.approvalReplaceText}>{uploading ? 'Uploading...' : 'Replace'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => setConfirmRemove(true)} style={styles.approvalRemoveButton}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#C43232" />
          <Text style={styles.approvalRemoveText}>{removing ? 'Removing...' : 'Remove'}</Text>
        </Pressable>
      </View>
    </> : null}

    {success ? <View style={styles.approvalFeedbackSuccess}><MaterialCommunityIcons name="check-circle-outline" size={14} color="#168161" /><Text style={styles.approvalFeedbackSuccessText}>{success}</Text></View> : null}
    {error ? <View style={styles.approvalFeedbackError}><MaterialCommunityIcons name="alert-circle-outline" size={14} color="#B42318" /><Text style={styles.approvalFeedbackErrorText}>{error}</Text></View> : null}

    <Modal visible={confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(false)}>
      <View style={styles.approvalModalBackdrop}>
        <View accessibilityRole="alert" style={styles.approvalModalCard}>
          <View style={styles.approvalModalIcon}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#C43232" /></View>
          <Text style={styles.approvalModalTitle}>Delete approval PDF?</Text>
          <Text style={styles.approvalModalBody}>Are you sure you want to remove {document?.file_name ?? 'this approval PDF'} from the claim?</Text>
          <View style={styles.approvalModalActions}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(false)} style={styles.approvalModalCancel}><Text style={styles.approvalModalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={removing} onPress={() => void removeApprovalPdf()} style={styles.approvalModalDelete}><Text style={styles.approvalModalDeleteText}>{removing ? 'Deleting...' : 'Delete'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

function FinalBillUpload({ claimId, customerId }: { claimId: string; customerId: string }) {
  const [document, setDocument] = useState<ApprovalDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error: loadError } = await (supabase as any)
        .from('claim_documents')
        .select('id,file_name,storage_bucket,storage_path')
        .eq('claim_id', claimId)
        .eq('document_type', FINAL_BILL_DOCUMENT_TYPE)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (loadError) setError('We could not load the saved bill. Please try again.');
      else setDocument((data ?? null) as ApprovalDocumentRecord | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 2800);
    return () => clearTimeout(timer);
  }, [success]);

  async function viewBill() {
    if (!document?.storage_bucket || !document.storage_path || uploading || removing) return;
    setError('');
    try {
      const { data, error: signedUrlError } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
      if (signedUrlError || !data?.signedUrl) {
        setError('We could not open the bill. Please try again.');
        return;
      }
      const supported = await Linking.canOpenURL(data.signedUrl);
      if (!supported) {
        setError('This bill could not be opened on this device.');
        return;
      }
      await Linking.openURL(data.signedUrl);
    } catch {
      setError('We could not open the bill. Please try again.');
    }
  }

  async function chooseAndUpload() {
    if (uploading || removing) return;
    setError('');
    setSuccess('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    const lowerName = file.name.toLowerCase();
    const extension = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';
    const allowedExtension = ['pdf', 'jpg', 'jpeg', 'png'].includes(extension);
    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimeType ?? '');
    if (!allowedExtension && !allowedMime) return setError('Please select a PDF, JPG or PNG file.');
    if (file.size !== null && file.size !== undefined && file.size > MAX_FINAL_BILL_SIZE_BYTES) return setError('Selected bill file is too large. Please choose a smaller file.');
    const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension || (file.mimeType === 'application/pdf' ? 'pdf' : file.mimeType === 'image/png' ? 'png' : 'jpg');
    const contentType = normalizedExtension === 'pdf' ? 'application/pdf' : normalizedExtension === 'png' ? 'image/png' : 'image/jpeg';

    const session = await getCurrentSession();
    if (!session?.user) return setError('Please sign in again before uploading the bill.');

    setUploading(true);
    let newStoragePath = '';
    try {
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_FINAL_BILL_SIZE_BYTES) {
        setError('Selected bill file is too large. Please choose a smaller file.');
        return;
      }

      newStoragePath = `${customerId}/${claimId}/billing/${Date.now()}-${Math.random().toString(36).slice(2)}.${normalizedExtension}`;
      const uploadResult = await supabase.storage.from('claim-documents').upload(newStoragePath, body, {
        contentType,
        upsert: false,
      });
      if (uploadResult.error) {
        setError('The bill could not be uploaded. Please try again.');
        return;
      }

      const { data: inserted, error: insertError } = await supabase.from('claim_documents').insert({
        claim_id: claimId,
        customer_id: customerId,
        document_type: FINAL_BILL_DOCUMENT_TYPE,
        file_name: file.name,
        storage_bucket: 'claim-documents',
        storage_path: newStoragePath,
        mime_type: contentType,
        file_size: file.size ?? body.byteLength,
        uploaded_by: session.user.id,
      }).select('id,file_name,storage_bucket,storage_path').single();

      if (insertError || !inserted) {
        await supabase.storage.from('claim-documents').remove([newStoragePath]);
        setError('The bill uploaded, but its claim document record could not be saved.');
        return;
      }

      const previous = document;
      setDocument(inserted as ApprovalDocumentRecord);
      setSuccess(previous ? 'Bill replaced successfully.' : 'Bill uploaded successfully.');

      if (previous) {
        const removeOldRecord = await (supabase as any).from('claim_documents').delete().eq('id', previous.id).eq('claim_id', claimId);
        if (!removeOldRecord.error && previous.storage_bucket && previous.storage_path) {
          await supabase.storage.from(previous.storage_bucket).remove([previous.storage_path]);
        } else if (removeOldRecord.error) {
          setError('The new bill is saved, but the previous document record could not be cleaned up.');
        }
      }
    } catch {
      if (newStoragePath) await supabase.storage.from('claim-documents').remove([newStoragePath]);
      setError('The bill could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removeBill() {
    if (!document || uploading || removing) return;
    setConfirmRemove(false);
    setError('');
    setSuccess('');
    setRemoving(true);
    const current = document;
    try {
      const removeRecord = await (supabase as any).from('claim_documents').delete().eq('id', current.id).eq('claim_id', claimId);
      if (removeRecord.error) {
        setError('We could not remove the bill. Please try again.');
        return;
      }
      if (current.storage_bucket && current.storage_path) {
        const storageResult = await supabase.storage.from(current.storage_bucket).remove([current.storage_path]);
        if (storageResult.error) setError('The bill was removed from the claim, but storage cleanup could not be completed.');
      }
      setDocument(null);
      setSuccess('Bill deleted successfully.');
    } finally {
      setRemoving(false);
    }
  }

  return <View style={styles.approvalUploadSection}>
    <View style={styles.approvalUploadHeadingRow}>
      <View style={styles.approvalUploadIcon}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#0A43A3" />
      </View>
      <View style={styles.approvalUploadHeadingCopy}>
        <Text style={styles.approvalUploadTitle}>Bill Upload</Text>
        <Text style={styles.approvalUploadSubtitle}>Upload final workshop bill · PDF, JPG or PNG</Text>
      </View>
      {!loading && !document ? <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.approvalUploadButton}>
        <MaterialCommunityIcons name="upload" size={19} color="#FFFFFF" />
        <Text style={styles.approvalUploadButtonText}>{uploading ? 'Uploading...' : 'Choose File'}</Text>
      </Pressable> : null}
    </View>

    {loading ? <Text style={styles.approvalUploadLoading}>Checking saved bill...</Text> : document ? <>
      <View style={styles.approvalUploadedCard}>
        <View style={styles.approvalUploadedFileIcon}>
          <MaterialCommunityIcons name="file-document-check-outline" size={24} color="#168161" />
        </View>
        <View style={styles.approvalUploadedCopy}>
          <Text style={styles.approvalUploadedName} numberOfLines={1}>{document.file_name}</Text>
          <View style={styles.approvalUploadedStatusRow}>
            <MaterialCommunityIcons name="check-circle" size={13} color="#168161" />
            <Text style={styles.approvalUploadedStatus}>Uploaded</Text>
          </View>
        </View>
      </View>
      <View style={styles.approvalUploadActions}>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void viewBill()} style={styles.approvalReplaceButton}>
          <MaterialCommunityIcons name="eye-outline" size={17} color="#0A43A3" />
          <Text style={styles.approvalReplaceText}>View</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.approvalReplaceButton}>
          <MaterialCommunityIcons name="refresh" size={17} color="#0A43A3" />
          <Text style={styles.approvalReplaceText}>{uploading ? 'Uploading...' : 'Replace'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => setConfirmRemove(true)} style={styles.approvalRemoveButton}>
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#C43232" />
          <Text style={styles.approvalRemoveText}>{removing ? 'Removing...' : 'Remove'}</Text>
        </Pressable>
      </View>
    </> : null}

    {success ? <View style={styles.approvalFeedbackSuccess}><MaterialCommunityIcons name="check-circle-outline" size={14} color="#168161" /><Text style={styles.approvalFeedbackSuccessText}>{success}</Text></View> : null}
    {error ? <View style={styles.approvalFeedbackError}><MaterialCommunityIcons name="alert-circle-outline" size={14} color="#B42318" /><Text style={styles.approvalFeedbackErrorText}>{error}</Text></View> : null}

    <Modal visible={confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(false)}>
      <View style={styles.approvalModalBackdrop}>
        <View accessibilityRole="alert" style={styles.approvalModalCard}>
          <View style={styles.approvalModalIcon}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#C43232" /></View>
          <Text style={styles.approvalModalTitle}>Delete bill?</Text>
          <Text style={styles.approvalModalBody}>Are you sure you want to remove {document?.file_name ?? 'this bill'} from the claim?</Text>
          <View style={styles.approvalModalActions}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(false)} style={styles.approvalModalCancel}><Text style={styles.approvalModalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={removing} onPress={() => void removeBill()} style={styles.approvalModalDelete}><Text style={styles.approvalModalDeleteText}>{removing ? 'Deleting...' : 'Delete'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
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
  approvalUploadSection: { borderRadius: 14, borderWidth: 1, borderColor: '#D9E4F0', backgroundColor: '#F8FBFF', padding: 11 },
  approvalUploadHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  approvalUploadIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  approvalUploadHeadingCopy: { flex: 1, minWidth: 0 },
  approvalUploadTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' },
  approvalUploadSubtitle: { color: '#718198', fontSize: 8.7, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  approvalUploadLoading: { color: '#718198', fontSize: 9.5, fontWeight: '700', marginTop: 10 },
  approvalUploadButton: { minHeight: 38, borderRadius: 12, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, flexShrink: 0 },
  approvalUploadButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  approvalUploadedCard: { minHeight: 54, marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: '#A9DCC0', backgroundColor: '#EFFAF4', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  approvalUploadedFileIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DDF4E7', alignItems: 'center', justifyContent: 'center' },
  approvalUploadedCopy: { flex: 1, minWidth: 0 },
  approvalUploadedName: { color: palette.navy, fontSize: 10, fontWeight: '900' },
  approvalUploadedStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  approvalUploadedStatus: { color: '#168161', fontSize: 8.5, fontWeight: '900' },
  approvalUploadActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  approvalReplaceButton: { flex: 1, minHeight: 39, borderRadius: 11, borderWidth: 1, borderColor: '#AFC8E8', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  approvalReplaceText: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900' },
  approvalRemoveButton: { flex: 1, minHeight: 39, borderRadius: 11, borderWidth: 1, borderColor: '#F1B5B5', backgroundColor: '#FFF5F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  approvalRemoveText: { color: '#C43232', fontSize: 9.5, fontWeight: '900' },
  approvalFeedbackSuccess: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  approvalFeedbackSuccessText: { flex: 1, color: '#168161', fontSize: 8.5, lineHeight: 12, fontWeight: '800' },
  approvalFeedbackError: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  approvalFeedbackErrorText: { flex: 1, color: '#B42318', fontSize: 8.5, lineHeight: 12, fontWeight: '800' },
  approvalModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7, 24, 50, 0.48)', paddingHorizontal: 24 },
  approvalModalCard: { width: '100%', maxWidth: 340, borderRadius: 20, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  approvalModalIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  approvalModalTitle: { color: '#172033', fontSize: 17, lineHeight: 21, fontWeight: '900', textAlign: 'center' },
  approvalModalBody: { color: '#667085', fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center', marginTop: 7, paddingHorizontal: 4 },
  approvalModalActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 14 },
  approvalModalCancel: { flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  approvalModalCancelText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  approvalModalDelete: { flex: 1, minHeight: 43, borderRadius: 12, backgroundColor: '#C43232', alignItems: 'center', justifyContent: 'center' },
  approvalModalDeleteText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
});