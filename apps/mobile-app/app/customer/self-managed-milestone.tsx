import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

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
type ApprovalDocumentRecord = { id: string; document_type: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };
type BillDocumentRecord = { id: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };
type ApprovalDocumentKey = 'insurer' | 'surveyor' | 'bulk';
type ApprovalDeleteTarget = { key: ApprovalDocumentKey; label: string } | null;

const APPROVAL_DOCUMENT_TYPE = 'Approval PDF';
const SURVEYOR_APPROVAL_DOCUMENT_TYPE = 'Surveyor Approval / Report';
const WORK_APPROVAL_BULK_DOCUMENT_TYPE = 'Work Approval Attachment';
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

  if (key === 'work_approval') return <>
    <ClaimFormSection title="Stage Details" subtitle="Record approval and surveyor details" icon="clipboard-check-outline">
      <DateField label="Approval Received Date *" value={values.approval_received_date ?? ''} onChange={(v) => set('approval_received_date', v)} />
      <Gap /><ClaimChoice label="Cashless Claim *" value={values.cashless} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} onChange={(v) => set('cashless', v)} />
      <Gap /><TextField label="Surveyor Name (Optional)" value={values.surveyor_name ?? ''} onChangeText={(v) => set('surveyor_name', v)} />
      <Gap /><TextField label="Surveyor Phone (Optional)" value={values.surveyor_phone ?? ''} onChangeText={(v) => set('surveyor_phone', v)} keyboardType="phone-pad" />
      <Gap /><TextField label="Surveyor Email (Optional)" value={values.surveyor_email ?? ''} onChangeText={(v) => set('surveyor_email', v)} keyboardType="email-address" autoCapitalize="none" />
    </ClaimFormSection>
    {claimId && customerId ? <WorkApprovalPdfUpload claimId={claimId} customerId={customerId} /> : null}
  </>;

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
  const [documents, setDocuments] = useState<ApprovalDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApprovalDeleteTarget>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error: loadError } = await (supabase as any)
        .from('claim_documents')
        .select('id,document_type,file_name,storage_bucket,storage_path')
        .eq('claim_id', claimId)
        .in('document_type', [APPROVAL_DOCUMENT_TYPE, SURVEYOR_APPROVAL_DOCUMENT_TYPE, WORK_APPROVAL_BULK_DOCUMENT_TYPE])
        .order('created_at', { ascending: false });
      if (!active) return;
      if (loadError) setError('We could not load the saved Work Approval documents. Please try again.');
      else setDocuments((data ?? []) as ApprovalDocumentRecord[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 2800);
    return () => clearTimeout(timer);
  }, [success]);

  const insurerDocument = documents.find((item) => item.document_type === APPROVAL_DOCUMENT_TYPE) ?? null;
  const surveyorDocument = documents.find((item) => item.document_type === SURVEYOR_APPROVAL_DOCUMENT_TYPE) ?? null;
  const bulkDocuments = documents.filter((item) => item.document_type === WORK_APPROVAL_BULK_DOCUMENT_TYPE);

  async function uploadFile(documentType: string, file: DocumentPicker.DocumentPickerAsset) {
    const session = await getCurrentSession();
    if (!session?.user) return { ok: false, document: null as ApprovalDocumentRecord | null };
    const response = await fetch(file.uri);
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_APPROVAL_PDF_SIZE_BYTES) return { ok: false, document: null as ApprovalDocumentRecord | null };
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const storagePath = `${customerId}/${claimId}/work-approval/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, {
      contentType: file.mimeType ?? 'application/octet-stream',
      upsert: false,
    });
    if (uploadResult.error) return { ok: false, document: null as ApprovalDocumentRecord | null };
    const { data, error: insertError } = await supabase.from('claim_documents').insert({
      claim_id: claimId,
      customer_id: customerId,
      document_type: documentType,
      file_name: file.name,
      storage_bucket: 'claim-documents',
      storage_path: storagePath,
      mime_type: file.mimeType ?? null,
      file_size: file.size ?? body.byteLength,
      uploaded_by: session.user.id,
    }).select('id,document_type,file_name,storage_bucket,storage_path').single();
    if (insertError || !data) {
      await supabase.storage.from('claim-documents').remove([storagePath]);
      return { ok: false, document: null as ApprovalDocumentRecord | null };
    }
    return { ok: true, document: data as ApprovalDocumentRecord };
  }

  async function removeRows(rows: ApprovalDocumentRecord[]) {
    if (!rows.length) return true;
    const ids = rows.map((item) => item.id);
    const removeRecords = await (supabase as any).from('claim_documents').delete().in('id', ids).eq('claim_id', claimId);
    if (removeRecords.error) return false;
    const byBucket = new Map<string, string[]>();
    for (const item of rows) {
      if (!item.storage_bucket || !item.storage_path) continue;
      byBucket.set(item.storage_bucket, [...(byBucket.get(item.storage_bucket) ?? []), item.storage_path]);
    }
    for (const [bucket, paths] of byBucket) await supabase.storage.from(bucket).remove(paths);
    return true;
  }

  async function chooseSingle(key: 'insurer' | 'surveyor') {
    if (uploading || removing) return;
    setError('');
    setSuccess('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    if (file.size !== null && file.size !== undefined && file.size > MAX_APPROVAL_PDF_SIZE_BYTES) return setError(`${file.name} is larger than 5 MB. Please choose a smaller file.`);
    const documentType = key === 'insurer' ? APPROVAL_DOCUMENT_TYPE : SURVEYOR_APPROVAL_DOCUMENT_TYPE;
    const previous = key === 'insurer' ? insurerDocument : surveyorDocument;
    setUploading(true);
    try {
      const uploaded = await uploadFile(documentType, file);
      if (!uploaded.ok || !uploaded.document) return setError(`${file.name} could not be uploaded. Please try again.`);
      if (previous) await removeRows([previous]);
      setDocuments((current) => [uploaded.document!, ...current.filter((item) => item.id !== previous?.id)]);
      setSuccess(`${key === 'insurer' ? 'Insurer Approval Letter' : 'Surveyor Approval / Report'} ${previous ? 'replaced' : 'uploaded'} successfully.`);
    } catch {
      setError(`${file.name} could not be uploaded. Please try again.`);
    } finally {
      setUploading(false);
    }
  }

  async function chooseBulk() {
    if (uploading || removing) return;
    setError('');
    setSuccess('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const tooLarge = result.assets.find((file) => file.size !== null && file.size !== undefined && file.size > MAX_APPROVAL_PDF_SIZE_BYTES);
    if (tooLarge) return setError(`${tooLarge.name} is larger than 5 MB. Please choose smaller files.`);
    setUploading(true);
    const uploadedDocuments: ApprovalDocumentRecord[] = [];
    let failed = 0;
    try {
      for (const file of result.assets) {
        const uploaded = await uploadFile(WORK_APPROVAL_BULK_DOCUMENT_TYPE, file);
        if (uploaded.ok && uploaded.document) uploadedDocuments.push(uploaded.document);
        else failed += 1;
      }
      if (uploadedDocuments.length) setDocuments((current) => [...uploadedDocuments, ...current]);
      if (failed) setError(`${uploadedDocuments.length} of ${result.assets.length} documents were saved. Please retry the remaining ${failed}.`);
      else if (uploadedDocuments.length) setSuccess(`${uploadedDocuments.length} document${uploadedDocuments.length === 1 ? '' : 's'} uploaded successfully.`);
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || removing || uploading) return;
    setRemoving(true);
    setError('');
    setSuccess('');
    const target = deleteTarget;
    setDeleteTarget(null);
    const rows = target.key === 'insurer' ? (insurerDocument ? [insurerDocument] : []) : target.key === 'surveyor' ? (surveyorDocument ? [surveyorDocument] : []) : bulkDocuments;
    try {
      const removed = await removeRows(rows);
      if (!removed) return setError('We could not remove the selected Work Approval documents. Please try again.');
      const removedIds = new Set(rows.map((item) => item.id));
      setDocuments((current) => current.filter((item) => !removedIds.has(item.id)));
      setSuccess(`${target.label} deleted successfully.`);
    } finally {
      setRemoving(false);
    }
  }

  function DocumentTile({ title, subtitle, icon, document, tileKey }: { title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; document: ApprovalDocumentRecord | null; tileKey: 'insurer' | 'surveyor' }) {
    return <Pressable accessibilityRole="button" disabled={loading || uploading || removing} onPress={() => void chooseSingle(tileKey)} style={[styles.approvalDocumentTile, document && styles.approvalDocumentTileSaved]}>
      {document ? <View style={styles.approvalDocumentCheck}><MaterialCommunityIcons name="check" size={14} color="#168161" /></View> : null}
      {document ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={(event) => { event.stopPropagation(); setDeleteTarget({ key: tileKey, label: title }); }} style={styles.approvalDocumentRemove}><MaterialCommunityIcons name="close" size={13} color="#C43232" /></Pressable> : null}
      <View style={styles.approvalDocumentIcon}><MaterialCommunityIcons name={icon} size={26} color="#0A43A3" /></View>
      <Text style={styles.approvalDocumentTitle} numberOfLines={2}>{title}</Text>
      {document ? <Text style={styles.approvalDocumentFile} numberOfLines={1}>{document.file_name}</Text> : <Text style={styles.approvalDocumentSubtitle} numberOfLines={2}>{subtitle}</Text>}
      <Text style={[styles.approvalDocumentStatus, document && styles.approvalDocumentStatusSaved]}>{document ? 'Saved · Tap to replace' : 'Tap to upload'}</Text>
    </Pressable>;
  }

  return <View style={styles.approvalDocumentsCard}>
    <View style={styles.approvalDocumentsHeader}>
      <View style={styles.approvalDocumentsHeaderIcon}><MaterialCommunityIcons name="file-document-multiple-outline" size={20} color="#0A43A3" /></View>
      <View style={styles.approvalDocumentsHeaderCopy}>
        <Text style={styles.approvalDocumentsTitle}>Approval Documents</Text>
        <Text style={styles.approvalDocumentsSubtitle}>Upload approval letters, surveyor reports or supporting documents.</Text>
      </View>
      <View style={styles.approvalDocumentsBadge}><Text style={styles.approvalDocumentsBadgeText}>Optional</Text></View>
    </View>

    {loading ? <Text style={styles.approvalUploadLoading}>Checking saved approval documents...</Text> : <>
      <View style={styles.approvalDocumentGrid}>
        <DocumentTile title="Insurer Approval Letter" subtitle="Approval letter or insurer mail" icon="file-certificate-outline" document={insurerDocument} tileKey="insurer" />
        <DocumentTile title="Surveyor Approval / Report" subtitle="Surveyor approval or report" icon="clipboard-check-outline" document={surveyorDocument} tileKey="surveyor" />
      </View>

      <View style={styles.approvalBulkShell}>
        <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseBulk()} style={[styles.approvalBulkUpload, bulkDocuments.length > 0 && styles.approvalBulkUploadSaved]}>
          <View style={[styles.approvalBulkIcon, bulkDocuments.length > 0 && styles.approvalBulkIconSaved]}><MaterialCommunityIcons name={bulkDocuments.length > 0 ? 'check' : 'file-multiple-outline'} size={20} color={bulkDocuments.length > 0 ? '#168161' : '#0A43A3'} /></View>
          <View style={styles.approvalBulkCopy}>
            <Text style={styles.approvalBulkTitle}>Upload Multiple Documents</Text>
            <Text style={styles.approvalBulkText}>{bulkDocuments.length > 0 ? `${bulkDocuments.length} file${bulkDocuments.length === 1 ? '' : 's'} saved · Tap again to add more` : 'Select several files now, or tap again later to add more.'}</Text>
          </View>
          {!bulkDocuments.length ? <MaterialCommunityIcons name="plus-circle-outline" size={21} color="#0A43A3" /> : null}
        </Pressable>
        {bulkDocuments.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Remove all Work Approval bulk documents" disabled={uploading || removing} onPress={() => setDeleteTarget({ key: 'bulk', label: 'Uploaded documents' })} style={styles.approvalBulkRemove}><MaterialCommunityIcons name="close" size={14} color="#C43232" /></Pressable> : null}
      </View>
    </>}

    <Text style={styles.approvalDocumentsNote}>PDF and image files up to 5 MB each. Selected files upload immediately to Claim Documents.</Text>
    {success ? <View style={styles.approvalFeedbackSuccess}><MaterialCommunityIcons name="check-circle-outline" size={14} color="#168161" /><Text style={styles.approvalFeedbackSuccessText}>{success}</Text></View> : null}
    {error ? <View style={styles.approvalFeedbackError}><MaterialCommunityIcons name="alert-circle-outline" size={14} color="#B42318" /><Text style={styles.approvalFeedbackErrorText}>{error}</Text></View> : null}

    <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
      <View style={styles.approvalModalBackdrop}>
        <View accessibilityRole="alert" style={styles.approvalModalCard}>
          <View style={styles.approvalModalIcon}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#C43232" /></View>
          <Text style={styles.approvalModalTitle}>Delete document?</Text>
          <Text style={styles.approvalModalBody}>{deleteTarget ? `Are you sure you want to delete ${deleteTarget.label}?` : ''}</Text>
          <View style={styles.approvalModalActions}>
            <Pressable accessibilityRole="button" onPress={() => setDeleteTarget(null)} style={styles.approvalModalCancel}><Text style={styles.approvalModalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={removing} onPress={() => void confirmDelete()} style={styles.approvalModalDelete}><Text style={styles.approvalModalDeleteText}>{removing ? 'Deleting...' : 'Delete'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}


function FinalBillUpload({ claimId, customerId }: { claimId: string; customerId: string }) {
  const [document, setDocument] = useState<BillDocumentRecord | null>(null);
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
      else setDocument((data ?? null) as BillDocumentRecord | null);
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
      if (signedUrlError || !data?.signedUrl) return setError('We could not open the bill. Please try again.');
      const supported = await Linking.canOpenURL(data.signedUrl);
      if (!supported) return setError('This bill could not be opened on this device.');
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
      if (body.byteLength > MAX_FINAL_BILL_SIZE_BYTES) return setError('Selected bill file is too large. Please choose a smaller file.');

      newStoragePath = `${customerId}/${claimId}/billing/${Date.now()}-${Math.random().toString(36).slice(2)}.${normalizedExtension}`;
      const uploadResult = await supabase.storage.from('claim-documents').upload(newStoragePath, body, { contentType, upsert: false });
      if (uploadResult.error) return setError('The bill could not be uploaded. Please try again.');

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
        return setError('The bill uploaded, but its claim document record could not be saved.');
      }

      const previous = document;
      setDocument(inserted as BillDocumentRecord);
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
      if (removeRecord.error) return setError('We could not remove the bill. Please try again.');
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

  return <View>
    <Text style={styles.billUploadLabel}>Bill Upload</Text>
    <View style={[styles.billUploadBox, document && styles.billUploadBoxSaved]}>
      <View style={[styles.billUploadIcon, document && styles.billUploadIconSaved]}>
        <MaterialCommunityIcons name={document ? 'file-document-check-outline' : 'cloud-upload-outline'} size={22} color={document ? '#168161' : '#0A43A3'} />
      </View>
      <View style={styles.billUploadCopy}>
        <Text style={styles.billUploadTitle}>{document ? document.file_name : 'Upload final workshop bill'}</Text>
        <Text style={styles.billUploadFormats}>{document ? 'Uploaded' : 'PDF, JPG, PNG'}</Text>
      </View>
      {!loading && !document ? <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.billUploadChooseButton}>
        <Text style={styles.billUploadChooseText}>{uploading ? 'Uploading...' : 'Choose File'}</Text>
      </Pressable> : null}
      {loading ? <Text style={styles.billUploadLoading}>Checking...</Text> : null}
    </View>

    {document ? <View style={styles.billUploadActions}>
      <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void viewBill()} style={styles.billUploadSecondaryButton}><MaterialCommunityIcons name="eye-outline" size={16} color="#0A43A3" /><Text style={styles.billUploadSecondaryText}>View</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.billUploadSecondaryButton}><MaterialCommunityIcons name="refresh" size={16} color="#0A43A3" /><Text style={styles.billUploadSecondaryText}>{uploading ? 'Uploading...' : 'Replace'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => setConfirmRemove(true)} style={styles.billUploadRemoveButton}><MaterialCommunityIcons name="trash-can-outline" size={15} color="#C43232" /><Text style={styles.billUploadRemoveText}>{removing ? 'Removing...' : 'Remove'}</Text></Pressable>
    </View> : null}

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
  approvalDocumentsCard: { borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', padding: 12, marginBottom: 12, shadowColor: '#14375F', shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  approvalDocumentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 },
  approvalDocumentsHeaderIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  approvalDocumentsHeaderCopy: { flex: 1, minWidth: 0 },
  approvalDocumentsTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  approvalDocumentsSubtitle: { color: '#6D7B8F', fontSize: 9.2, lineHeight: 13, fontWeight: '600', marginTop: 2 },
  approvalDocumentsBadge: { borderRadius: 999, backgroundColor: '#EEF5FF', paddingHorizontal: 9, paddingVertical: 5 },
  approvalDocumentsBadgeText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900' },
  approvalDocumentGrid: { flexDirection: 'row', gap: 8 },
  approvalDocumentTile: { position: 'relative', flex: 1, minWidth: 0, minHeight: 122, borderRadius: 14, backgroundColor: '#F7FAFF', borderWidth: 1.5, borderColor: '#E2EAF4', paddingVertical: 9, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  approvalDocumentTileSaved: { backgroundColor: '#EFFAF4', borderColor: '#52B57F' },
  approvalDocumentCheck: { position: 'absolute', top: 5, left: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(46,173,99,0.16)', alignItems: 'center', justifyContent: 'center' },
  approvalDocumentRemove: { position: 'absolute', top: 5, right: 5, zIndex: 3, width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
  approvalDocumentIcon: { width: 45, height: 45, borderRadius: 13, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  approvalDocumentTitle: { color: palette.navy, fontSize: 9.2, lineHeight: 12, fontWeight: '900', textAlign: 'center', marginTop: 5 },
  approvalDocumentSubtitle: { color: '#718198', fontSize: 7.7, lineHeight: 10, fontWeight: '600', textAlign: 'center', marginTop: 3 },
  approvalDocumentFile: { maxWidth: '100%', color: '#56657A', fontSize: 7.5, lineHeight: 10, fontWeight: '700', textAlign: 'center', marginTop: 3 },
  approvalDocumentStatus: { color: '#7A8799', fontSize: 7.7, fontWeight: '800', marginTop: 4 },
  approvalDocumentStatusSaved: { color: '#168161' },
  approvalBulkShell: { position: 'relative' },
  approvalBulkUpload: { minHeight: 58, marginTop: 10, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#AFC8E8', backgroundColor: '#F7FAFF', paddingHorizontal: 10, paddingRight: 38, flexDirection: 'row', alignItems: 'center', gap: 9 },
  approvalBulkUploadSaved: { borderStyle: 'solid', borderColor: '#52B57F', backgroundColor: '#EFFAF4' },
  approvalBulkIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  approvalBulkIconSaved: { backgroundColor: 'rgba(46,173,99,0.14)' },
  approvalBulkCopy: { flex: 1, minWidth: 0 },
  approvalBulkTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  approvalBulkText: { color: '#718198', fontSize: 8.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  approvalBulkRemove: { position: 'absolute', top: 15, right: 7, zIndex: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
  approvalDocumentsNote: { color: '#7A8799', fontSize: 8, lineHeight: 11, fontWeight: '600', marginTop: 8 },
  billUploadLabel: { color: palette.navy, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  billUploadBox: { minHeight: 58, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#7EA8E8', backgroundColor: '#F9FBFF', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  billUploadBoxSaved: { borderStyle: 'solid', borderColor: '#52B57F', backgroundColor: '#EFFAF4' },
  billUploadIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  billUploadIconSaved: { backgroundColor: '#DDF4E7' },
  billUploadCopy: { flex: 1, minWidth: 0 },
  billUploadTitle: { color: palette.navy, fontSize: 10.5, lineHeight: 14, fontWeight: '900' },
  billUploadFormats: { color: '#718198', fontSize: 8.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  billUploadChooseButton: { minHeight: 36, borderRadius: 9, backgroundColor: '#0A43A3', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  billUploadChooseText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  billUploadLoading: { color: '#718198', fontSize: 8.5, fontWeight: '800' },
  billUploadActions: { flexDirection: 'row', gap: 7, marginTop: 7 },
  billUploadSecondaryButton: { flex: 1, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#AFC8E8', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  billUploadSecondaryText: { color: '#0A43A3', fontSize: 9, fontWeight: '900' },
  billUploadRemoveButton: { flex: 1, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#F1B5B5', backgroundColor: '#FFF5F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  billUploadRemoveText: { color: '#C43232', fontSize: 9, fontWeight: '900' },
  approvalUploadLoading: { color: '#718198', fontSize: 9.5, fontWeight: '700', marginTop: 10 },
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