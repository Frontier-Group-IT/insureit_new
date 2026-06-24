import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Message, Screen } from '@/components/ui';
import { ensureCustomerForUser, getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { documentDrivenStatusFor, documentStatusLabel, requiredDocumentsForStatus } from '@/lib/claim-documents';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { customerStageCopy } from '@/lib/claim-workflow';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimTask, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export default function UploadDocumentsScreen() {
  const router = useRouter();
  const { claimId } = useLocalSearchParams<{ claimId?: string }>();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState(claimId ?? '');
  const [files, setFiles] = useState<Record<string, PickedFile | null>>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingType, setUploadingType] = useState('');
  const [submitSuccessOpen, setSubmitSuccessOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const customer = await getCustomerForUser(session.user.id);
      if (!customer) return;

      const [claimsResult, documentsResult, tasksResult, vehicleResult, policyResult, insurerResult] = await Promise.all([
        supabase.from('claims').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
        supabase.from('claim_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('vehicles').select('*').eq('customer_id', customer.id),
        supabase.from('policies').select('*').eq('customer_id', customer.id),
        supabase.from('insurance_companies').select('*'),
      ]);

      const nextClaims = claimsResult.data ?? [];
      setClaims(nextClaims);
      setDocuments(documentsResult.data ?? []);
      setTasks(tasksResult.data ?? []);
      setVehicles(vehicleResult.data ?? []);
      setPolicies(policyResult.data ?? []);
      setInsurers(insurerResult.data ?? []);

      if (claimId) setSelectedClaimId(claimId);
      else if (nextClaims.length === 1) setSelectedClaimId(nextClaims[0].id);
    }

    void load();
  }, [claimId, router]);

  const selectedClaim = useMemo(() => claims.find((item) => item.id === selectedClaimId) ?? null, [claims, selectedClaimId]);
  const selectedVehicle = useMemo(() => selectedClaim ? vehicles.find((item) => item.id === selectedClaim.vehicle_id) ?? null : null, [selectedClaim, vehicles]);
  const selectedPolicy = useMemo(() => selectedClaim ? policies.find((item) => item.id === selectedClaim.policy_id) ?? null : null, [policies, selectedClaim]);
  const selectedInsurer = useMemo(() => {
    const insurerId = selectedClaim?.insurance_company_id || selectedPolicy?.insurance_company_id;
    return insurerId ? insurers.find((item) => item.id === insurerId) ?? null : null;
  }, [insurers, selectedClaim, selectedPolicy]);

  const selectedDocuments = useMemo(() => selectedClaim ? documents.filter((item) => item.claim_id === selectedClaim.id) : [], [documents, selectedClaim]);
  const requestedFinalDocumentTypes = useMemo(() => selectedClaim ? requestedFinalDocumentTypesFor(selectedClaim.id, tasks) : [], [selectedClaim, tasks]);
  const documentSections = useMemo(() => requiredDocumentsForStatus(selectedClaim?.current_status, requestedFinalDocumentTypes), [selectedClaim?.current_status, requestedFinalDocumentTypes]);

  const completedCount = documentSections.filter((section) => selectedDocuments.some((item) => item.document_type === section.type && item.verification_status !== 'rejected')).length;
  const verifiedCount = selectedDocuments.filter((item) => item.verification_status === 'verified').length;
  const rejectedCount = selectedDocuments.filter((item) => item.verification_status === 'rejected').length;
  const completionPercent = documentSections.length ? Math.round((completedCount / documentSections.length) * 100) : 0;

  async function takePhoto(documentType: string) {
    setMessage('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      setMessage('Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handlePickedFile(documentType, {
        uri: asset.uri,
        name: asset.fileName ?? `${slug(documentType)}-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize ?? null,
      });
    }
  }

  async function choosePhoto(documentType: string) {
    setMessage('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handlePickedFile(documentType, {
        uri: asset.uri,
        name: asset.fileName ?? `${slug(documentType)}-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize ?? null,
      });
    }
  }

  async function pickDocument(documentType: string) {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handlePickedFile(documentType, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? null,
        size: asset.size ?? null,
      });
    }
  }

  async function handlePickedFile(documentType: string, file: PickedFile) {
    setSuccess('');

    if (!selectedClaim) {
      setMessage('Select a claim before attaching a document.');
      return;
    }

    if (file.size !== null && file.size > MAX_UPLOAD_SIZE_BYTES) {
      setMessage(`${file.name} is larger than 5 MB. Please choose a smaller file.`);
      return;
    }

    setFiles((current) => ({ ...current, [documentType]: file }));
    await upload(documentType, file);
  }

  async function upload(documentType: string, pickedFile: PickedFile) {
    setMessage('');
    setSuccess('');
    setUploadingType(documentType);

    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const customer = await ensureCustomerForUser(session.user);
      if (!customer) return setMessage('Your customer profile is not ready yet. Please contact support.');
      if (!selectedClaim) return setMessage('Select a claim and attach a file.');

      const extension = pickedFile.name.includes('.') ? pickedFile.name.split('.').pop() : 'bin';
      const storagePath = `${customer.id}/${selectedClaim.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

      const response = await fetch(pickedFile.uri);
      const body = await response.arrayBuffer();

      if (body.byteLength > MAX_UPLOAD_SIZE_BYTES) {
        setMessage(`${pickedFile.name} is larger than 5 MB. Please choose a smaller file.`);
        return;
      }

      const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, {
        contentType: pickedFile.mimeType ?? 'application/octet-stream',
        upsert: false,
      });

      if (uploadResult.error) return setMessage('This file could not be uploaded.');

      const { data, error } = await supabase.from('claim_documents').insert({
        claim_id: selectedClaim.id,
        customer_id: customer.id,
        document_type: documentType,
        file_name: pickedFile.name,
        storage_bucket: 'claim-documents',
        storage_path: storagePath,
        mime_type: pickedFile.mimeType,
        file_size: pickedFile.size,
        uploaded_by: session.user.id,
      }).select('*').single();

      if (error) {
        setMessage('The file uploaded, but the document record could not be saved.');
      } else {
        setSuccess(`${documentType} uploaded successfully.`);

        if (data) {
          const nextDocuments = [data, ...documents];
          setDocuments(nextDocuments);

          const nextStatus = await advanceAfterUpload(selectedClaim, nextDocuments, session.user.id, requestedFinalDocumentTypes);
          if (nextStatus) {
            setClaims((current) => current.map((claim) => claim.id === selectedClaim.id ? { ...claim, current_status: nextStatus } : claim));
          }
        }

        setFiles((current) => ({ ...current, [documentType]: null }));
      }
    } catch {
      setMessage('This file could not be uploaded.');
    } finally {
      setUploadingType('');
    }
  }

  async function openDocument(document: ClaimDocument) {
    setMessage('');
    const { data, error } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
    if (error || !data?.signedUrl) return setMessage('This document could not be opened.');
    await Linking.openURL(data.signedUrl);
  }

  return (
    <Screen title="Upload Documents" showTitleHeader={false}>
      <View style={styles.pageIndicator}>
        <Text style={styles.pageTitle}>Upload Documents</Text>
        <Text style={styles.pageSub}>{selectedClaim ? `Control No. ${selectedClaim.claim_no}` : 'Select claim and upload required files'}</Text>
      </View>

      {message ? <Message type="error">{message}</Message> : null}
      {success ? <Message type="success">{success}</Message> : null}

      {selectedVehicle ? (
        <View style={styles.vehicleSummary}>
          <View style={styles.summaryAccent} />

          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.vehicleNo}>{selectedVehicle.vehicle_no}</Text>
              <Text style={styles.vehicleMeta} numberOfLines={1}>{[selectedVehicle.make, selectedVehicle.model, selectedVehicle.vehicle_type].filter(Boolean).join(' • ') || 'Vehicle'}</Text>
            </View>

            <View style={styles.policyStatus}>
              <Text style={styles.policyStatusText}>{selectedPolicy ? 'Policy Active' : 'Policy Missing'}</Text>
            </View>
          </View>

          <View style={styles.summaryInfo}>
            <InfoPair leftLabel="Policy" leftValue={selectedPolicy?.policy_no ?? '-'} rightLabel="Expiry" rightValue={selectedPolicy ? formatDate(selectedPolicy.end_date) : '-'} />
            <InfoPair leftLabel="Insurer" leftValue={selectedInsurer?.name ?? '-'} rightLabel="Type" rightValue={selectedPolicy?.policy_type ?? '-'} />
          </View>
        </View>
      ) : null}

      {claims.length > 1 && !claimId ? (
        <View style={styles.claimPicker}>
          <Text style={styles.claimPickerTitle}>Select Claim</Text>
          {claims.map((claim) => (
            <Pressable key={claim.id} accessibilityRole="button" onPress={() => setSelectedClaimId(claim.id)} style={[styles.claimOption, selectedClaimId === claim.id && styles.claimOptionActive]}>
              <Text style={[styles.claimOptionText, selectedClaimId === claim.id && styles.claimOptionTextActive]}>{claim.claim_no}</Text>
              <Text style={styles.claimOptionSub}>{claim.current_status}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {selectedClaim ? (
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.progressTitle}>Required Documents</Text>
              <Text style={styles.progressSub}>{customerStageCopy(selectedClaim.current_status)}</Text>
            </View>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{completionPercent}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
          </View>

          <View style={styles.statRow}>
            <Stat label="Required" value={documentSections.length} tone="blue" />
            <Stat label="Uploaded" value={completedCount} tone="navy" />
            <Stat label="Verified" value={verifiedCount} tone="green" />
            <Stat label="Rejected" value={rejectedCount} tone="pink" />
          </View>
        </View>
      ) : null}

      {documentSections.map((section) => {
        const file = files[section.type];
        const uploaded = selectedDocuments.filter((item) => item.document_type === section.type);
        const acceptedDocuments = uploaded.filter((item) => item.verification_status !== 'rejected');
        const rejectedDocuments = uploaded.filter((item) => item.verification_status === 'rejected');
        const isComplete = acceptedDocuments.length > 0;
        const displayDocument = acceptedDocuments[0] ?? rejectedDocuments[0] ?? null;
        const tone = tileTone(isComplete, rejectedDocuments.length > 0);

        return (
          <View key={section.type} style={[styles.documentTile, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <View style={[styles.tileAccent, { backgroundColor: tone.accent }]} />

            <View style={styles.documentTop}>
              <View style={[styles.documentIcon, { backgroundColor: tone.soft }]}>
                <MaterialCommunityIcons name={section.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={21} color={tone.accent} />
              </View>

              <View style={styles.documentCopy}>
                <Text style={styles.documentTitle}>{section.title}</Text>
                <Text style={styles.documentBody} numberOfLines={2}>{displayDocument ? displayDocument.file_name : section.body}</Text>
              </View>

              <View style={[styles.statusBadge, { backgroundColor: tone.soft }]}>
                <Text style={[styles.statusBadgeText, { color: tone.accent }]}>{isComplete ? 'Uploaded' : rejectedDocuments.length ? 'Rejected' : 'Pending'}</Text>
              </View>
            </View>

            {!isComplete && rejectedDocuments[0]?.rejection_reason ? (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionLabel}>Reason</Text>
                <Text style={styles.rejectionText}>{rejectedDocuments[0].rejection_reason}</Text>
              </View>
            ) : null}

            {!isComplete ? (
              <View style={styles.actions}>
                <ActionButton icon="camera-outline" label="Camera" onPress={() => void takePhoto(section.type)} />
                <ActionButton icon="image-multiple-outline" label="Gallery" onPress={() => void choosePhoto(section.type)} />
                <ActionButton icon="file-upload-outline" label="File" onPress={() => void pickDocument(section.type)} />
              </View>
            ) : null}

            {file ? (
              <View style={styles.selectedFile}>
                <MaterialCommunityIcons name="paperclip" size={17} color={roleTheme.customer.accent} />
                <Text style={styles.selectedFileName} numberOfLines={1}>{uploadingType === section.type ? `Uploading ${file.name}` : file.name}</Text>
              </View>
            ) : null}

            {uploaded.map((document) => (
              <View key={document.id} style={styles.uploadedRow}>
                <View style={styles.uploadedCopy}>
                  <Text style={styles.uploadedMeta}>{documentStatusLabel(document.verification_status)}</Text>
                  <Text style={styles.uploadedName} numberOfLines={1}>{document.file_name}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => void openDocument(document)} style={styles.openButton}>
                  <MaterialCommunityIcons name="open-in-new" size={15} color={palette.navy} />
                  <Text style={styles.openButtonText}>Open</Text>
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}

      {selectedClaim ? (
        <Pressable accessibilityRole="button" onPress={() => setSubmitSuccessOpen(true)} style={styles.bottomButton}>
          <Text style={styles.bottomButtonText}>Submit Claim</Text>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
        </Pressable>
      ) : null}

      <ClaimSubmissionSuccessModal
        visible={submitSuccessOpen}
        claim={selectedClaim}
        vehicleNo={selectedVehicle?.vehicle_no}
        completionPercent={completionPercent}
        uploadedCount={completedCount}
        onClose={() => setSubmitSuccessOpen(false)}
        onView={() => {
          if (!selectedClaim) return;
          setSubmitSuccessOpen(false);
          router.push({ pathname: '/customer/claim-detail', params: { id: selectedClaim.id } });
        }}
      />
    </Screen>
  );
}

function ClaimSubmissionSuccessModal({ visible, claim, vehicleNo, completionPercent, uploadedCount, onClose, onView }: { visible: boolean; claim: Claim | null; vehicleNo?: string; completionPercent: number; uploadedCount: number; onClose: () => void; onView: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.successOverlay}>
        <View style={styles.submitSuccessCard}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.submitSuccessClose}>
            <MaterialCommunityIcons name="close" size={20} color={palette.slate} />
          </Pressable>
          <View style={styles.submitSuccessIcon}>
            <MaterialCommunityIcons name="shield-check-outline" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.submitSuccessTitle}>Claim Submitted</Text>
          <Text style={styles.submitSuccessBody}>Your claim details and uploaded documents have been shared with the claim desk.</Text>
          <View style={styles.submitSuccessInfo}>
            <View style={styles.submitInfoRow}><Text style={styles.submitInfoLabel}>Control No.</Text><Text style={styles.submitInfoValue}>{claim?.claim_no ?? '-'}</Text></View>
            <View style={styles.submitInfoRow}><Text style={styles.submitInfoLabel}>Vehicle</Text><Text style={styles.submitInfoValue}>{vehicleNo ?? '-'}</Text></View>
            <View style={styles.submitInfoRow}><Text style={styles.submitInfoLabel}>Documents</Text><Text style={styles.submitInfoValue}>{uploadedCount} uploaded • {completionPercent}% complete</Text></View>
          </View>
          <Pressable accessibilityRole="button" onPress={onView} style={styles.viewClaimButton}>
            <Text style={styles.viewClaimButtonText}>View Claim Details</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function InfoPair({ leftLabel, leftValue, rightLabel, rightValue }: { leftLabel: string; leftValue: string; rightLabel: string; rightValue: string }) {
  return (
    <View style={styles.infoPairRow}>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{leftLabel}: </Text>{leftValue}</Text>
      </View>
      <View style={styles.infoPairHalf}>
        <Text style={styles.infoPairText} numberOfLines={1}><Text style={styles.infoPairLabel}>{rightLabel}: </Text>{rightValue}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'navy' | 'green' | 'pink' }) {
  const color = tone === 'green' ? '#12805C' : tone === 'pink' ? '#C83272' : tone === 'navy' ? palette.navy : '#0B63CE';
  const bg = tone === 'green' ? '#E8F8F0' : tone === 'pink' ? '#FFF0F6' : '#EEF5FF';

  return (
    <View style={[styles.statBox, { backgroundColor: bg }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
      <MaterialCommunityIcons name={icon} size={16} color={palette.navy} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function tileTone(complete: boolean, rejected: boolean) {
  if (complete) return { accent: '#12805C', soft: '#E8F8F0', bg: '#F7FFFB', border: '#BFEBD0' };
  if (rejected) return { accent: '#C83272', soft: '#FFF0F6', bg: '#FFF8FB', border: '#F8BFD7' };
  return { accent: '#0B63CE', soft: '#EEF5FF', bg: '#F8FBFF', border: '#CFE0FF' };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function requestedFinalDocumentTypesFor(claimId: string, tasks: ClaimTask[]) {
  return tasks
    .filter((task) => task.claim_id === claimId && task.status === 'open' && task.title.startsWith('Final document: '))
    .map((task) => task.title.slice('Final document: '.length));
}

async function advanceAfterUpload(claim: Claim, documents: ClaimDocument[], changedBy: string, requestedFinalDocumentTypes: string[]) {
  const claimDocuments = documents.filter((document) => document.claim_id === claim.id);
  const nextStatus = documentDrivenStatusFor(claim, claimDocuments, requestedFinalDocumentTypes);
  if (!nextStatus) return null;

  const { error } = await supabase.from('claims').update({ current_status: nextStatus }).eq('id', claim.id);
  if (error) return null;

  try {
    await recordClaimEvent({
      claimId: claim.id,
      customerId: claim.customer_id,
      fromStatus: claim.current_status,
      toStatus: nextStatus,
      notes: 'Required document checklist completed.',
      changedBy,
      title: `Documents uploaded for ${claim.claim_no}`,
    });
  } catch {
    // non-critical
  }

  return nextStatus;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  pageIndicator: { marginTop: -18, marginBottom: 8 },
  pageTitle: { color: palette.navy, fontSize: 18, fontWeight: '900' },
  pageSub: { color: palette.slate, fontSize: 11.5, fontWeight: '800', marginTop: 2 },

  vehicleSummary: { backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0FF', borderRadius: 16, padding: 12, paddingLeft: 16, marginBottom: 10, overflow: 'hidden' },
  summaryAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: palette.navy },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  vehicleNo: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  vehicleMeta: { color: palette.slate, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  policyStatus: { backgroundColor: '#E8F8F0', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  policyStatusText: { color: '#12805C', fontSize: 9.7, fontWeight: '900' },
  summaryInfo: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5ECF5', gap: 4 },
  infoPairRow: { flexDirection: 'row', gap: 8 },
  infoPairHalf: { flex: 1, minWidth: 0 },
  infoPairText: { color: palette.ink, fontSize: 10.9, lineHeight: 15, fontWeight: '800' },
  infoPairLabel: { color: palette.slate, fontSize: 10.1, fontWeight: '900' },

  claimPicker: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 16, padding: 12, marginBottom: 10 },
  claimPickerTitle: { color: palette.navy, fontSize: 13, fontWeight: '900', marginBottom: 8 },
  claimOption: { borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: '#F8FBFF' },
  claimOptionActive: { backgroundColor: '#EEF5FF', borderColor: '#C7DAFF' },
  claimOptionText: { color: palette.ink, fontSize: 12.5, fontWeight: '900' },
  claimOptionTextActive: { color: palette.navy },
  claimOptionSub: { color: palette.slate, fontSize: 11, fontWeight: '700', marginTop: 2 },

  progressCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 18, padding: 13, marginBottom: 10 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  progressTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  progressSub: { color: palette.slate, fontSize: 11.2, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  percentBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  percentText: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: '#E8EEF7', overflow: 'hidden', marginTop: 11 },
  progressFill: { height: 8, borderRadius: 99, backgroundColor: palette.navy },
  statRow: { flexDirection: 'row', gap: 7, marginTop: 11 },
  statBox: { flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '900' },
  statLabel: { color: palette.slate, fontSize: 9.2, fontWeight: '800', marginTop: 2 },

  documentTile: { borderWidth: 1, borderRadius: 17, padding: 12, paddingLeft: 16, marginBottom: 10, overflow: 'hidden' },
  tileAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  documentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  documentIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitle: { color: palette.ink, fontSize: 13.2, fontWeight: '900' },
  documentBody: { color: palette.slate, fontSize: 11.2, lineHeight: 16, fontWeight: '700', marginTop: 2 },
  statusBadge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  statusBadgeText: { fontSize: 9.5, fontWeight: '900' },

  rejectionBox: { marginTop: 9, borderRadius: 12, borderWidth: 1, borderColor: '#F8BFD7', backgroundColor: '#FFFFFF', padding: 9 },
  rejectionLabel: { color: '#C83272', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  rejectionText: { color: palette.ink, fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 2 },

  actions: { flexDirection: 'row', gap: 7, marginTop: 11 },
  actionButton: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1, borderColor: '#C7DAFF', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionButtonText: { color: palette.navy, fontSize: 11.2, fontWeight: '900' },
  selectedFile: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 9, marginTop: 9 },
  selectedFileName: { color: palette.ink, fontSize: 12, fontWeight: '700', flex: 1 },

  uploadedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5ECF5', marginTop: 9, paddingTop: 9, gap: 10 },
  uploadedCopy: { flex: 1, minWidth: 0 },
  uploadedMeta: { color: '#12805C', fontSize: 11.5, fontWeight: '900' },
  uploadedName: { color: palette.slate, fontSize: 11.2, fontWeight: '700', marginTop: 2 },
  openButton: { minWidth: 72, height: 34, borderRadius: 11, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  openButtonText: { color: palette.navy, fontSize: 11, fontWeight: '900' },

  bottomButton: { height: 46, borderRadius: 15, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 12 },
  bottomButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(7, 18, 36, 0.46)', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  submitSuccessCard: { width: '100%', maxWidth: 370, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.22, shadowRadius: 24, elevation: 10 },
  submitSuccessClose: { position: 'absolute', right: 12, top: 11, width: 34, height: 34, borderRadius: 12, backgroundColor: '#F6FAFF', alignItems: 'center', justifyContent: 'center' },
  submitSuccessIcon: { width: 60, height: 60, borderRadius: 22, backgroundColor: '#12805C', alignItems: 'center', justifyContent: 'center', shadowColor: '#12805C', shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  submitSuccessTitle: { color: palette.navy, fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 13, textAlign: 'center' },
  submitSuccessBody: { color: palette.slate, fontSize: 12.5, lineHeight: 18, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  submitSuccessInfo: { alignSelf: 'stretch', borderRadius: 16, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 11, marginTop: 14, gap: 7 },
  submitInfoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  submitInfoLabel: { color: palette.slate, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },
  submitInfoValue: { color: palette.ink, fontSize: 11.5, fontWeight: '900', flex: 1, textAlign: 'right' },
  viewClaimButton: { alignSelf: 'stretch', minHeight: 48, borderRadius: 15, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 15 },
  viewClaimButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
