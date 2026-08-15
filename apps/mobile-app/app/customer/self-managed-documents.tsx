import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { SELF_MANAGED_MILESTONES, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

type ClaimRow = {
  id: string;
  claim_no: string;
  customer_id: string;
  claim_service_mode: string;
  assistance_status: string;
};

type DocumentRow = {
  id: string;
  claim_id: string;
  customer_id: string;
  milestone_key: ClaimMilestoneKey | null;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  verification_required: boolean;
  created_at: string;
};

type DocDefinition = { type: string; label: string };

const DOCS: Record<ClaimMilestoneKey, DocDefinition[]> = {
  spot_intimation: [
    { type: 'rc_copy', label: 'RC Copy' },
    { type: 'insurance_copy', label: 'Insurance Copy' },
    { type: 'driving_licence', label: 'Driving Licence' },
    { type: 'gr_copy', label: 'GR Copy' },
  ],
  spot_status: [],
  claim_intimation: [
    { type: 'rc_copy', label: 'RC Copy' },
    { type: 'insurance_copy', label: 'Insurance Copy' },
    { type: 'permit_copy', label: 'Permit' },
    { type: 'road_tax_copy', label: 'Road Tax' },
    { type: 'fitness_copy', label: 'Fitness Certificate' },
    { type: 'affidavit', label: 'Affidavit' },
    { type: 'claim_form', label: 'Claim Form' },
    { type: 'kyc_document', label: 'KYC Document' },
  ],
  work_approval: [],
  repair_ri: [],
  billing: [{ type: 'final_bill', label: 'Final Bill' }],
  delivery_order: [
    { type: 'assessment_copy', label: 'Assessment Copy' },
    { type: 'delivery_order_copy', label: 'Delivery Order' },
  ],
  vehicle_delivery: [],
  payment_encashment: [
    { type: 'depreciation_slip', label: 'Depreciation Slip' },
    { type: 'satisfaction_voucher', label: 'Satisfaction Voucher' },
  ],
};

export default function SelfManagedDocumentsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Claim reference is missing.');
      setLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      const { data: claimData, error: claimError } = await supabase
        .from('claims')
        .select('id,claim_no,customer_id,claim_service_mode,assistance_status')
        .eq('id', id)
        .maybeSingle();

      if (!active) return;
      if (claimError || !claimData) {
        setError('We could not load this claim.');
        setLoading(false);
        return;
      }
      if (claimData.claim_service_mode !== 'self_managed') {
        router.replace({ pathname: '/customer/upload-documents', params: { claimId: claimData.id } });
        return;
      }

      const { data: documentData, error: documentError } = await supabase
        .from('claim_documents')
        .select('id,claim_id,customer_id,milestone_key,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_required,created_at')
        .eq('claim_id', claimData.id)
        .order('created_at', { ascending: false });

      if (!active) return;
      if (documentError) setError('Claim documents could not be loaded.');
      setClaim(claimData as ClaimRow);
      setDocuments((documentData ?? []) as DocumentRow[]);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [id, router]);

  const grouped = useMemo(() => {
    const result = new Map<ClaimMilestoneKey, DocumentRow[]>();
    SELF_MANAGED_MILESTONES.forEach((stage) => result.set(stage.key, []));
    documents.forEach((document) => {
      if (!document.milestone_key) return;
      result.get(document.milestone_key)?.push(document);
    });
    return result;
  }, [documents]);

  async function pickAndUpload(milestoneKey: ClaimMilestoneKey, definition: DocDefinition) {
    setError('');
    setSuccess('');
    if (!claim) return;
    if (claim.assistance_status === 'accepted') {
      setError('This claim is now being handled by Sankalp. Customer document changes are locked.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const file = result.assets[0];
    if (file.size != null && file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`${file.name} is larger than 5 MB. Please choose a smaller file.`);
      return;
    }

    const uploadKey = `${milestoneKey}:${definition.type}`;
    setUploading(uploadKey);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const storagePath = `${claim.customer_id}/${claim.id}/self-managed/${milestoneKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_UPLOAD_SIZE_BYTES) {
        setError(`${file.name} is larger than 5 MB. Please choose a smaller file.`);
        return;
      }

      const storageResult = await supabase.storage.from('claim-documents').upload(storagePath, body, {
        contentType: file.mimeType ?? 'application/octet-stream',
        upsert: false,
      });
      if (storageResult.error) {
        setError('This file could not be uploaded.');
        return;
      }

      const { data, error: insertError } = await supabase
        .from('claim_documents')
        .insert({
          claim_id: claim.id,
          customer_id: claim.customer_id,
          milestone_key: milestoneKey,
          document_type: definition.type,
          file_name: file.name,
          storage_bucket: 'claim-documents',
          storage_path: storagePath,
          mime_type: file.mimeType ?? null,
          file_size: file.size ?? null,
          uploaded_by: session.user.id,
          verification_required: false,
        } as never)
        .select('id,claim_id,customer_id,milestone_key,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_required,created_at')
        .single();

      if (insertError || !data) {
        await supabase.storage.from('claim-documents').remove([storagePath]);
        setError('The file uploaded, but its claim record could not be saved. Please try again.');
        return;
      }

      setDocuments((current) => [data as DocumentRow, ...current]);
      setSuccess(`${definition.label} saved to ${stageLabel(milestoneKey)}.`);
    } catch {
      setError('This file could not be uploaded.');
    } finally {
      setUploading('');
    }
  }

  async function openDocument(document: DocumentRow) {
    setError('');
    const { data, error: signedError } = await supabase.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 300);
    if (signedError || !data?.signedUrl) {
      setError('This document could not be opened.');
      return;
    }
    await Linking.openURL(data.signedUrl);
  }

  if (loading) {
    return <Screen title="Claim Documents" showTitleHeader={false}><LoadingState label="Opening document vault" /></Screen>;
  }
  if (error && !claim) {
    return <Screen title="Claim Documents" showTitleHeader={false}><Message type="error">{error}</Message></Screen>;
  }

  return (
    <Screen title="Claim Documents" showTitleHeader={false}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eye}>SELF-TRACKED CLAIM</Text>
          <Text style={styles.title}>Document Vault</Text>
          <Text style={styles.sub}>{claim?.claim_no ?? 'Claim'} • Files are saved to the stage where they belong.</Text>
        </View>
      </View>

      {error ? <Message type="error">{error}</Message> : null}
      {success ? <Message type="success">{success}</Message> : null}

      <View style={styles.info}>
        <MaterialCommunityIcons name="shield-check-outline" size={21} color="#0A6B4B" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Your claim record</Text>
          <Text style={styles.infoText}>These files support your self-tracked claim. They are saved in InsureIt but do not enter the Sankalp document-verification queue unless Sankalp later accepts assistance for this claim.</Text>
        </View>
      </View>

      {SELF_MANAGED_MILESTONES.map((stage, index) => {
        const definitions = DOCS[stage.key];
        const stageDocuments = grouped.get(stage.key) ?? [];
        return (
          <View key={stage.key} style={styles.stageCard}>
            <View style={styles.stageHead}>
              <View style={styles.stageNumber}><Text style={styles.stageNumberText}>{index + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stageTitle}>{stage.label}</Text>
                <Text style={styles.stageMeta}>{stageDocuments.length} file{stageDocuments.length === 1 ? '' : 's'} saved</Text>
              </View>
            </View>

            {definitions.length ? definitions.map((definition) => {
              const matches = stageDocuments.filter((document) => document.document_type === definition.type);
              const uploadKey = `${stage.key}:${definition.type}`;
              return (
                <View key={definition.type} style={styles.docRow}>
                  <View style={styles.docIcon}><MaterialCommunityIcons name="file-document-outline" size={19} color="#0A43A3" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>{definition.label}</Text>
                    {matches.length ? matches.slice(0, 2).map((document) => (
                      <Pressable key={document.id} onPress={() => void openDocument(document)} style={styles.savedFile}>
                        <MaterialCommunityIcons name="check-circle" size={14} color="#14845C" />
                        <Text style={styles.savedName} numberOfLines={1}>{document.file_name}</Text>
                        <MaterialCommunityIcons name="open-in-new" size={13} color="#667085" />
                      </Pressable>
                    )) : <Text style={styles.empty}>Optional • not uploaded</Text>}
                  </View>
                  <Pressable disabled={!!uploading} onPress={() => void pickAndUpload(stage.key, definition)} style={[styles.upload, uploading === uploadKey && styles.uploadBusy]}>
                    <MaterialCommunityIcons name={uploading === uploadKey ? 'progress-clock' : 'upload'} size={15} color="#FFF" />
                    <Text style={styles.uploadText}>{uploading === uploadKey ? 'Saving' : matches.length ? 'Add' : 'Upload'}</Text>
                  </Pressable>
                </View>
              );
            }) : (
              <View style={styles.noStandard}>
                <MaterialCommunityIcons name="information-outline" size={17} color="#667085" />
                <Text style={styles.noStandardText}>No standard document is required for this milestone in the current claim journey.</Text>
              </View>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

function stageLabel(key: ClaimMilestoneKey) {
  return SELF_MANAGED_MILESTONES.find((stage) => stage.key === key)?.label ?? 'claim stage';
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 0, marginBottom: 12 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  eye: { color: '#0A43A3', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: palette.navy, fontSize: 22, fontWeight: '900' },
  sub: { color: '#667085', fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 3 },
  info: { flexDirection: 'row', gap: 9, padding: 13, borderRadius: 16, backgroundColor: '#ECF9F3', borderWidth: 1, borderColor: '#BFE6D5', marginBottom: 12 },
  infoTitle: { color: '#0A5B41', fontSize: 11.5, fontWeight: '900' },
  infoText: { color: '#477061', fontSize: 9.8, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  stageCard: { borderRadius: 18, borderWidth: 1, borderColor: '#DDE7F2', backgroundColor: '#FFF', padding: 12, marginBottom: 11 },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  stageNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' },
  stageNumberText: { color: '#0A43A3', fontSize: 10, fontWeight: '900' },
  stageTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  stageMeta: { color: '#7A8799', fontSize: 9, fontWeight: '700', marginTop: 2 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' },
  docIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F6FD', alignItems: 'center', justifyContent: 'center' },
  docLabel: { color: '#344054', fontSize: 10.8, fontWeight: '900' },
  empty: { color: '#98A2B3', fontSize: 8.8, fontWeight: '600', marginTop: 2 },
  savedFile: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
  savedName: { maxWidth: 180, color: '#4F5F72', fontSize: 8.8, fontWeight: '700' },
  upload: { minWidth: 68, height: 34, paddingHorizontal: 9, borderRadius: 10, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.navy },
  uploadBusy: { opacity: 0.65 },
  uploadText: { color: '#FFF', fontSize: 8.8, fontWeight: '900' },
  noStandard: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingTop: 10 },
  noStandardText: { flex: 1, color: '#667085', fontSize: 9.5, lineHeight: 14, fontWeight: '600' },
});
