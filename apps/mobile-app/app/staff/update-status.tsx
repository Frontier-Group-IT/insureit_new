import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { documentDrivenStatusFor, finalClaimDocuments } from '@/lib/claim-documents';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { canUpdateClaimStage } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimStatus, InsuranceCompany } from '@/lib/types';

type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };

type ActionCopy = { title: string; body: string; buttonLabel: string; nextStatus?: ClaimStatus; historyNote: string };

export default function UpdateStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [insuranceCompany, setInsuranceCompany] = useState<InsuranceCompany | null>(null);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [surveyorName, setSurveyorName] = useState('');
  const [surveyorPhone, setSurveyorPhone] = useState('');
  const [surveyorEmail, setSurveyorEmail] = useState('');
  const [finalSurveyorName, setFinalSurveyorName] = useState('');
  const [finalSurveyorPhone, setFinalSurveyorPhone] = useState('');
  const [finalSurveyorEmail, setFinalSurveyorEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFinalDocumentTypes, setSelectedFinalDocumentTypes] = useState<string[]>([]);
  const [surveyorReport, setSurveyorReport] = useState<PickedFile | null>(null);
  const [finalSurveyorReport, setFinalSurveyorReport] = useState<PickedFile | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<PickedFile | null>(null);
  const [assessmentReport, setAssessmentReport] = useState<PickedFile | null>(null);
  const [paymentAdvice, setPaymentAdvice] = useState<PickedFile | null>(null);
  const [partsAmount, setPartsAmount] = useState('');
  const [labourAmount, setLabourAmount] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [doAmount, setDoAmount] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [tdsAmount, setTdsAmount] = useState('');
  const [gstTdsAmount, setGstTdsAmount] = useState('');
  const [utrNo, setUtrNo] = useState('');
  const [message, setMessage] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const profile = await getProfile(session.user.id);
    if (!isValidProfile(profile) || !canUpdateClaimStage(profile.role)) {
      setMessage('Status updates are restricted to the claims manager and claim processor.');
      setLoading(false);
      return;
    }
    setAuthorized(true);
    const [claimResult, documentsResult] = await Promise.all([
      supabase.from('claims').select('*').eq('id', id).maybeSingle(),
      supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
    ]);
    const nextDocuments = documentsResult.data ?? [];
    const nextClaim = claimResult.data ? await reconcileDocumentStage(claimResult.data, nextDocuments, session.user.id) : null;
    setClaim(nextClaim);
    setDocuments(nextDocuments);
    if (nextClaim?.insurance_company_id) {
      const { data } = await supabase.from('insurance_companies').select('*').eq('id', nextClaim.insurance_company_id).maybeSingle();
      setInsuranceCompany(data);
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  const action = useMemo(() => claim ? actionForStatus(claim.current_status) : null, [claim]);
  const raTotal = numeric(partsAmount) + numeric(labourAmount) + numeric(gstAmount);
  const paymentDifference = numeric(billAmount) - numeric(doAmount);

  async function updateClaimStatus(nextStatus: ClaimStatus, historyNotes: string, nextRoute: 'detail' | 'action' = 'detail') {
    setMessage('');
    if (!claim) return;
    setSaving(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const profile = await getProfile(session.user.id);
      if (!isValidProfile(profile) || !canUpdateClaimStage(profile.role)) {
        setMessage('Status updates are restricted to the claims manager and claim processor.');
        return;
      }
      const fromStatus = claim.current_status;
      const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
      if (error) {
        setMessage(`We could not update this claim. ${error.message}`);
        return;
      }
      try {
        await recordClaimEvent({
          claimId: claim.id,
          customerId: claim.customer_id,
          fromStatus,
          toStatus: nextStatus,
          notes: historyNotes,
          changedBy: session.user.id,
          title: `Claim ${claim.claim_no} updated`,
        });
      } catch {
        setMessage('Claim status changed, but the timeline notification could not be saved. Check notification migrations/RLS.');
        return;
      }
      router.replace({ pathname: nextRoute === 'action' ? '/staff/update-status' : '/staff/claim-detail', params: { id: claim.id } });
    } finally {
      setSaving(false);
    }
  }

  async function saveStageDetails(stage: ClaimStatus, details: Record<string, string | number | null>) {
    if (!claim) return;
    const session = await getCurrentSession();
    const { error } = await supabase.from('claim_stage_details').insert({
      claim_id: claim.id,
      stage,
      details,
      created_by: session?.user.id ?? null,
    });
    if (error) throw new Error(error.message);
  }

  async function trySaveStageDetails(stage: ClaimStatus, details: Record<string, string | number | null>) {
    try {
      await saveStageDetails(stage, details);
    } catch (error) {
      console.warn(`${stage} details could not be saved to claim_stage_details`, error);
    }
  }
  async function appointSurveyor() {
    if (!surveyorName.trim()) return setMessage('Enter the surveyor name before appointing.');
    if (!surveyorEmail.trim()) return setMessage('Enter the surveyor email ID before appointing.');
    setMessage('');
    setSaving(true);
    try {
      const contact = surveyorPhone.trim() ? ` (${surveyorPhone.trim()})` : '';
      await saveStageDetails('Surveyor Appointed', { name: surveyorName.trim(), mobile: surveyorPhone.trim(), email: surveyorEmail.trim() });
      await updateClaimStatus('Surveyor Appointed', `Surveyor appointed: ${surveyorName.trim()}${contact}. Email: ${surveyorEmail.trim()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Surveyor details could not be saved: ${error.message}` : 'Surveyor details could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function pickFile(setter: (file: PickedFile) => void, type: string[] = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type, copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setter({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null });
    }
  }

  async function uploadWorkflowDocument(documentType: string, file: PickedFile) {
    if (!claim) throw new Error('Claim is not loaded.');
    const session = await getCurrentSession();
    if (!session?.user) throw new Error('Session expired.');
    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const slug = documentType.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const storagePath = `${claim.customer_id}/${claim.id}/${slug}-${Date.now()}.${extension}`;
    const response = await fetch(file.uri);
    const body = await response.arrayBuffer();
    const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
    if (uploadResult.error) throw uploadResult.error;
    const insertResult = await supabase.from('claim_documents').insert({
      claim_id: claim.id,
      customer_id: claim.customer_id,
      document_type: documentType,
      file_name: file.name,
      storage_bucket: 'claim-documents',
      storage_path: storagePath,
      mime_type: file.mimeType,
      file_size: file.size,
      uploaded_by: session.user.id,
    }).select('*').single();
    if (insertResult.error) throw insertResult.error;
    setDocuments((current) => [insertResult.data, ...current]);
    return insertResult.data;
  }

  async function uploadSurveyReport() {
    setMessage('');
    if (!claim || !surveyorReport) return setMessage('Attach the surveyor report before marking inspection complete.');
    setSaving(true);
    try {
      await uploadWorkflowDocument('Surveyor report', surveyorReport);
      await updateClaimStatus('Vehicle Inspected', notes.trim() || 'Surveyor report uploaded and vehicle inspection recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Surveyor report could not be uploaded.');
    } finally {
      setSaving(false);
    }
  }

  async function requestFinalDocuments() {
    if (!claim) return;
    if (!selectedFinalDocumentTypes.length) return setMessage('Select at least one final document to request.');
    setMessage('');
    setSaving(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const selectedDocuments = finalClaimDocuments.filter((document) => selectedFinalDocumentTypes.includes(document.type));
      const closeExisting = await supabase
        .from('claim_tasks')
        .update({ status: 'cancelled' })
        .eq('claim_id', claim.id)
        .eq('status', 'open')
        .like('title', 'Final document: %');
      if (closeExisting.error) throw closeExisting.error;
      const requestResult = await supabase.from('claim_tasks').insert(selectedDocuments.map((document) => ({
        claim_id: claim.id,
        title: `Final document: ${document.type}`,
        description: document.body,
        status: 'open' as const,
        created_by: session.user.id,
      })));
      if (requestResult.error) throw requestResult.error;
      await updateClaimStatus('Final Documents Awaited', notes.trim() || `${selectedDocuments.length} final document${selectedDocuments.length === 1 ? '' : 's'} requested from customer.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Final document request could not be saved: ${error.message}` : 'Final document request could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function toggleFinalDocument(documentType: string) {
    setSelectedFinalDocumentTypes((current) => current.includes(documentType)
      ? current.filter((type) => type !== documentType)
      : [...current, documentType]);
  }

  async function draftClaimIntimationEmail() {
    if (!claim) return;
    const insurerEmail = insuranceCompany?.contact_email?.trim();
    if (!insurerEmail) return setMessage('Add insurer email ID in insurance company details before drafting intimation.');
    setSaving(true);
    try {
      const finalTypes = new Set(finalClaimDocuments.map((document) => document.type));
      const finalDocuments = documents.filter((document) => finalTypes.has(document.document_type) && document.verification_status === 'verified');
      const links = await Promise.all(finalDocuments.map(async (document) => {
        const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 86_400);
        return `${document.document_type}: ${data?.signedUrl ?? document.file_name}`;
      }));
      const subject = `Claim Intimation - ${claim.claim_no}`;
      const body = [
        `Dear ${insuranceCompany?.name ?? 'Insurer'} Team,`,
        '',
        `Please find the claim intimation details for claim ${claim.claim_no}.`,
        '',
        `Insured vehicle claim documents received and verified by our claim desk:`,
        links.length ? links.join('\n') : 'Verified final document links are not available.',
        '',
        notes.trim() ? `Manager note: ${notes.trim()}` : '',
        '',
        'Regards,',
        'InsureIT Claim Desk',
      ].filter((line, index, lines) => line || lines[index - 1] !== '').join('\n');
      try {
        await Linking.openURL(`mailto:${encodeURIComponent(insurerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      } catch (error) {
        console.warn('Claim intimation mail draft could not be opened', error);
      }
      try {
        await saveStageDetails('Claim Intimation', { insurerEmail, subject, documentCount: finalDocuments.length, note: notes.trim() || null });
      } catch (error) {
        console.warn('Claim intimation details could not be saved', error);
      }
      await updateClaimStatus('Claim Intimation', 'Claim intimation email drafted with verified final document links.', 'action');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim intimation email could not be drafted.');
    } finally {
      setSaving(false);
    }
  }

  async function saveFinalSurveyorDetails() {
    const name = finalSurveyorName.trim();
    const mobile = finalSurveyorPhone.trim();
    const email = finalSurveyorEmail.trim();
    if (!name) return setMessage('Enter the final surveyor name.');
    if (!mobile) return setMessage('Enter the final surveyor mobile number.');
    if (!email) return setMessage('Enter the final surveyor email ID.');

    const historyNote = `Final surveyor shared: ${name}, ${mobile}, ${email}.`;
    try {
      await saveStageDetails('Final Surveyor Details', { name, mobile, email });
    } catch (error) {
      console.warn('Final surveyor details could not be saved to claim_stage_details', error);
    }
    await updateClaimStatus('Final Surveyor Details', historyNote, 'action');
  }

  async function completeFinalSurveyorReport() {
    if (!finalSurveyorReport) return setMessage('Attach the final surveyor report before completing work approval.');
    setSaving(true);
    try {
      const uploaded = await uploadWorkflowDocument('Final surveyor report', finalSurveyorReport);
      await saveStageDetails('Work Approval Received', { finalSurveyorReport: uploaded.file_name });
      await updateClaimStatus('Work Approval Received', 'Final surveyor report uploaded. Work approval received.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Final surveyor report could not be uploaded.');
    } finally {
      setSaving(false);
    }
  }
  async function completeRaIntimation() {
    if (!invoiceFile || !partsAmount.trim() || !labourAmount.trim() || !gstAmount.trim()) return setMessage('Upload the invoice and complete parts, labour, and GST amounts.');
    setSaving(true);
    try {
      const uploaded = await uploadWorkflowDocument('RA invoice', invoiceFile);
      await trySaveStageDetails('RA Intimation', { partsAmount: numeric(partsAmount), labourAmount: numeric(labourAmount), gstAmount: numeric(gstAmount), totalAmount: raTotal, invoice: uploaded.file_name });
      await updateClaimStatus('RA Intimation Done', `RA intimation done. Total amount: INR ${raTotal}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'RA intimation could not be completed.');
    } finally {
      setSaving(false);
    }
  }

  async function completeDoStatus() {
    if (!assessmentReport) return setMessage('Attach the assessment report.');
    if (!doAmount.trim()) return setMessage('Enter the DO amount.');
    setSaving(true);
    try {
      const uploaded = await uploadWorkflowDocument('Assessment report', assessmentReport);
      await trySaveStageDetails('DO Status', { doAmount: numeric(doAmount), assessmentReport: uploaded.file_name });
      await updateClaimStatus('Payment Stage', `DO status submitted. DO amount: INR ${numeric(doAmount)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'DO status could not be completed.');
    } finally {
      setSaving(false);
    }
  }

  async function completePaymentStage() {
    if (!paymentAdvice || !doAmount.trim() || !billAmount.trim()) return setMessage('Enter DO amount, bill amount, and attach payment advice.');
    setSaving(true);
    try {
      const uploaded = await uploadWorkflowDocument('Payment advice', paymentAdvice);
      await trySaveStageDetails('Payment Stage', { doAmount: numeric(doAmount), billAmount: numeric(billAmount), differenceAmount: paymentDifference, paymentAdvice: uploaded.file_name });
      await updateClaimStatus('Claim Complete', `Payment stage completed. Difference amount: INR ${paymentDifference}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment stage could not be completed.');
    } finally {
      setSaving(false);
    }
  }

  async function closeClaim() {
    if (!receivedAmount.trim() || !tdsAmount.trim() || !gstTdsAmount.trim() || !utrNo.trim()) return setMessage('Enter received amount, TDS, GST TDS, and UTR number before closing.');
    try {
      await trySaveStageDetails('Claim Complete', { receivedAmount: numeric(receivedAmount), tdsAmount: numeric(tdsAmount), gstTdsAmount: numeric(gstTdsAmount), utrNo: utrNo.trim() });
      await updateClaimStatus('Closed', `Claim closed. Received INR ${numeric(receivedAmount)}. UTR: ${utrNo.trim()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Claim completion details could not be saved.');
    }
  }

  if (loading) return <Screen title="Claim Action"><LoadingState /></Screen>;

  return (
    <Screen title="Claim Action" subtitle="Controlled claim workflow" showLogout>
      {message ? <Message type="error">{message}</Message> : null}
      {!authorized ? (
        <Card><Button label="Back" variant="secondary" onPress={() => router.back()} /></Card>
      ) : null}
      {authorized && claim ? (
        <>
          <Card style={styles.claimHeaderCard}>
            <View style={styles.headerRow}>
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons name="transit-connection-variant" size={23} color={roleTheme.ops.accent} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.claimNo}>{claim.claim_no}</Text>
                <Text style={styles.helperText}>Only the next valid workflow action is available.</Text>
              </View>
              <AppBadge label={claim.current_status} tone="info" />
            </View>
          </Card>

          <Card style={styles.workflowCard}>
            <View style={styles.actionHeader}>
              <View style={styles.actionIcon}>
                <MaterialCommunityIcons name={action?.nextStatus ? 'arrow-decision-outline' : 'timer-sand'} size={22} color={roleTheme.ops.accent} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.actionLabel}>Next allowed action</Text>
                <Text style={styles.actionTitle}>{action?.title ?? 'No action required'}</Text>
              </View>
            </View>
            <Text style={styles.bodyText}>{action?.body ?? 'This claim is waiting for another user or the journey is complete.'}</Text>

            {claim.current_status === 'Initial Documents Verified' ? (
              <>
                <TextField label="Surveyor name" value={surveyorName} onChangeText={setSurveyorName} />
                <TextField label="Surveyor phone" value={surveyorPhone} onChangeText={setSurveyorPhone} />
                <TextField label="Surveyor Email ID" value={surveyorEmail} onChangeText={setSurveyorEmail} keyboardType="email-address" autoCapitalize="none" />
                <Button label={saving ? 'Appointing...' : 'Appoint surveyor'} onPress={() => void appointSurveyor()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'Surveyor Appointed' ? (
              <>
                <Row label="Attached survey reports" value={`${documents.filter((document) => document.document_type === 'Surveyor report').length}`} />
                <Button label={surveyorReport ? surveyorReport.name : 'Attach surveyor report'} variant="secondary" onPress={() => void pickFile(setSurveyorReport)} />
                <TextField label="Inspection notes" value={notes} onChangeText={setNotes} multiline />
                <Button label={saving ? 'Saving...' : 'Mark vehicle inspected'} onPress={() => void uploadSurveyReport()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'Vehicle Inspected' ? (
              <>
                <Text style={styles.documentSelectionHint}>Select only the files required for this claim. The customer will see this exact list.</Text>
                <View style={styles.documentSelectionList}>
                  {finalClaimDocuments.map((document) => {
                    const selected = selectedFinalDocumentTypes.includes(document.type);
                    return (
                      <Pressable key={document.type} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleFinalDocument(document.type)} style={[styles.documentSelectionRow, selected && styles.documentSelectionRowSelected]}>
                        <MaterialCommunityIcons name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={selected ? roleTheme.ops.accent : palette.muted} />
                        <View style={styles.documentSelectionCopy}>
                          <Text style={styles.documentSelectionTitle}>{document.title}</Text>
                          <Text style={styles.documentSelectionBody}>{document.body}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <TextField label="Request notes" value={notes} onChangeText={setNotes} multiline />
                <Button label={saving ? 'Requesting...' : `Request ${selectedFinalDocumentTypes.length || ''} final document${selectedFinalDocumentTypes.length === 1 ? '' : 's'}`} onPress={() => void requestFinalDocuments()} disabled={saving || !selectedFinalDocumentTypes.length} />
              </>
            ) : null}

            {claim.current_status === 'Final Documents Verified' ? (
              <>
                <TextField label="Email draft note" value={notes} onChangeText={setNotes} multiline />
                <Button label={saving ? 'Opening email...' : 'Claim Intimation'} onPress={() => void draftClaimIntimationEmail()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'Claim Intimation' ? (
              <>
                <TextField label="Final surveyor name" value={finalSurveyorName} onChangeText={setFinalSurveyorName} />
                <TextField label="Final surveyor mobile" value={finalSurveyorPhone} onChangeText={setFinalSurveyorPhone} keyboardType="phone-pad" />
                <TextField label="Final surveyor email" value={finalSurveyorEmail} onChangeText={setFinalSurveyorEmail} keyboardType="email-address" autoCapitalize="none" />
                <Button label={saving ? 'Saving...' : 'Save Final Surveyor Details'} onPress={() => void saveFinalSurveyorDetails()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'Final Surveyor Details' ? (
              <>
                <Text style={styles.uploadPrompt}>Attach the final surveyor report to complete work approval.</Text>
                <Button label={finalSurveyorReport ? finalSurveyorReport.name : 'Upload final surveyor report'} variant="secondary" onPress={() => void pickFile(setFinalSurveyorReport)} disabled={saving} />
                <View style={styles.actionGap} />
                <Button label={saving ? 'Completing work approval...' : 'Work Approval Done'} onPress={() => void completeFinalSurveyorReport()} disabled={saving || !finalSurveyorReport} />
              </>
            ) : null}
            {claim.current_status === 'RA Intimation' ? (
              <>
                <Button label={invoiceFile ? invoiceFile.name : 'Upload invoice'} variant="secondary" onPress={() => void pickFile(setInvoiceFile)} />
                <TextField label="Parts amount" value={partsAmount} onChangeText={setPartsAmount} keyboardType="numeric" />
                <TextField label="Labour amount" value={labourAmount} onChangeText={setLabourAmount} keyboardType="numeric" />
                <TextField label="GST" value={gstAmount} onChangeText={setGstAmount} keyboardType="numeric" />
                <Row label="Total" value={`INR ${raTotal}`} />
                <Button label={saving ? 'Saving...' : 'RA Intimation Done'} onPress={() => void completeRaIntimation()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'DO Status' ? (
              <>
                <Button label={assessmentReport ? assessmentReport.name : 'Upload assessment report'} variant="secondary" onPress={() => void pickFile(setAssessmentReport)} />
                <TextField label="DO amount" value={doAmount} onChangeText={setDoAmount} keyboardType="numeric" />
                <Button label={saving ? 'Saving...' : 'Submit DO Status'} onPress={() => void completeDoStatus()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'Payment Stage' ? (
              <>
                <TextField label="DO amount" value={doAmount} onChangeText={setDoAmount} keyboardType="numeric" />
                <TextField label="Bill amount" value={billAmount} onChangeText={setBillAmount} keyboardType="numeric" />
                <Row label="Difference amount" value={`INR ${paymentDifference}`} />
                <Button label={paymentAdvice ? paymentAdvice.name : 'Upload payment advice PDF'} variant="secondary" onPress={() => void pickFile(setPaymentAdvice, ['application/pdf'])} />
                <Button label={saving ? 'Saving...' : 'Complete payment stage'} onPress={() => void completePaymentStage()} disabled={saving} />
              </>
            ) : null}

            {claim.current_status === 'Claim Completion In Progress' || claim.current_status === 'Claim Complete' ? (
              <>
                <TextField label="Received amount" value={receivedAmount} onChangeText={setReceivedAmount} keyboardType="numeric" />
                <TextField label="TDS" value={tdsAmount} onChangeText={setTdsAmount} keyboardType="numeric" />
                <TextField label="GST TDS" value={gstTdsAmount} onChangeText={setGstTdsAmount} keyboardType="numeric" />
                <TextField label="UTR no." value={utrNo} onChangeText={setUtrNo} autoCapitalize="characters" />
                <Button label={saving ? 'Closing...' : 'Close claim'} onPress={() => void closeClaim()} disabled={saving} />
              </>
            ) : null}

            {action?.nextStatus && !specialInputStatuses.includes(claim.current_status) ? (
              <>
                <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
                <Button label={saving ? 'Saving...' : action.buttonLabel} onPress={() => void updateClaimStatus(action.nextStatus!, notes.trim() || action.historyNote)} disabled={saving} />
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const specialInputStatuses: ClaimStatus[] = [
  'Initial Documents Verified',
  'Surveyor Appointed',
  'Vehicle Inspected',
  'Final Documents Verified',
  'Claim Intimation',
  'Final Surveyor Details',
  'RA Intimation',
  'DO Status',
  'Payment Stage',
  'Claim Completion In Progress',
  'Claim Complete',
];

function actionForStatus(status: ClaimStatus): ActionCopy | null {
  if (status === 'Initial Documents Pending' || status === 'Documents Pending') return { title: 'Waiting for customer', body: 'The customer must upload all initial claim documents.', buttonLabel: '', historyNote: '' };
  if (status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Documents Submitted') return { title: 'Verify initial documents', body: 'Verify every initial document in Document Review.', buttonLabel: '', historyNote: '' };
  if (status === 'Initial Documents Verified') return { title: 'Appoint surveyor', body: 'Assign the surveyor for the initial inspection.', buttonLabel: 'Appoint surveyor', historyNote: '' };
  if (status === 'Surveyor Appointed') return { title: 'Upload surveyor report', body: 'Attach the initial surveyor report before continuing.', buttonLabel: 'Mark vehicle inspected', historyNote: '' };
  if (status === 'Vehicle Inspected') return { title: 'Request final documents', body: 'Select the exact final documents required from the customer.', buttonLabel: 'Request final documents', historyNote: '' };
  if (status === 'Final Documents Awaited') return { title: 'Waiting for final documents', body: 'The customer must upload the selected final documents.', buttonLabel: '', historyNote: '' };
  if (status === 'Final Documents Verification Pending' || status === 'Final Documents Submitted') return { title: 'Verify final documents', body: 'Verify every requested final document in Document Review.', buttonLabel: '', historyNote: '' };
  if (status === 'Final Documents Verified') return { title: 'Claim intimation', body: 'Draft the insurer email with verified document links.', buttonLabel: 'Claim Intimation', historyNote: '' };
  if (status === 'Claim Intimation') return { title: 'Final surveyor details', body: 'Record the final surveyor contact details.', buttonLabel: 'Save Final Surveyor Details', historyNote: '' };
  if (status === 'Final Surveyor Details') return { title: 'Final surveyor report', body: 'Upload the final surveyor report, then complete work approval.', buttonLabel: 'Work Approval Done', historyNote: '' };
  if (status === 'Work Approval Received') return { title: 'Start repair', body: 'Move the claim into the repair stage after work approval.', buttonLabel: 'Start Repair', nextStatus: 'Under Repair', historyNote: 'Repair started after work approval.' };
  if (status === 'Under Repair') return { title: 'Repair completion', body: 'Use this when the repair work is complete.', buttonLabel: 'Repair Done', nextStatus: 'Repair Done', historyNote: 'Repair completed.' };
  if (status === 'Repair Done') return { title: 'RA intimation', body: 'Start RA intimation with the mandatory invoice and amount breakup.', buttonLabel: 'Start RA Intimation', nextStatus: 'RA Intimation', historyNote: 'RA intimation started.' };
  if (status === 'RA Intimation') return { title: 'RA intimation details', body: 'Invoice, parts, labour, and GST are all required.', buttonLabel: 'RA Intimation Done', historyNote: '' };
  if (status === 'RA Intimation Done') return { title: 'Delivery order details', body: 'Attach the assessment report and enter the delivery-order amount.', buttonLabel: 'Start Delivery Order Details', nextStatus: 'DO Status', historyNote: 'Delivery order details started.' };
  if (status === 'DO Status') return { title: 'Delivery order details', body: 'Assessment report and DO amount are required.', buttonLabel: 'Submit Delivery Order', historyNote: '' };
  if (status === 'Payment Stage') return { title: 'Payment stage', body: 'DO amount, bill amount, and payment advice are required.', buttonLabel: 'Complete payment stage', historyNote: '' };
  if (status === 'Claim Completion In Progress' || status === 'Claim Complete') return { title: 'Claim complete', body: 'Received amount, TDS, GST TDS, and UTR number are required to close the claim.', buttonLabel: 'Close claim', historyNote: '' };
  return null;
}
async function reconcileDocumentStage(claim: Claim, documents: ClaimDocument[], changedBy: string) {
  const nextStatus = documentDrivenStatusFor(claim, documents);
  if (!nextStatus || nextStatus === claim.current_status) return claim;

  const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
  if (error) return claim;
  await recordClaimEvent({
    claimId: claim.id,
    customerId: claim.customer_id,
    fromStatus: claim.current_status,
    toStatus: nextStatus,
    notes: 'Document checklist reconciled automatically.',
    changedBy,
    title: `Claim ${claim.claim_no} updated`,
  });
  return { ...claim, current_status: nextStatus };
}

function numeric(value: string) {
  const cleaned = value.replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const styles = StyleSheet.create({
  claimHeaderCard: { backgroundColor: '#F2F7FF', borderColor: '#C9DDFF' },
  workflowCard: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: radii.sm, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  claimNo: { color: palette.ink, fontSize: 19, fontWeight: '800' },
  helperText: { color: palette.slate, fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 3 },
  bodyText: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 12 },
  uploadPrompt: { color: palette.slate, fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: 10 },
  actionGap: { height: 8 },
  actionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  actionIcon: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { color: palette.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  actionTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  documentSelectionHint: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 10 },
  documentSelectionList: { borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, overflow: 'hidden', marginBottom: 12 },
  documentSelectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 11, backgroundColor: palette.surface, borderBottomWidth: 1, borderBottomColor: palette.line },
  documentSelectionRowSelected: { backgroundColor: roleTheme.ops.soft },
  documentSelectionCopy: { flex: 1, minWidth: 0 },
  documentSelectionTitle: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  documentSelectionBody: { color: palette.slate, fontSize: 11, fontWeight: '500', lineHeight: 16, marginTop: 2 },
});



