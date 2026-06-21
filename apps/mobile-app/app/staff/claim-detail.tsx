import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppSectionHeader, AppTimeline } from '@/components/design-system';
import { Button, Card, EmptyState, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { documentDrivenStatusFor, documentStatusLabel, replacementStatusFor } from '@/lib/claim-documents';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { canUpdateClaimStage, canVerifyDocument } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimHistory, ClaimStageDetail, ClaimStatus, ClaimTask, Customer, Policy, Profile, Vehicle } from '@/lib/types';

type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };

export default function StaffClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [stageDetails, setStageDetails] = useState<ClaimStageDetail[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const [reuploadReason, setReuploadReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [replacingDocument, setReplacingDocument] = useState<ClaimDocument | null>(null);
  const [replacementFile, setReplacementFile] = useState<PickedFile | null>(null);
  const [deletingId, setDeletingId] = useState('');
  const [uploadingReplacement, setUploadingReplacement] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const session = await getCurrentSession();
      if (session?.user) {
        const nextProfile = await getProfile(session.user.id);
        if (isValidProfile(nextProfile)) setProfile(nextProfile);
      }
      const [claimResult, historyResult, documentsResult, tasksResult, stageDetailsResult] = await Promise.all([
        supabase.from('claims').select('*').eq('id', id).maybeSingle(),
        supabase.from('claim_status_history').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_tasks').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_stage_details').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
      ]);
      setClaim(claimResult.data);
      if (claimResult.data) {
        const [customerResult, vehicleResult, policyResult] = await Promise.all([
          supabase.from('customers').select('*').eq('id', claimResult.data.customer_id).maybeSingle(),
          supabase.from('vehicles').select('*').eq('id', claimResult.data.vehicle_id).maybeSingle(),
          supabase.from('policies').select('*').eq('id', claimResult.data.policy_id).maybeSingle(),
        ]);
        setCustomer(customerResult.data);
        setVehicle(vehicleResult.data);
        setPolicy(policyResult.data);
      }
      setHistory(historyResult.data ?? []);
      setDocuments(documentsResult.data ?? []);
      setStageDetails(stageDetailsResult.data ?? []);
      if (stageDetailsResult.error) setMessage('Manager updates could not be loaded. Please apply the claim-stage database migration.');
      setTasks(tasksResult.data ?? []);
      setLoading(false);
    }
    void load();
  }, [id]);

  async function openDocument(document: ClaimDocument) {
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (!error && data?.signedUrl) await Linking.openURL(data.signedUrl);
  }

  function confirmReplaceDocument(document: ClaimDocument) {
    Alert.alert(
      'Replace this document?',
      `The current ${document.document_type} file will be removed. You can then upload the replacement from the claim desk.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete and replace', style: 'destructive', onPress: () => void deleteAndPrepareReplacement(document) },
      ],
    );
  }

  async function deleteAndPrepareReplacement(document: ClaimDocument) {
    setMessage('');
    setDeletingId(document.id);
    try {
      const storageResult = await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
      if (storageResult.error) throw storageResult.error;
      const deleteResult = await supabase.from('claim_documents').delete().eq('id', document.id);
      if (deleteResult.error) throw deleteResult.error;
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      setReplacingDocument(document);
      setReplacementFile(null);
      setRejectingId('');
      setMessage(`Upload a replacement for ${document.document_type}.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Document could not be deleted: ${error.message}` : 'Document could not be deleted.');
    } finally {
      setDeletingId('');
    }
  }

  async function chooseReplacementDocument() {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setReplacementFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null });
    }
  }

  async function uploadReplacementDocument() {
    if (!claim || !replacingDocument || !replacementFile) return;
    setMessage('');
    setUploadingReplacement(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const extension = replacementFile.name.includes('.') ? replacementFile.name.split('.').pop() : 'bin';
      const slug = replacingDocument.document_type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const storagePath = `${claim.customer_id}/${claim.id}/manager-replacement-${slug}-${Date.now()}.${extension}`;
      const response = await fetch(replacementFile.uri);
      const body = await response.arrayBuffer();
      const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: replacementFile.mimeType ?? 'application/octet-stream', upsert: false });
      if (uploadResult.error) throw uploadResult.error;
      const insertResult = await supabase.from('claim_documents').insert({
        claim_id: claim.id,
        customer_id: claim.customer_id,
        document_type: replacingDocument.document_type,
        file_name: replacementFile.name,
        storage_bucket: 'claim-documents',
        storage_path: storagePath,
        mime_type: replacementFile.mimeType,
        file_size: replacementFile.size,
        uploaded_by: session.user.id,
      }).select('*').single();
      if (insertResult.error) throw insertResult.error;
      setDocuments((current) => [insertResult.data, ...current]);
      setReplacingDocument(null);
      setReplacementFile(null);
      setMessage(`${replacingDocument.document_type} uploaded from the claim desk and is ready for verification.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Replacement document could not be uploaded: ${error.message}` : 'Replacement document could not be uploaded.');
    } finally {
      setUploadingReplacement(false);
    }
  }

  async function reviewDocument(document: ClaimDocument, verificationStatus: 'verified' | 'rejected') {
    setMessage('');
    if (verificationStatus === 'rejected' && rejectingId !== document.id) {
      setRejectingId(document.id);
      setReuploadReason('');
      return;
    }
    setReviewingId(document.id);
    try {
      const session = await getCurrentSession();
      const { error } = await supabase.from('claim_documents').update({
        verification_status: verificationStatus,
        verified_by: session?.user.id ?? null,
        verified_at: new Date().toISOString(),
        rejection_reason: verificationStatus === 'rejected' ? reuploadReason.trim() || 'Reupload requested by claim desk' : null,
      }).eq('id', document.id);
      if (error) {
        setMessage('Document review could not be saved.');
        return;
      }
      const changedBy = session?.user.id;
      if (changedBy && claim) {
        if (verificationStatus === 'verified') await advanceAfterVerification(claim, document, changedBy);
        else await requestReupload(claim, document, changedBy, reuploadReason.trim());
      }
      setRejectingId('');
      setReuploadReason('');
      await reloadDocuments();
    } finally {
      setReviewingId('');
    }
  }

  async function reloadDocuments() {
    if (!id) return;
    const [claimResult, documentsResult, historyResult, stageDetailsResult] = await Promise.all([
      supabase.from('claims').select('*').eq('id', id).maybeSingle(),
      supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
      supabase.from('claim_status_history').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
      supabase.from('claim_stage_details').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
    ]);
    if (claimResult.data) setClaim(claimResult.data);
    setDocuments(documentsResult.data ?? []);
    setHistory(historyResult.data ?? []);
    setStageDetails(stageDetailsResult.data ?? []);
    if (stageDetailsResult.error) setMessage('Manager updates could not be loaded. Please apply the claim-stage database migration.');
  }
  if (loading) return <Screen title="Claim Detail"><LoadingState /></Screen>;
  if (!claim) return <Screen title="Claim Detail"><EmptyState title="Claim not found" body="Select another claim from the list." /></Screen>;

  const heroTone = claimHeroTone(claim.current_status);
  const canReviewDocuments = canVerifyDocument(profile?.role);
  const managerUpdateFallbacks = managerUpdateFallbacksFor(history, stageDetails);

  return (
    <Screen title="Claim Detail" subtitle="Case workspace" showLogout>
      {message ? <Message type="error">{message}</Message> : null}
      <Card style={[styles.summaryCard, { backgroundColor: heroTone.background, borderColor: heroTone.border }]}>
        <View style={[styles.summaryWash, { backgroundColor: heroTone.wash }]} />
        <View style={[styles.summaryWashSmall, { backgroundColor: heroTone.washAlt }]} />
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIcon, { backgroundColor: heroTone.accent }]}>
            <MaterialCommunityIcons name={statusIcon(claim.current_status)} size={23} color={palette.surface} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>Operational claim file</Text>
            <Text style={styles.claimNo}>{claim.claim_no}</Text>
            <Text style={styles.vehicleNo}>{vehicle?.vehicle_no ?? 'Vehicle linked'}</Text>
          </View>
          <AppBadge label={claim.current_status} tone={statusTone(claim.current_status)} />
        </View>
        <View style={styles.compactFacts}>
          <Fact label="Location" value={claim.accident_location} />
          <Fact label="Est. loss" value={claim.estimated_loss ? `INR ${claim.estimated_loss}` : '-'} />
          <Fact label="Updated" value={formatDateTime(claim.updated_at ?? claim.created_at)} />
        </View>
      </Card>
      {canUpdateClaimStage(profile?.role) ? (
        <Card style={styles.actionCard}>
          <View style={styles.actionIcon}>
            <MaterialCommunityIcons name="arrow-decision-outline" size={22} color={roleTheme.ops.accent} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Next claim action</Text>
            <Text style={styles.actionText}>Update status, assign survey work, or request documents.</Text>
          </View>
          <Link href={{ pathname: '/staff/update-status', params: { id: claim.id } }} asChild>
            <Pressable accessibilityRole="button" style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Open</Text>
            </Pressable>
          </Link>
        </Card>
      ) : null}
      <Card style={[styles.twoColumnCard, styles.peopleSection]}>
        <View style={[styles.infoBlock, styles.customerBlock]}>
          <AppSectionHeader title="Customer" />
          <InfoLine label="Name" value={customer?.contact_name ?? customer?.company_name} />
          <InfoLine label="Phone" value={customer?.phone} />
          <InfoLine label="Email" value={customer?.email} />
        </View>
        <View style={[styles.infoBlock, styles.policyBlock]}>
          <AppSectionHeader title="Policy" />
          <InfoLine label="Vehicle" value={vehicle?.vehicle_no} />
          <InfoLine label="Model" value={[vehicle?.make, vehicle?.model].filter(Boolean).join(' ')} />
          <InfoLine label="Policy" value={policy?.policy_no} />
        </View>
      </Card>
      <Card style={styles.documentsSection}>
        <AppSectionHeader title="Documents" />
        {replacingDocument ? (
          <View style={styles.replacementPanel}>
            <Text style={styles.replacementTitle}>Replace: {replacingDocument.document_type}</Text>
            <Text style={styles.replacementHint}>This replacement will be saved against the same document requirement.</Text>
            <Button label={replacementFile ? replacementFile.name : 'Choose replacement file'} variant="secondary" onPress={() => void chooseReplacementDocument()} disabled={uploadingReplacement} />
            <View style={styles.uploadButtonGap} />
            <Button label={uploadingReplacement ? 'Uploading replacement...' : 'Upload replacement'} onPress={() => void uploadReplacementDocument()} disabled={uploadingReplacement || !replacementFile} />
          </View>
        ) : null}
        {documents.length ? documents.map((document) => (
          <View key={document.id} style={styles.documentBlock}>
            <View style={styles.documentRow}>
              <View style={[styles.documentIcon, { backgroundColor: documentTone(document.verification_status).soft }]}>
                <MaterialCommunityIcons name={documentTone(document.verification_status).icon} size={18} color={documentTone(document.verification_status).accent} />
              </View>
              <View style={styles.documentCopy}>
                <Text style={styles.documentTitle}>{document.document_type}</Text>
                <Text style={styles.documentMeta} numberOfLines={1}>{document.file_name}</Text>
              </View>
              <AppBadge label={documentStatusLabel(document.verification_status)} tone={document.verification_status === 'verified' ? 'success' : document.verification_status === 'rejected' ? 'danger' : 'warning'} />
              <Pressable accessibilityRole="button" onPress={() => void openDocument(document)} style={styles.openDocumentButton}>
                <MaterialCommunityIcons name="open-in-new" size={16} color={palette.ink} />
              </Pressable>
            </View>
            {canReviewDocuments ? (
              <View style={styles.documentActions}>
                {document.verification_status !== 'verified' ? (
                  <Pressable accessibilityRole="button" disabled={reviewingId === document.id} onPress={() => void reviewDocument(document, 'verified')} style={[styles.reviewButton, reviewingId === document.id && styles.reviewButtonDisabled]}>{reviewingId === document.id ? <ActivityIndicator size="small" color={palette.emerald} /> : <Text style={styles.reviewButtonText}>Verify</Text>}</Pressable>
                ) : null}
                {document.verification_status !== 'rejected' ? (
                  <Pressable accessibilityRole="button" disabled={reviewingId === document.id} onPress={() => void reviewDocument(document, 'rejected')} style={[styles.reviewButton, styles.reuploadButton, reviewingId === document.id && styles.reviewButtonDisabled]}>{reviewingId === document.id ? <ActivityIndicator size="small" color={palette.coral} /> : <Text style={[styles.reviewButtonText, styles.reuploadButtonText]}>Reupload</Text>}</Pressable>
                ) : null}
                {canUpdateClaimStage(profile?.role) ? (
                  <Pressable accessibilityRole="button" disabled={deletingId === document.id || reviewingId === document.id} onPress={() => confirmReplaceDocument(document)} style={[styles.replaceButton, (deletingId === document.id || reviewingId === document.id) && styles.reviewButtonDisabled]}>
                    {deletingId === document.id ? <ActivityIndicator size="small" color={palette.coral} /> : <Text style={styles.replaceButtonText}>Delete and replace</Text>}
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {rejectingId === document.id ? (
              <View style={styles.reuploadBox}>
                <TextField label="Reupload reason" value={reuploadReason} onChangeText={setReuploadReason} />
                <Button label={reviewingId === document.id ? 'Requesting reupload...' : 'Request reupload'} variant="danger" onPress={() => void reviewDocument(document, 'rejected')} disabled={reviewingId === document.id} />
              </View>
            ) : null}
              </View>
        )) : <Text style={styles.emptyText}>No documents uploaded yet.</Text>}
      </Card>
      <Card style={styles.journeySection}>
        <View style={styles.sectionTopRow}>
          <View style={styles.sectionIcon}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={21} color={palette.violet} />
          </View>
          <View style={styles.sectionCopy}>
            <AppSectionHeader title="Claim journey" />
            <Text style={styles.sectionHint}>Current stage and completed checkpoints.</Text>
          </View>
        </View>
        <AppTimeline steps={buildJourney(claim.current_status, history)} />
      </Card>
      <Card style={styles.stageDetailsSection}>
        <AppSectionHeader title="Manager updates" />
        {stageDetails.length || managerUpdateFallbacks.length ? null : <Text style={styles.emptyText}>No manager details recorded yet.</Text>}
        {stageDetails.map((item) => <InfoLine key={item.id} label={item.stage} value={formatStageDetails(item.details)} />)}
        {managerUpdateFallbacks.map((item) => <InfoLine key={`history-${item.id}`} label={item.to_status} value={item.notes ?? '-'} />)}
      </Card>
      <Card style={styles.followupSection}>
        <AppSectionHeader title="Follow-ups" />
        <Text style={styles.countText}>{tasks.length} task{tasks.length === 1 ? '' : 's'}</Text>
        {tasks.map((task) => <InfoLine key={task.id} label={task.title} value={task.status} />)}
      </Card>
      <Card style={styles.historySection}>
        <AppSectionHeader title="Status history" />
        {history.length ? null : <Text style={styles.emptyText}>No updates yet.</Text>}
        {history.map((item) => <InfoLine key={item.id} label={item.to_status} value={item.notes ?? item.created_at?.slice(0, 10)} />)}
      </Card>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue} numberOfLines={2}>{value ?? '-'}</Text>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
    </View>
  );
}

function managerUpdateFallbacksFor(history: ClaimHistory[], stageDetails: ClaimStageDetail[]) {
  const structuredStages: ClaimStatus[] = ['Surveyor Appointed', 'Final Surveyor Details'];
  return structuredStages.flatMap((stage) => {
    if (stageDetails.some((item) => item.stage === stage)) return [];
    const historyItem = history.find((item) => item.to_status === stage && item.notes);
    return historyItem ? [historyItem] : [];
  });
}
function formatStageDetails(details: ClaimStageDetail['details']) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '-';
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${humanizeKey(key)}: ${String(value)}`)
    .join(' - ') || '-';
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}
async function advanceAfterVerification(claim: Claim, document: ClaimDocument, changedBy: string) {
  const [documentsResult, tasksResult] = await Promise.all([
    supabase.from('claim_documents').select('*').eq('claim_id', document.claim_id),
    supabase.from('claim_tasks').select('*').eq('claim_id', document.claim_id).eq('status', 'open').like('title', 'Final document: %'),
  ]);
  const nextDocuments = (documentsResult.data ?? []).map((item) => item.id === document.id ? { ...item, verification_status: 'verified' as const } : item);
  const requestedFinalDocumentTypes = (tasksResult.data ?? []).map((task) => task.title.slice('Final document: '.length));
  const nextStatus = documentDrivenStatusFor(claim, nextDocuments, requestedFinalDocumentTypes);
  if (!nextStatus || nextStatus === claim.current_status) return;

  const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
  if (error) return;
  await recordClaimEvent({
    claimId: claim.id,
    customerId: claim.customer_id,
    fromStatus: claim.current_status,
    toStatus: nextStatus,
    notes: 'All required documents verified by claim desk.',
    changedBy,
    title: `Documents verified for ${claim.claim_no}`,
  });
}

async function requestReupload(claim: Claim, document: ClaimDocument, changedBy: string, reason: string) {
  const nextStatus = replacementStatusFor(claim);
  if (nextStatus === claim.current_status) return;

  const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
  if (error) return;
  await recordClaimEvent({
    claimId: claim.id,
    customerId: claim.customer_id,
    fromStatus: claim.current_status,
    toStatus: nextStatus,
    notes: reason || `Reupload requested for ${document.document_type}.`,
    changedBy,
    title: `Reupload requested for ${claim.claim_no}`,
  });
}
const journey: { label: string; statuses: ClaimStatus[] }[] = [
  { label: 'Accident Reported', statuses: ['Accident Reported'] },
  { label: 'Initial Documents', statuses: ['Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Submitted', 'Documents Pending'] },
  { label: 'Surveyor Assigned', statuses: ['Surveyor Appointed'] },
  { label: 'Survey Completed', statuses: ['Vehicle Inspected'] },
  { label: 'Final Documents', statuses: ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified'] },
  { label: 'Claim Intimation', statuses: ['Claim Intimated', 'Claim Intimation'] },
  { label: 'Final Surveyor', statuses: ['Final Surveyor Details', 'Survey Status', 'Survey Done'] },
  { label: 'Work Approval', statuses: ['Work Approval Status', 'Work Approval Received', 'Estimate Submitted', 'Approval Pending'] },
  { label: 'Under Repair', statuses: ['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed'] },
  { label: 'RA / DO', statuses: ['RA Intimation', 'RA Intimation Done', 'DO Status', 'DO Submitted', 'Final Bill Submitted'] },
  { label: 'Payment Advice Received', statuses: ['Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process'] },
  { label: 'Journey Complete', statuses: ['Claim Complete', 'Settled', 'Closed'] },
];

function buildJourney(currentStatus: ClaimStatus, history: ClaimHistory[]) {
  const currentIndex = Math.max(0, journey.findIndex((step) => step.statuses.includes(currentStatus)));
  const completedStatuses = new Set(history.map((item) => item.to_status));
  completedStatuses.add(currentStatus);
  return journey.map((step, index) => ({
    label: step.label,
    state: index < currentIndex ? 'complete' as const : index === currentIndex ? 'current' as const : 'pending' as const,
    meta: step.statuses.includes(currentStatus) ? currentStatus : undefined,
  }));
}

function statusTone(status: ClaimStatus) {
  if (['Settled', 'Closed'].includes(status)) return 'success';
  if (['Rejected'].includes(status)) return 'danger';
  if (['Approval Pending', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Documents Pending', 'Final Documents Awaited', 'Final Documents Verification Pending', 'Survey Status', 'Work Approval Status', 'RA Intimation', 'DO Status', 'Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process'].includes(status)) return 'warning';
  return 'info';
}

function claimHeroTone(status: ClaimStatus) {
  if (['Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited', 'Accident Reported', 'Draft'].includes(status)) {
    return { background: '#FFF8EA', border: '#F4D999', wash: 'rgba(245,158,11,0.15)', washAlt: 'rgba(255,255,255,0.72)', accent: palette.amber };
  }
  if (['Initial Documents Verification Pending', 'Initial Documents Submitted', 'Documents Submitted', 'Final Documents Verification Pending', 'Final Documents Submitted'].includes(status)) {
    return { background: '#EFFBFD', border: '#BCEBF1', wash: 'rgba(14,175,200,0.14)', washAlt: 'rgba(255,255,255,0.76)', accent: palette.cyan };
  }
  if (['Initial Documents Verified', 'Final Documents Verified', 'Survey Done', 'Work Approval Received', 'RA Intimation Done', 'Claim Complete', 'Settled', 'Closed'].includes(status)) {
    return { background: '#F0FBF5', border: '#BFEBD0', wash: 'rgba(16,166,111,0.14)', washAlt: 'rgba(255,255,255,0.78)', accent: palette.emerald };
  }
  if (['Estimate Submitted', 'Approval Pending', 'Work Approval Status', 'Work Approval Received'].includes(status)) {
    return { background: '#F7F5FF', border: '#D8D4FF', wash: 'rgba(98,87,215,0.14)', washAlt: 'rgba(255,255,255,0.76)', accent: palette.violet };
  }
  if (['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'DO Submitted', 'Final Bill Submitted', 'Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'Settlement Under Process'].includes(status)) {
    return { background: '#FFF4EF', border: '#FFD2C7', wash: 'rgba(229,72,77,0.1)', washAlt: 'rgba(245,158,11,0.1)', accent: '#E05F2D' };
  }
  if (status === 'Rejected') {
    return { background: '#FFF1F2', border: '#FAC7C9', wash: 'rgba(229,72,77,0.13)', washAlt: 'rgba(255,255,255,0.78)', accent: palette.coral };
  }
  return { background: '#F2F7FF', border: '#C9DDFF', wash: 'rgba(7,94,234,0.14)', washAlt: 'rgba(14,175,200,0.08)', accent: palette.blue };
}

function statusIcon(status: ClaimStatus): keyof typeof MaterialCommunityIcons.glyphMap {
  if (['Settled', 'Closed'].includes(status)) return 'check-decagram-outline';
  if (['Rejected'].includes(status)) return 'alert-octagon-outline';
  if (['Initial Documents Pending', 'Documents Pending', 'Final Documents Awaited'].includes(status)) return 'file-alert-outline';
  if (['Initial Documents Verification Pending', 'Initial Documents Submitted', 'Documents Submitted', 'Final Documents Verification Pending', 'Final Documents Submitted'].includes(status)) return 'file-search-outline';
  if (['Surveyor Appointed', 'Vehicle Inspected', 'Final Surveyor Details', 'Survey Status', 'Survey Done'].includes(status)) return 'clipboard-search-outline';
  if (['Under Repair', 'Repair Done', 'Repair Started', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status'].includes(status)) return 'wrench-outline';
  if (['Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'Settlement Under Process'].includes(status)) return 'bank-transfer';
  return 'truck-check-outline';
}

function documentTone(status: string): { accent: string; soft: string; icon: keyof typeof MaterialCommunityIcons.glyphMap } {
  if (status === 'verified') return { accent: palette.emerald, soft: palette.emeraldSoft, icon: 'file-check-outline' };
  if (status === 'rejected') return { accent: palette.coral, soft: palette.coralSoft, icon: 'file-remove-outline' };
  if (status === 'pending') return { accent: palette.amber, soft: palette.amberSoft, icon: 'file-alert-outline' };
  return { accent: palette.blue, soft: palette.blueSoft, icon: 'file-document-outline' };
}

function formatDateTime(date?: string) {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  summaryCard: { padding: 14, overflow: 'hidden' },
  summaryWash: { position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 105 },
  summaryWashSmall: { position: 'absolute', left: -80, bottom: -100, width: 190, height: 190, borderRadius: 95 },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  summaryIcon: { width: 44, height: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryLabel: { color: palette.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0 },
  claimNo: { color: palette.ink, fontSize: 20, fontWeight: '800', marginTop: 2 },
  vehicleNo: { color: palette.slate, fontSize: 14, fontWeight: '600', marginTop: 3 },
  compactFacts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, borderRadius: radii.sm, borderWidth: 1, borderColor: 'rgba(198,211,225,0.74)', backgroundColor: 'rgba(255,255,255,0.72)', padding: 9 },
  factLabel: { color: palette.slate, fontSize: 11, fontWeight: '600' },
  factValue: { color: palette.ink, fontSize: 13, fontWeight: '800', marginTop: 3, lineHeight: 17 },
  actionCard: { minHeight: 74, borderColor: '#C9DDFF', backgroundColor: '#F2F7FF', flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  actionIcon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: roleTheme.ops.soft, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  actionText: { color: palette.slate, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 2 },
  actionButton: { minHeight: 38, borderRadius: radii.sm, backgroundColor: roleTheme.ops.accent, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  peopleSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA', gap: 10 },
  twoColumnCard: { gap: 10 },
  infoBlock: { borderRadius: radii.md, borderWidth: 1, padding: 11 },
  customerBlock: { backgroundColor: '#F0FBF5', borderColor: '#BFEBD0' },
  policyBlock: { backgroundColor: '#EAF3FF', borderColor: '#C9DDFF' },
  infoLine: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: 'rgba(198,211,225,0.65)' },
  infoLabel: { color: palette.slate, fontSize: 12, fontWeight: '600', marginBottom: 2 },
  infoValue: { color: palette.ink, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  documentsSection: { backgroundColor: '#FFF8EA', borderColor: '#F4D999' },
  documentBlock: { borderTopWidth: 1, borderTopColor: 'rgba(198,211,225,0.65)', paddingTop: 9, marginTop: 9 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  documentIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitle: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  documentMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 2 },
  openDocumentButton: { width: 34, height: 30, borderRadius: radii.sm, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  documentActions: { flexDirection: 'row', gap: 8, marginTop: 9 },
  reviewButton: { flex: 1, minHeight: 36, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, borderWidth: 1, borderColor: '#BCE9D2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  reviewButtonText: { color: palette.emerald, fontSize: 12, fontWeight: '800' },
  reuploadButton: { backgroundColor: palette.coralSoft, borderColor: '#FAC7C9' },
  reuploadButtonText: { color: palette.coral },
  reviewButtonDisabled: { opacity: 0.7 },
  replaceButton: { flex: 1, minHeight: 36, borderRadius: radii.sm, backgroundColor: '#FFF7F7', borderWidth: 1, borderColor: '#FAC7C9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  replaceButtonText: { color: palette.coral, fontSize: 12, fontWeight: '800' },
  reuploadBox: { marginTop: 8 },
  journeySection: { backgroundColor: '#F7F5FF', borderColor: '#D8D4FF' },
  sectionTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  sectionIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.violetSoft, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionHint: { color: palette.slate, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: -5, marginBottom: 6 },
  stageDetailsSection: { backgroundColor: '#F8FBFF', borderColor: '#D7E6FA' },
  followupSection: { backgroundColor: '#EFFBFD', borderColor: '#BCEBF1' },
  historySection: { backgroundColor: '#F0FBF5', borderColor: '#BFEBD0' },
  countText: { color: palette.slate, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  replacementPanel: { marginTop: 10, marginBottom: 12, padding: 11, backgroundColor: '#F8FBFF', borderColor: '#C9DDFF', borderWidth: 1, borderRadius: radii.sm },
  replacementTitle: { color: palette.ink, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  replacementHint: { color: palette.slate, fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: 10 },
  uploadButtonGap: { height: 8 },
  emptyText: { color: palette.slate, fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
















