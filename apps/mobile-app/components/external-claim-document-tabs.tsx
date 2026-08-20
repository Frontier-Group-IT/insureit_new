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
            <View style={[styles.documentIcon, uploaded && styles.documentIconUploaded]}>
              {artwork ? <Image source={artwork} style={styles.documentArtwork} resizeMode="contain" /> : <MaterialCommunityIcons name={(document.icon || 'file-document-outline') as keyof typeof MaterialCommunityIcons.glyphMap} size={23} color={uploaded ? '#FFFFFF' : '#0A43A3'} />}
            </View>
            <Text style={styles.documentTitle} numberOfLines={2}>{document.title}</Text>
            <Text style={styles.documentBody} numberOfLines={2}>{uploaded ? 'Uploaded' : document.body}</Text>
            <Pressable accessibilityRole="button" disabled={uploading} onPress={() => void pickAndUpload(document)} style={[styles.uploadButton, uploaded && styles.replaceButton]}>
              <MaterialCommunityIcons name={uploaded ? 'refresh' : 'upload-outline'} size={15} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>{uploading ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}</Text>
            </Pressable>
          </View>;
        })}
      </View>

      <View style={styles.bulkHint}>
        <View style={styles.bulkIcon}><MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#0A43A3" /></View>
        <View style={{ flex: 1 }}><Text style={styles.bulkTitle}>Need to upload several files?</Text><Text style={styles.bulkText}>Upload documents one by one in the correct tab so each file keeps the right claim document type.</Text></View>
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
  grid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, documentArtwork: { width: 42, height: 42 }, documentCard: { width: '48%', minHeight: 170, borderRadius: 15, borderWidth: 1, borderColor: '#DFE6EE', backgroundColor: '#FCFDFF', padding: 10, alignItems: 'center' }, documentCardUploaded: { borderColor: '#B6DEC9', backgroundColor: '#F8FFFB' }, documentIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, documentIconUploaded: { backgroundColor: '#168161' }, documentTitle: { color: palette.navy, fontSize: 10.5, lineHeight: 14, fontWeight: '900', textAlign: 'center', minHeight: 29 }, documentBody: { color: '#7A8799', fontSize: 8.8, lineHeight: 12, fontWeight: '600', textAlign: 'center', marginTop: 3, flex: 1 }, uploadButton: { minHeight: 34, borderRadius: 10, backgroundColor: '#0A43A3', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'stretch', marginTop: 8 }, replaceButton: { backgroundColor: '#168161' }, uploadButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  bulkHint: { margin: 12, marginTop: 0, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#91A9C8', backgroundColor: '#F8FBFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, bulkIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, bulkTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, bulkText: { color: '#708097', fontSize: 9.3, lineHeight: 13, fontWeight: '600', marginTop: 2 },
});
