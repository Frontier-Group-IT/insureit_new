import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { ClaimFormSection } from '@/components/external-claim-ui';
import { InternalManagedClaimHeader } from '@/components/internal-managed-claim-header';
import { LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { prepareVideoForUpload } from '@/lib/video-compression';
import type { ClaimDocument } from '@/lib/types';

type DocumentKey = 'rc' | 'insurance' | 'licence' | 'gr' | 'accident_photo' | 'accident_video';
type PickedDocument = { name: string; uri: string; mimeType?: string | null; size?: number | null };
type ManagedClaim = {
  id: string;
  claim_no: string;
  insurer_claim_no: string | null;
  customer_id: string;
  vehicle_id: string;
  policy_id: string | null;
  claim_service_mode?: 'broker_managed' | 'self_managed' | null;
  accident_at: string | null;
  spot_intimation_at: string | null;
  accident_location: string | null;
  accident_description: string | null;
};

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const BULK_DOCUMENT_TYPE = 'Spot Intimation Attachment';
const DOCUMENT_TYPE_BY_KEY: Record<DocumentKey, string> = {
  rc: 'RC Copy',
  insurance: 'Insurance Copy',
  licence: 'Driver Licence',
  gr: 'GR / Load Bill',
  accident_photo: 'Accident Photo',
  accident_video: 'Accident Video',
};

export default function InternalClaimStageOneTracker() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const claimId = typeof id === 'string' ? id : '';
  const [claim, setClaim] = useState<ManagedClaim | null>(null);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleMeta, setVehicleMeta] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [insurerName, setInsurerName] = useState('Insurance company');
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<DocumentKey | 'bulk' | ''>('');
  const [videoStatus, setVideoStatus] = useState('');
  const [message, setMessage] = useState('');
  const [deleteType, setDeleteType] = useState('');

  useEffect(() => {
    if (!claimId) { setLoading(false); return; }
    let active = true;
    void (async () => {
      const [claimResult, documentResult] = await Promise.all([
        supabase.from('claims').select('id,claim_no,insurer_claim_no,customer_id,vehicle_id,policy_id,claim_service_mode,accident_at,spot_intimation_at,accident_location,accident_description').eq('id', claimId).maybeSingle(),
        supabase.from('claim_documents').select('*').eq('claim_id', claimId).order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      if (claimResult.error || !claimResult.data) {
        setMessage('This claim could not be loaded.');
        setLoading(false);
        return;
      }
      const nextClaim = claimResult.data as unknown as ManagedClaim;
      if (nextClaim.claim_service_mode !== 'broker_managed') {
        setMessage('This stage belongs to a different claim tracking mode.');
        setLoading(false);
        return;
      }
      setClaim(nextClaim);
      setDocuments((documentResult.data ?? []) as ClaimDocument[]);

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
          if (active && insurerResult.data?.name) setInsurerName(insurerResult.data.name);
        }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId]);

  const savedTypes = useMemo(() => new Set(documents.filter((item) => item.verification_status !== 'rejected').map((item) => item.document_type)), [documents]);
  const bulkCount = useMemo(() => documents.filter((item) => item.document_type === BULK_DOCUMENT_TYPE && item.verification_status !== 'rejected').length, [documents]);

  async function pickDocument(key: DocumentKey) {
    if (!claim || uploadingKey) return;
    setMessage('');
    const multi = key === 'accident_photo' || key === 'accident_video';
    const pickerTypes = key === 'accident_video' ? ['video/*'] : key === 'accident_photo' ? ['image/*'] : ['application/pdf', 'image/*'];
    let result: Awaited<ReturnType<typeof DocumentPicker.getDocumentAsync>>;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: pickerTypes, multiple: multi, copyToCacheDirectory: true });
    } catch {
      setMessage('The file picker could not be opened. Please try again.');
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const picked: PickedDocument[] = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size ?? null }));
    const limit = key === 'accident_video' ? MAX_VIDEO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
    const label = key === 'accident_video' ? '50 MB' : '5 MB';
    const tooLarge = picked.find((file) => file.size != null && file.size > limit);
    if (tooLarge) { setMessage(`${tooLarge.name} is larger than ${label}. Please choose smaller files.`); return; }

    setUploadingKey(key);
    const results = await runConcurrent(picked, 3, (file) => uploadFile(claim, DOCUMENT_TYPE_BY_KEY[key], file, key === 'accident_video'));
    const uploaded = results.filter((item): item is ClaimDocument => Boolean(item));
    if (uploaded.length) setDocuments((current) => [...uploaded, ...current]);
    if (uploaded.length !== picked.length) setMessage(`${uploaded.length} of ${picked.length} files uploaded. Please retry the remaining files.`);
    setUploadingKey('');
  }

  async function pickBulkDocuments() {
    if (!claim || uploadingKey) return;
    setMessage('');
    let result: Awaited<ReturnType<typeof DocumentPicker.getDocumentAsync>>;
    try {
      result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    } catch {
      setMessage('The file picker could not be opened. Please try again.');
      return;
    }
    if (result.canceled || !result.assets?.length) return;
    const picked: PickedDocument[] = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size ?? null }));
    const tooLarge = picked.find((file) => file.size != null && file.size > MAX_UPLOAD_SIZE_BYTES);
    if (tooLarge) { setMessage(`${tooLarge.name} is larger than 5 MB. Please choose smaller files.`); return; }

    setUploadingKey('bulk');
    const results = await runConcurrent(picked, 3, (file) => uploadFile(claim, BULK_DOCUMENT_TYPE, file, false));
    const uploaded = results.filter((item): item is ClaimDocument => Boolean(item));
    if (uploaded.length) setDocuments((current) => [...uploaded, ...current]);
    if (uploaded.length !== picked.length) setMessage(`${uploaded.length} of ${picked.length} files uploaded. Please retry the remaining files.`);
    setUploadingKey('');
  }

  async function uploadFile(targetClaim: ManagedClaim, documentType: string, file: PickedDocument, video: boolean): Promise<ClaimDocument | null> {
    let storagePath = '';
    try {
      const session = await getCurrentSession();
      if (!session?.user) return null;
      let uri = file.uri;
      let name = file.name;
      let mimeType = file.mimeType ?? 'application/octet-stream';
      if (video) {
        setVideoStatus(file.size && file.size > 10 * 1024 * 1024 ? 'Preparing video…' : 'Uploading…');
        const prepared = await prepareVideoForUpload(file.uri, file.size, (progress) => setVideoStatus(`Compressing… ${Math.round(progress * 100)}%`));
        uri = prepared.uri;
        if (prepared.compressed) {
          name = `${file.name.replace(/\.[^.]+$/, '') || 'accident-video'}.mp4`;
          mimeType = 'video/mp4';
        }
      }
      const extension = name.includes('.') ? name.split('.').pop() : 'bin';
      storagePath = `${targetClaim.customer_id}/${targetClaim.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(uri);
      const body = await response.arrayBuffer();
      const max = video ? MAX_VIDEO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
      if (body.byteLength > max) return null;
      const storageResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: mimeType, upsert: false });
      if (storageResult.error) return null;
      const record = await supabase.from('claim_documents').insert({
        claim_id: targetClaim.id,
        customer_id: targetClaim.customer_id,
        document_type: documentType,
        file_name: name,
        storage_bucket: 'claim-documents',
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: body.byteLength,
        uploaded_by: session.user.id,
      }).select('*').single();
      if (record.error || !record.data) {
        await supabase.storage.from('claim-documents').remove([storagePath]);
        return null;
      }
      return record.data as ClaimDocument;
    } catch {
      if (storagePath) await supabase.storage.from('claim-documents').remove([storagePath]);
      return null;
    } finally {
      if (video) setVideoStatus('');
    }
  }

  async function deleteDocuments(documentType: string) {
    if (!claim || uploadingKey) return;
    setDeleteType('');
    const targets = documents.filter((item) => item.document_type === documentType && item.verification_status !== 'verified');
    if (!targets.length) {
      setMessage('Verified documents are locked by the claims desk.');
      return;
    }
    setUploadingKey(documentType === BULK_DOCUMENT_TYPE ? 'bulk' : (keyForType(documentType) ?? 'bulk'));
    try {
      const ids = targets.map((item) => item.id).filter(Boolean);
      const removeResult = await supabase.from('claim_documents').delete().eq('claim_id', claim.id).in('id', ids);
      if (removeResult.error) { setMessage('The document could not be removed. Please try again.'); return; }
      const pathsByBucket = new Map<string, string[]>();
      targets.forEach((item) => {
        if (!item.storage_bucket || !item.storage_path) return;
        pathsByBucket.set(item.storage_bucket, [...(pathsByBucket.get(item.storage_bucket) ?? []), item.storage_path]);
      });
      for (const [bucket, paths] of pathsByBucket) await supabase.storage.from(bucket).remove(paths);
      const idSet = new Set(ids);
      setDocuments((current) => current.filter((item) => !idSet.has(item.id)));
    } finally {
      setUploadingKey('');
    }
  }

  if (loading) return <Screen title="Spot Intimation"><LoadingState label="Opening claim" /></Screen>;
  if (!claim) return <Screen title="Spot Intimation"><ExternalClaimErrorPopup visible message={message || 'This claim is unavailable.'} onClose={() => undefined} /></Screen>;

  const incident = claim.accident_at ? new Date(claim.accident_at) : null;
  const intimation = claim.spot_intimation_at ? new Date(claim.spot_intimation_at) : null;
  const parsedDriver = parseDriver(claim.accident_description);

  return (
    <Screen title="Spot Intimation" showTitleHeader={false}>
      <InternalManagedClaimHeader title="Spot Intimation" claimNo={claim.insurer_claim_no || claim.claim_no} insurerName={insurerName} vehicleNo={vehicleNo} policyNo={policyNo} vehicleMeta={vehicleMeta} />
      <ExternalClaimErrorPopup visible={Boolean(message)} message={message} title="Something went wrong" onClose={() => setMessage('')} />

      <ClaimFormSection title="Incident Details" subtitle="Accident date, time and first insurer intimation" iconImage={require('../assets/claims/claim-intimation.png')}>
        <ReadOnlyField label="Accident Date *" value={incident && !Number.isNaN(incident.getTime()) ? formatDate(incident) : ''} />
        <ReadOnlyField label="Accident Time *" value={incident && !Number.isNaN(incident.getTime()) ? formatTime(incident) : ''} icon="clock-outline" />
        <View style={styles.subsection}><Text style={styles.subsectionTitle}>Spot Intimation</Text></View>
        <ReadOnlyField label="Spot Intimation Date *" value={intimation && !Number.isNaN(intimation.getTime()) ? formatDate(intimation) : ''} />
        <ReadOnlyField label="Spot Intimation Time *" value={intimation && !Number.isNaN(intimation.getTime()) ? formatTime(intimation) : ''} icon="clock-outline" />
        <ReadOnlyField label="Driver Name (Optional)" value={parsedDriver.name} />
        <ReadOnlyField label="Driver Number (Optional)" value={parsedDriver.phone} />
        <ReadOnlyField label="Location (Optional)" value={claim.accident_location ?? ''} />
      </ClaimFormSection>

      <View style={styles.documentCard}>
        <View style={styles.documentHeader}><Text style={styles.documentTitle}>Upload claim documents</Text><View style={styles.optionalBadge}><Text style={styles.optionalBadgeText}>Optional now</Text></View></View>
        <View style={styles.grid}>
          <DocumentTile title="RC Copy" source={require('../assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png')} saved={savedTypes.has(DOCUMENT_TYPE_BY_KEY.rc)} busy={uploadingKey === 'rc'} onPress={() => void pickDocument('rc')} onRemove={() => setDeleteType(DOCUMENT_TYPE_BY_KEY.rc)} />
          <DocumentTile title="Insurance Copy" source={require('../assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png')} saved={savedTypes.has(DOCUMENT_TYPE_BY_KEY.insurance)} busy={uploadingKey === 'insurance'} onPress={() => void pickDocument('insurance')} onRemove={() => setDeleteType(DOCUMENT_TYPE_BY_KEY.insurance)} />
          <DocumentTile title="Driver Licence" source={require('../assets/brand/spot-intimation/glossy_purple_id_card_icon.png')} saved={savedTypes.has(DOCUMENT_TYPE_BY_KEY.licence)} busy={uploadingKey === 'licence'} onPress={() => void pickDocument('licence')} onRemove={() => setDeleteType(DOCUMENT_TYPE_BY_KEY.licence)} />
          <DocumentTile title="GR / Load Bill" source={require('../assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png')} saved={savedTypes.has(DOCUMENT_TYPE_BY_KEY.gr)} busy={uploadingKey === 'gr'} onPress={() => void pickDocument('gr')} onRemove={() => setDeleteType(DOCUMENT_TYPE_BY_KEY.gr)} />
          <DocumentTile title="Accident Photo" source={require('../assets/brand/spot-intimation/glossy_pink_camera_document_icon.png')} saved={savedTypes.has(DOCUMENT_TYPE_BY_KEY.accident_photo)} busy={uploadingKey === 'accident_photo'} onPress={() => void pickDocument('accident_photo')} onRemove={() => setDeleteType(DOCUMENT_TYPE_BY_KEY.accident_photo)} />
          <DocumentTile title="Accident Video" icon="video" saved={savedTypes.has(DOCUMENT_TYPE_BY_KEY.accident_video)} busy={uploadingKey === 'accident_video'} status={videoStatus} onPress={() => void pickDocument('accident_video')} onRemove={() => setDeleteType(DOCUMENT_TYPE_BY_KEY.accident_video)} />
        </View>
        <View style={styles.bulkShell}>
          <Pressable disabled={Boolean(uploadingKey)} onPress={() => void pickBulkDocuments()} style={[styles.bulk, bulkCount > 0 && styles.bulkSaved]}>
            <Image source={require('../assets/claims/claim-documents.png')} style={styles.bulkIcon} resizeMode="contain" />
            <View style={styles.bulkCopy}><Text style={styles.bulkTitle}>Upload multiple documents</Text><Text style={styles.bulkText}>{uploadingKey === 'bulk' ? 'Uploading selected files…' : bulkCount ? `${bulkCount} file${bulkCount === 1 ? '' : 's'} saved · Tap to add more` : 'Select several files now, or tap again later to add more.'}</Text></View>
            <MaterialCommunityIcons name="plus-circle-outline" size={21} color="#0A43A3" />
          </Pressable>
          {bulkCount ? <Pressable onPress={() => setDeleteType(BULK_DOCUMENT_TYPE)} style={styles.bulkRemove}><MaterialCommunityIcons name="close" size={14} color="#C43232" /></Pressable> : null}
        </View>
      </View>

      <Modal visible={Boolean(deleteType)} transparent animationType="fade" onRequestClose={() => setDeleteType('')}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.deleteIcon}><MaterialCommunityIcons name="trash-can-outline" size={19} color="#C43232" /></View><Text style={styles.modalTitle}>Delete document?</Text><Text style={styles.modalBody}>Remove the uploaded {deleteType || 'document'} from this claim?</Text><View style={styles.modalActions}><Pressable onPress={() => setDeleteType('')} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => void deleteDocuments(deleteType)} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable></View></View></View>
      </Modal>
    </Screen>
  );
}

function DocumentTile({ title, source, icon, saved, busy, status, onPress, onRemove }: { title: string; source?: any; icon?: keyof typeof MaterialCommunityIcons.glyphMap; saved: boolean; busy: boolean; status?: string; onPress: () => void; onRemove: () => void }) {
  return <Pressable disabled={busy} onPress={onPress} style={[styles.tile, saved && styles.tileSaved]}>{saved ? <View style={styles.check}><MaterialCommunityIcons name="check" size={15} color="#18864B" /></View> : null}{saved ? <Pressable onPress={(event) => { event.stopPropagation(); onRemove(); }} style={styles.remove}><MaterialCommunityIcons name="close" size={13} color="#C43232" /></Pressable> : null}<View style={styles.artwork}>{source ? <Image source={source} style={styles.artworkImage} resizeMode="contain" /> : icon ? <View style={styles.videoArtwork}><MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" /></View> : null}</View><Text style={styles.tileTitle} numberOfLines={2}>{title}</Text><Text style={[styles.tileStatus, saved && styles.tileStatusSaved]}>{busy ? (status || 'Uploading…') : saved ? 'Saved' : 'Tap to upload'}</Text></Pressable>;
}

function ReadOnlyField({ label, value, icon }: { label: string; value: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.field}><Text style={[styles.fieldValue, !value && styles.placeholder]} numberOfLines={2}>{value || 'Awaiting Claims Desk'}</Text>{icon ? <MaterialCommunityIcons name={icon} size={20} color="#0A43A3" /> : null}</View></View>;
}

async function runConcurrent<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function work() { while (true) { const index = next++; if (index >= items.length) return; results[index] = await worker(items[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => work()));
  return results;
}

function keyForType(type: string): DocumentKey | null { const entry = (Object.entries(DOCUMENT_TYPE_BY_KEY) as Array<[DocumentKey, string]>).find(([, value]) => value === type); return entry?.[0] ?? null; }
function parseDriver(value: string | null) { const raw = value ?? ''; return { name: /(?:^|\n)Driver:\s*([^\n]+)/i.exec(raw)?.[1]?.trim() ?? '', phone: /(?:^|\n)Driver phone:\s*([^\n]+)/i.exec(raw)?.[1]?.trim() ?? '' }; }
function formatDate(value: Date) { return value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatTime(value: Date) { return value.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }); }

const styles = StyleSheet.create({
  subsection: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E7EBF0' },
  subsectionTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  fieldWrap: { marginTop: 9 }, fieldLabel: { color: '#233653', fontSize: 11, fontWeight: '800', marginBottom: 5 }, field: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#D2DFEC', backgroundColor: '#FBFDFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, fieldValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '800' }, placeholder: { color: '#9AA7B8', fontWeight: '700' },
  documentCard: { borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', padding: 12, marginBottom: 12 }, documentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, documentTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' }, optionalBadge: { borderRadius: 999, backgroundColor: '#EEF5FF', paddingHorizontal: 9, paddingVertical: 5 }, optionalBadgeText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900' }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tile: { position: 'relative', width: '31.5%', minHeight: 106, borderRadius: 14, backgroundColor: '#F7FAFF', borderWidth: 1.5, borderColor: '#E2EAF4', paddingVertical: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' }, tileSaved: { backgroundColor: '#EFFAF4', borderColor: '#52B57F' }, check: { position: 'absolute', top: 5, left: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: '#DDF4E8', alignItems: 'center', justifyContent: 'center' }, remove: { position: 'absolute', top: 5, right: 5, zIndex: 3, width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' }, artwork: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' }, artworkImage: { width: 43, height: 43 }, videoArtwork: { width: 38, height: 40, borderRadius: 8, backgroundColor: '#EF1E2F', alignItems: 'center', justifyContent: 'center' }, tileTitle: { color: palette.navy, fontSize: 8.5, lineHeight: 11, fontWeight: '800', textAlign: 'center', marginTop: 3 }, tileStatus: { color: '#7A8799', fontSize: 7.5, fontWeight: '800', marginTop: 3 }, tileStatusSaved: { color: '#18864B' },
  bulkShell: { position: 'relative' }, bulk: { minHeight: 58, marginTop: 10, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#AFC8E8', backgroundColor: '#F7FAFF', paddingHorizontal: 10, paddingRight: 38, flexDirection: 'row', alignItems: 'center', gap: 9 }, bulkSaved: { borderStyle: 'solid', borderColor: '#52B57F', backgroundColor: '#EFFAF4' }, bulkIcon: { width: 34, height: 34 }, bulkCopy: { flex: 1 }, bulkTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, bulkText: { color: '#718198', fontSize: 8.5, lineHeight: 12, marginTop: 2 }, bulkRemove: { position: 'absolute', top: 15, right: 7, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,24,50,0.48)', padding: 24 }, modalCard: { width: '100%', maxWidth: 340, borderRadius: 20, backgroundColor: '#FFFFFF', padding: 20, alignItems: 'center' }, deleteIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' }, modalTitle: { marginTop: 8, color: palette.navy, fontSize: 18, fontWeight: '900' }, modalBody: { marginTop: 7, color: '#667085', fontSize: 12, textAlign: 'center' }, modalActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 16 }, cancelButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: palette.navy, fontSize: 11, fontWeight: '900' }, deleteButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#C43232', alignItems: 'center', justifyContent: 'center' }, deleteText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});