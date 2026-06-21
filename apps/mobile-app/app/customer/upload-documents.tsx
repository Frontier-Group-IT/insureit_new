import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge, AppSearchSelect } from '@/components/design-system';
import { Card, Message, Screen } from '@/components/ui';
import { customerStageCopy } from '@/lib/claim-workflow';
import { ensureCustomerForUser, getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { documentDrivenStatusFor, documentStatusLabel, requiredDocumentsForStatus } from '@/lib/claim-documents';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Claim, ClaimDocument, ClaimTask } from '@/lib/types';

type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export default function UploadDocumentsScreen() {
  const router = useRouter();
  const { claimId } = useLocalSearchParams<{ claimId?: string }>();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState(claimId ?? '');
  const [files, setFiles] = useState<Record<string, PickedFile | null>>({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingType, setUploadingType] = useState('');

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const [claimsResult, documentsResult, tasksResult] = await Promise.all([
          supabase.from('claims').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
          supabase.from('claim_documents').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
          supabase.from('claim_tasks').select('*').order('created_at', { ascending: false }),
        ]);
        const nextClaims = claimsResult.data ?? [];
        setClaims(nextClaims);
        setDocuments(documentsResult.data ?? []);
        setTasks(tasksResult.data ?? []);
        if (claimId) setSelectedClaimId(claimId);
        else if (nextClaims.length === 1) setSelectedClaimId(nextClaims[0].id);
      }
    }
    void load();
  }, [claimId, router]);

  const selectedClaim = useMemo(() => claims.find((item) => item.id === selectedClaimId) ?? null, [claims, selectedClaimId]);
  const selectedDocuments = useMemo(() => selectedClaim ? documents.filter((item) => item.claim_id === selectedClaim.id) : [], [documents, selectedClaim]);
  const requestedFinalDocumentTypes = useMemo(() => selectedClaim ? requestedFinalDocumentTypesFor(selectedClaim.id, tasks) : [], [selectedClaim, tasks]);
  const documentSections = useMemo(() => requiredDocumentsForStatus(selectedClaim?.current_status, requestedFinalDocumentTypes), [selectedClaim?.current_status, requestedFinalDocumentTypes]);
  const completedCount = documentSections.filter((section) => selectedDocuments.some((item) => item.document_type === section.type && item.verification_status !== 'rejected')).length;
  const completionPercent = Math.round((completedCount / documentSections.length) * 100);

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
      await handlePickedFile(documentType, { uri: asset.uri, name: asset.fileName ?? `${slug(documentType)}-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? null });
    }
  }

  async function choosePhoto(documentType: string) {
    setMessage('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handlePickedFile(documentType, { uri: asset.uri, name: asset.fileName ?? `${slug(documentType)}-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? null });
    }
  }

  async function pickDocument(documentType: string) {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handlePickedFile(documentType, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null });
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
      const file = pickedFile;
      if (!customer) return setMessage('Your customer profile is not ready yet. Please contact support.');
      if (!selectedClaim || !file) return setMessage('Select a claim and attach a file.');

      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const storagePath = `${customer.id}/${selectedClaim.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_UPLOAD_SIZE_BYTES) {
        setMessage(`${file.name} is larger than 5 MB. Please choose a smaller file.`);
        return;
      }
      const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
      if (uploadResult.error) return setMessage('This file could not be uploaded.');
      const { data, error } = await supabase.from('claim_documents').insert({
        claim_id: selectedClaim.id,
        customer_id: customer.id,
        document_type: documentType,
        file_name: file.name,
        storage_bucket: 'claim-documents',
        storage_path: storagePath,
        mime_type: file.mimeType,
        file_size: file.size,
        uploaded_by: session.user.id,
      }).select('*').single();
      if (error) setMessage('The file uploaded, but the document record could not be saved.');
      else {
        setSuccess(`${documentType} uploaded.`);
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
    <Screen title="Claim Documents" subtitle="Upload and review files.">
      {message ? <Message type="error">{message}</Message> : null}
      {success ? <Message type="success">{success}</Message> : null}
      <Card style={styles.claimCard}>
        <View style={styles.claimWash} />
        <View style={styles.claimWashAlt} />
        <View style={styles.claimHeader}>
          <View style={styles.claimIcon}>
            <MaterialCommunityIcons name="file-document-edit-outline" size={24} color={roleTheme.customer.accent} />
          </View>
          <View style={styles.claimHeaderCopy}>
            <Text style={styles.claimEyebrow}>Documents</Text>
            <Text style={styles.claimTitle}>Claim files</Text>
          </View>
          <View style={styles.progressRing}>
            <Text style={styles.progressText}>{completionPercent}%</Text>
          </View>
        </View>
        <AppSearchSelect
          label="Claim number"
          placeholder="Search claim"
          options={claims}
          selectedId={selectedClaimId}
          onSelect={(claim) => setSelectedClaimId(claim.id)}
          getTitle={(claim) => claim.claim_no}
          getSubtitle={(claim) => [claim.current_status, claim.created_at?.slice(0, 10)].filter(Boolean).join(' | ')}
        />
        {selectedClaim ? (
          <View style={styles.selectedClaimPanel}>
            <View style={styles.selectedClaimRow}>
              <AppBadge label={selectedClaim.current_status} tone="info" />
              <Text style={styles.selectedClaimMeta}>{completedCount}/{documentSections.length} uploaded</Text>
            </View>
            <Text style={styles.claimGuidance}>{customerStageCopy(selectedClaim.current_status)}</Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.requiredHeader}>
        <View>
          <Text style={styles.requiredKicker}>Checklist</Text>
          <Text style={styles.requiredTitle}>Required documents</Text>
        </View>
        <Text style={styles.requiredCount}>{completedCount}/{documentSections.length}</Text>
      </View>
      {documentSections.map((section) => {
        const file = files[section.type];
        const uploaded = selectedDocuments.filter((item) => item.document_type === section.type);
        const acceptedDocuments = uploaded.filter((item) => item.verification_status !== 'rejected');
        const rejectedDocuments = uploaded.filter((item) => item.verification_status === 'rejected');
        const isComplete = acceptedDocuments.length > 0;
        const displayDocument = acceptedDocuments[0] ?? rejectedDocuments[0] ?? null;
        return (
          <Card key={section.type} style={[styles.documentCard, isComplete && styles.documentCardComplete, !isComplete && rejectedDocuments.length > 0 && styles.documentCardRejected]}>
            <View style={styles.documentHeader}>
              <View style={[styles.documentIcon, isComplete && styles.documentIconComplete, !isComplete && rejectedDocuments.length > 0 && styles.documentIconRejected]}>
                <MaterialCommunityIcons name={section.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={22} color={isComplete ? palette.emerald : rejectedDocuments.length > 0 ? palette.coral : roleTheme.customer.accent} />
              </View>
              <View style={styles.documentCopy}>
                <Text style={styles.documentTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{displayDocument ? displayDocument.file_name : section.body}</Text>
                {!isComplete && rejectedDocuments[0]?.rejection_reason ? <Text style={styles.rejectionText}>{rejectedDocuments[0].rejection_reason}</Text> : null}
              </View>
              {isComplete ? <AppBadge label="Uploaded" tone="success" /> : rejectedDocuments.length > 0 ? <AppBadge label="Reupload" tone="danger" /> : null}
            </View>
            {!isComplete ? (
              <>
                <View style={styles.actions}>
                  <CompactButton icon="camera-outline" label="Camera" onPress={() => void takePhoto(section.type)} />
                  <CompactButton icon="image-multiple-outline" label="Gallery" onPress={() => void choosePhoto(section.type)} />
                  <CompactButton icon="file-upload-outline" label="File" onPress={() => void pickDocument(section.type)} />
                </View>
                {file ? (
                  <View style={styles.selectedFile}>
                    <MaterialCommunityIcons name="paperclip" size={17} color={roleTheme.customer.accent} />
                    <Text style={styles.selectedFileName} numberOfLines={1}>{uploadingType === section.type ? `Uploading ${file.name}` : file.name}</Text>
                  </View>
                ) : null}
              </>
            ) : null}
            {uploaded.map((document) => (
              <View key={document.id} style={styles.uploadedRow}>
                <View style={styles.uploadedCopy}>
                  <Text style={styles.uploadedMeta}>{documentStatusLabel(document.verification_status)}</Text>
                  <Text style={styles.uploadedName} numberOfLines={1}>{document.file_name}</Text>
                </View>
                <CompactButton icon="open-in-new" label="Open" onPress={() => void openDocument(document)} />
              </View>
            ))}
          </Card>
        );
      })}
    </Screen>
  );
}

function CompactButton({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.compactButton}>
      <MaterialCommunityIcons name={icon} size={16} color={palette.ink} />
      <Text style={styles.compactButtonText}>{label}</Text>
    </Pressable>
  );
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
    // Status history is non-critical for customer uploads; the document itself is already saved.
  }
  return nextStatus;
}

const styles = StyleSheet.create({
  claimCard: { padding: 14, overflow: 'hidden', backgroundColor: '#F8FBFF', borderColor: '#C9DDFF' },
  claimWash: { position: 'absolute', right: -64, top: -68, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(19,99,223,0.12)' },
  claimWashAlt: { position: 'absolute', left: -78, bottom: -96, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(15,159,110,0.1)' },
  claimHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  claimIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#D8E7FF', alignItems: 'center', justifyContent: 'center' },
  claimHeaderCopy: { flex: 1, minWidth: 0 },
  claimEyebrow: { color: roleTheme.customer.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0 },
  claimTitle: { color: palette.ink, fontSize: 19, fontWeight: '900', lineHeight: 24, marginTop: 2 },
  progressRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 4, borderColor: roleTheme.customer.soft, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  progressText: { color: palette.ink, fontSize: 12, fontWeight: '800' },
  selectedClaimPanel: { borderRadius: radii.sm, backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: '#D8E7FF', padding: 11, marginTop: 10 },
  selectedClaimRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  selectedClaimMeta: { color: palette.slate, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  claimGuidance: { color: palette.slate, fontSize: 12, fontWeight: '500', lineHeight: 18, marginTop: 8 },
  requiredHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, marginTop: 2 },
  requiredKicker: { color: roleTheme.customer.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  requiredTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', marginTop: 2 },
  requiredCount: { minWidth: 46, minHeight: 32, borderRadius: radii.sm, backgroundColor: roleTheme.customer.soft, color: roleTheme.customer.accent, fontSize: 13, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', paddingTop: 7 },
  documentCard: { padding: 12, borderRadius: radii.md, marginBottom: 9, backgroundColor: palette.surface, borderColor: palette.line },
  documentCardComplete: { backgroundColor: '#F6FCF9', borderColor: '#BCE9D2' },
  documentCardRejected: { backgroundColor: '#FFF7F7', borderColor: '#FAC7C9' },
  documentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  documentIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: roleTheme.customer.soft, alignItems: 'center', justifyContent: 'center' },
  documentIconComplete: { backgroundColor: palette.emeraldSoft },
  documentIconRejected: { backgroundColor: palette.coralSoft },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  sectionBody: { color: palette.slate, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  rejectionText: { color: palette.coral, fontSize: 12, fontWeight: '600', lineHeight: 17, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 11, marginBottom: 2 },
  compactButton: { minHeight: 38, flex: 1, borderRadius: radii.sm, borderWidth: 1, borderColor: '#D8E7FF', backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, flexDirection: 'row', gap: 5 },
  compactButtonText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  selectedFile: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt, borderWidth: 1, borderColor: palette.line, padding: 9, marginTop: 9 },
  selectedFileName: { color: palette.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  uploadedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.line, marginTop: 9, paddingTop: 9, gap: 10 },
  uploadedCopy: { flex: 1, minWidth: 0 },
  uploadedMeta: { color: palette.emerald, fontSize: 12, fontWeight: '700' },
  uploadedName: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 2 },
});



