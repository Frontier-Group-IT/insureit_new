import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { finalDocumentGroups, type FinalDocumentGroup, type RequiredDocument } from '@/lib/claim-documents';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { ClaimDocument } from '@/lib/types';

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const BULK_DOCUMENT_TYPE = 'Additional Claim Document';
const BULK_UPLOAD_KEY = '__bulk__';
const DELETE_UPLOAD_KEY = '__delete__';

function documentArtwork(type: string) {
  if (type === 'RC Copy') return require('../assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png');
  if (type === 'Insurance copy') return require('../assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png');
  if (type === 'Driver Licence') return require('../assets/brand/spot-intimation/glossy_purple_id_card_icon.png');
  if (type === 'GR/Load bill') return require('../assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png');
  return null;
}

const orderedGroups: Array<{ key: string; label: string }> = [
  { key: 'spots-papers', label: 'Vehicle Docs' },
  { key: 'driver-docs', label: 'Driver Docs' },
  { key: 'permit-tax', label: 'Permit / Tax' },
  { key: 'kyc-dealership', label: 'KYC / Other' },
  { key: 'forms', label: 'Forms' },
];

export function ExternalClaimDocumentTabs({ claimId, customerId }: { claimId: string; customerId: string }) {
  const [activeKey, setActiveKey] = useState(orderedGroups[0].key);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [uploadingType, setUploadingType] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from('claim_documents').select('*').eq('claim_id', claimId).order('created_at', { ascending: false });
      if (active) setDocuments(data ?? []);
    })();
    return () => { active = false; };
  }, [claimId]);

  const groups = useMemo(() => orderedGroups.map((item) => ({
    ...item,
    group: finalDocumentGroups.find((group) => group.key === item.key),
  })).filter((item): item is { key: string; label: string; group: FinalDocumentGroup } => Boolean(item.group)), []);

  const activeGroup = groups.find((item) => item.key === activeKey) ?? groups[0];
  const bulkUploadedCount = documents.filter((item) => item.document_type === BULK_DOCUMENT_TYPE && item.verification_status !== 'rejected').length;
  const bulkUploading = uploadingType === BULK_UPLOAD_KEY;
  const deleting = uploadingType.startsWith(DELETE_UPLOAD_KEY);

  async function pickAndUpload(document: RequiredDocument) {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    if (file.size !== undefined && file.size !== null && file.size > MAX_UPLOAD_SIZE_BYTES) {
      setMessage('Please choose a file smaller than 5 MB.');
      return;
    }

    setUploadingType(document.type);
    try {
      const session = await getCurrentSession();
      if (!session?.user) {
        setMessage('Please sign in again before uploading.');
        return;
      }
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const storagePath = `${customerId}/${claimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_UPLOAD_SIZE_BYTES) {
        setMessage('Please choose a file smaller than 5 MB.');
        return;
      }
      const storageResult = await supabase.storage.from('claim-documents').upload(storagePath, body, {
        contentType: file.mimeType ?? 'application/octet-stream',
        upsert: false,
      });
      if (storageResult.error) {
        setMessage('This document could not be uploaded.');
        return;
      }
      const { data, error } = await supabase.from('claim_documents').insert({
        claim_id: claimId,
        customer_id: customerId,
        document_type: document.type,
        file_name: file.name,
        storage_bucket: 'claim-documents',
        storage_path: storagePath,
        mime_type: file.mimeType ?? null,
        file_size: file.size ?? null,
        uploaded_by: session.user.id,
      }).select('*').single();
      if (error || !data) {
        setMessage('The file uploaded, but its claim record could not be saved.');
        return;
      }
      setDocuments((current) => [data, ...current]);
    } catch {
      setMessage('This document could not be uploaded.');
    } finally {
      setUploadingType('');
    }
  }

  async function deleteUploadedDocument(document: ClaimDocument) {
    if (uploadingType) return;
    setMessage('');
    setUploadingType(`${DELETE_UPLOAD_KEY}${document.id}`);
    try {
      const removeRecord = await supabase.from('claim_documents').delete().eq('id', document.id).eq('claim_id', claimId);
      if (removeRecord.error) {
        setMessage('This document could not be deleted. Please try again.');
        return;
      }
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      if (document.storage_bucket && document.storage_path) {
        const storageResult = await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
        if (storageResult.error) setMessage('Document removed from the claim, but storage cleanup could not be completed.');
      }
    } catch {
      setMessage('This document could not be deleted. Please try again.');
    } finally {
      setUploadingType('');
    }
  }

  async function deleteBulkDocuments() {
    if (uploadingType || !bulkUploadedCount) return;
    setMessage('');
    setUploadingType(`${DELETE_UPLOAD_KEY}bulk`);
    try {
      const bulkDocuments = documents.filter((item) => item.document_type === BULK_DOCUMENT_TYPE && item.verification_status !== 'rejected');
      const ids = bulkDocuments.map((item) => item.id).filter(Boolean);
      if (!ids.length) return;
      const removeRecords = await supabase.from('claim_documents').delete().in('id', ids).eq('claim_id', claimId);
      if (removeRecords.error) {
        setMessage('Uploaded documents could not be deleted. Please try again.');
        return;
      }
      setDocuments((current) => current.filter((item) => !ids.includes(item.id)));
      const pathsByBucket = new Map<string, string[]>();
      for (const document of bulkDocuments) {
        if (!document.storage_bucket || !document.storage_path) continue;
        pathsByBucket.set(document.storage_bucket, [...(pathsByBucket.get(document.storage_bucket) ?? []), document.storage_path]);
      }
      for (const [bucket, paths] of pathsByBucket) {
        const storageResult = await supabase.storage.from(bucket).remove(paths);
        if (storageResult.error) setMessage('Documents removed from the claim, but some storage cleanup could not be completed.');
      }
    } catch {
      setMessage('Uploaded documents could not be deleted. Please try again.');
    } finally {
      setUploadingType('');
    }
  }

  async function pickAndUploadSeveral() {
    if (uploadingType) return;
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const tooLarge = result.assets.find((file) => file.size !== undefined && file.size !== null && file.size > MAX_UPLOAD_SIZE_BYTES);
    if (tooLarge) {
      setMessage(`${tooLarge.name} is larger than 5 MB. Please choose smaller files.`);
      return;
    }

    setUploadingType(BULK_UPLOAD_KEY);
    try {
      const session = await getCurrentSession();
      if (!session?.user) {
        setMessage('Please sign in again before uploading.');
        return;
      }

      const saved: ClaimDocument[] = [];
      let failed = 0;
      for (const file of result.assets) {
        let storagePath = '';
        try {
          const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
          storagePath = `${customerId}/${claimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const response = await fetch(file.uri);
          const body = await response.arrayBuffer();
          if (body.byteLength > MAX_UPLOAD_SIZE_BYTES) {
            failed += 1;
            continue;
          }
          const storageResult = await supabase.storage.from('claim-documents').upload(storagePath, body, {
            contentType: file.mimeType ?? 'application/octet-stream',
            upsert: false,
          });
          if (storageResult.error) {
            failed += 1;
            continue;
          }
          const { data, error } = await supabase.from('claim_documents').insert({
            claim_id: claimId,
            customer_id: customerId,
            document_type: BULK_DOCUMENT_TYPE,
            file_name: file.name,
            storage_bucket: 'claim-documents',
            storage_path: storagePath,
            mime_type: file.mimeType ?? null,
            file_size: file.size ?? body.byteLength,
            uploaded_by: session.user.id,
          }).select('*').single();
          if (error || !data) {
            await supabase.storage.from('claim-documents').remove([storagePath]);
            failed += 1;
            continue;
          }
          saved.push(data as ClaimDocument);
        } catch {
          if (storagePath) await supabase.storage.from('claim-documents').remove([storagePath]);
          failed += 1;
        }
      }

      if (saved.length) setDocuments((current) => [...saved, ...current]);
      if (failed) {
        setMessage(`${saved.length} of ${result.assets.length} files uploaded. Please retry the remaining ${failed}.`);
      }
    } finally {
      setUploadingType('');
    }
  }

  if (!activeGroup) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Document Upload <Text style={styles.optional}>(Optional)</Text></Text>
          <Text style={styles.subtitle}>All managed-claim document types are available here.</Text>
        </View>
        <View style={styles.optionalBadge}><Text style={styles.optionalBadgeText}>All optional</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {groups.map((item, index) => {
          const active = item.key === activeGroup.key;
          return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setActiveKey(item.key)} style={[styles.tab, active && styles.tabActive]}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{index + 1}. {item.label}</Text>
          </Pressable>;
        })}
      </ScrollView>

      {message ? <View style={styles.message}><MaterialCommunityIcons name="alert-circle-outline" size={17} color="#A15C00" /><Text style={styles.messageText}>{message}</Text></View> : null}

      <View style={styles.grid}>
        {activeGroup.group.documents.map((document) => {
          const uploaded = documents.find((item) => item.document_type === document.type && item.verification_status !== 'rejected');
          const uploading = uploadingType === document.type;
          const artwork = documentArtwork(document.type);
          return <View key={document.type} style={[styles.documentCard, uploaded && styles.documentCardUploaded]}>
            {uploaded ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${document.title}`} disabled={Boolean(uploadingType)} onPress={() => void deleteUploadedDocument(uploaded)} hitSlop={8} style={styles.documentDeleteButton}><MaterialCommunityIcons name="close" size={15} color="#60738B" /></Pressable> : null}
            <View style={[styles.documentIcon, uploaded && styles.documentIconUploaded]}>
              {artwork ? <Image source={artwork} style={styles.documentArtwork} resizeMode="contain" /> : <MaterialCommunityIcons name={(document.icon || 'file-document-outline') as keyof typeof MaterialCommunityIcons.glyphMap} size={23} color={uploaded ? '#FFFFFF' : '#0A43A3'} />}
            </View>
            <Text style={styles.documentTitle} numberOfLines={2}>{document.title}</Text>
            <Text style={styles.documentBody} numberOfLines={2}>{uploaded ? 'Uploaded' : document.body}</Text>
            <Pressable accessibilityRole="button" disabled={Boolean(uploadingType)} onPress={() => void pickAndUpload(document)} style={[styles.uploadButton, uploaded && styles.replaceButton, Boolean(uploadingType) && !uploading && styles.uploadButtonDisabled]}>
              <MaterialCommunityIcons name={uploaded ? 'refresh' : 'upload-outline'} size={15} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>{uploading ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}</Text>
            </Pressable>
          </View>;
        })}
      </View>

      <View style={styles.bulkWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload several claim documents"
          accessibilityState={{ disabled: Boolean(uploadingType) }}
          disabled={Boolean(uploadingType)}
          onPress={() => void pickAndUploadSeveral()}
          style={({ pressed }) => [styles.bulkHint, bulkUploadedCount > 0 && styles.bulkHintUploaded, pressed && styles.bulkHintPressed, Boolean(uploadingType) && styles.bulkHintDisabled]}
        >
          <View style={[styles.bulkIcon, bulkUploadedCount > 0 && styles.bulkIconUploaded]}>
            <MaterialCommunityIcons name={bulkUploadedCount > 0 ? 'check' : 'cloud-upload-outline'} size={22} color={bulkUploadedCount > 0 ? '#18864B' : '#0A43A3'} />
          </View>
          <View style={styles.bulkCopy}>
            <Text style={styles.bulkTitle}>{bulkUploading ? 'Uploading selected files…' : 'Need to upload several files?'}</Text>
            <Text style={styles.bulkText}>{bulkUploading ? 'Please keep this page open while the files are saved.' : bulkUploadedCount > 0 ? `${bulkUploadedCount} additional file${bulkUploadedCount === 1 ? '' : 's'} uploaded · Tap to add more.` : 'Tap here to select multiple PDF or image files at once. They will be saved as additional claim documents.'}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={bulkUploadedCount > 0 ? '#18864B' : '#0A43A3'} />
        </Pressable>
        {bulkUploadedCount > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Delete all uploaded additional claim documents" disabled={Boolean(uploadingType)} onPress={() => void deleteBulkDocuments()} hitSlop={8} style={styles.bulkDeleteButton}><MaterialCommunityIcons name="close" size={15} color="#60738B" /></Pressable> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', marginBottom: 12, overflow: 'hidden', shadowColor: '#14375F', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  headerRow: { padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { color: palette.navy, fontSize: 15, fontWeight: '900' }, optional: { color: '#62738A', fontWeight: '700' }, subtitle: { color: '#6D7B8F', fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  optionalBadge: { borderRadius: 999, backgroundColor: '#EEF5FF', paddingHorizontal: 9, paddingVertical: 5 }, optionalBadgeText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900' },
  tabs: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E6EDF5', backgroundColor: '#F7FAFF' }, tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: '#165DDB', backgroundColor: '#FFFFFF' }, tabText: { color: '#667085', fontSize: 9.8, fontWeight: '800' }, tabTextActive: { color: '#0A43A3' },
  message: { margin: 12, marginBottom: 0, borderRadius: 11, backgroundColor: '#FFF6E5', padding: 9, flexDirection: 'row', gap: 7, alignItems: 'center' }, messageText: { flex: 1, color: '#855200', fontSize: 10, lineHeight: 14, fontWeight: '700' },
  grid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, documentArtwork: { width: 42, height: 42 }, documentCard: { width: '48%', minHeight: 170, borderRadius: 15, borderWidth: 1, borderColor: '#DFE6EE', backgroundColor: '#FCFDFF', padding: 10, alignItems: 'center', position: 'relative' }, documentCardUploaded: { borderColor: '#9FD4B6', backgroundColor: '#F1FBF5' }, documentDeleteButton: { position: 'absolute', top: 7, right: 7, zIndex: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD7E2', alignItems: 'center', justifyContent: 'center' }, documentIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, documentIconUploaded: { backgroundColor: '#168161' }, documentTitle: { color: palette.navy, fontSize: 10.5, lineHeight: 14, fontWeight: '900', textAlign: 'center', minHeight: 29 }, documentBody: { color: '#7A8799', fontSize: 8.8, lineHeight: 12, fontWeight: '600', textAlign: 'center', marginTop: 3, flex: 1 }, uploadButton: { minHeight: 34, borderRadius: 10, backgroundColor: '#0A43A3', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'stretch', marginTop: 8 }, replaceButton: { backgroundColor: '#168161' }, uploadButtonDisabled: { opacity: 0.55 }, uploadButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  bulkWrap: { position: 'relative' }, bulkHint: { margin: 12, marginTop: 0, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#91A9C8', backgroundColor: '#F8FBFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, bulkHintUploaded: { borderStyle: 'solid', borderColor: '#9FD4B6', backgroundColor: '#F1FBF5', paddingRight: 42 }, bulkHintPressed: { backgroundColor: '#EEF5FF' }, bulkHintDisabled: { opacity: 0.6 }, bulkIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, bulkIconUploaded: { backgroundColor: '#E1F5E9' }, bulkCopy: { flex: 1, minWidth: 0 }, bulkTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, bulkText: { color: '#708097', fontSize: 9.3, lineHeight: 13, fontWeight: '600', marginTop: 2 }, bulkDeleteButton: { position: 'absolute', top: 8, right: 20, zIndex: 2, width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD7E2', alignItems: 'center', justifyContent: 'center' },
});