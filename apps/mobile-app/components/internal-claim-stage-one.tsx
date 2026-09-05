import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { IncidentVoiceNote, type IncidentVoiceNoteFile } from '@/components/incident-voice-note';
import { ClaimActionBar, ClaimFormSection } from '@/components/external-claim-ui';
import { LoadingState, Screen, TextField } from '@/components/ui';
import { getCurrentSession, makeClaimNumber } from '@/lib/auth';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { getOperationalCustomerContexts, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { prepareVideoForUpload } from '@/lib/video-compression';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type TimeTarget = 'incident' | 'intimation' | null;
type DocumentKey = 'rc' | 'insurance' | 'licence' | 'gr' | 'accident_photo' | 'accident_video' | 'bulk';
type PickedDocument = { name: string; uri: string; mimeType?: string | null; size?: number | null };
type DocumentTileState = 'idle' | 'ready';
type DeleteTarget = { key: DocumentKey; title: string } | null;
type LocationNotice = { tone: 'info' | 'error'; text: string } | null;
type DocumentTileIconName = keyof typeof MaterialCommunityIcons.glyphMap;

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
const DOCUMENT_TYPE_BY_KEY: Record<Exclude<DocumentKey, 'bulk'>, string> = {
  rc: 'RC Copy',
  insurance: 'Insurance Copy',
  licence: 'Driver Licence',
  gr: 'GR / Load Bill',
  accident_photo: 'Accident Photo',
  accident_video: 'Accident Video',
};
const BULK_DOCUMENT_TYPE = 'Spot Intimation Attachment';
const VOICE_NOTE_DOCUMENT_TYPE = 'Incident Voice Note';

function isMultiMediaKey(key: Exclude<DocumentKey, 'bulk'>): key is 'accident_photo' | 'accident_video' {
  return key === 'accident_photo' || key === 'accident_video';
}

export default function InternalClaimStageOne() {
  const router = useRouter();
  const { vehicleId, policyId } = useLocalSearchParams<{ vehicleId?: string; policyId?: string }>();
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? '');
  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [intimationDate, setIntimationDate] = useState('');
  const [intimationTime, setIntimationTime] = useState('');
  const [driver, setDriver] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [locationNotice, setLocationNotice] = useState<LocationNotice>(null);
  const [locating, setLocating] = useState(false);
  const [documents, setDocuments] = useState<Record<DocumentKey, PickedDocument[]>>({ rc: [], insurance: [], licence: [], gr: [], accident_photo: [], accident_video: [], bulk: [] });
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [videoProcessingStatus, setVideoProcessingStatus] = useState('');
  const [voiceNote, setVoiceNote] = useState<IncidentVoiceNoteFile | null>(null);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timeTarget, setTimeTarget] = useState<TimeTarget>(null);
  const [createdClaimSuccess, setCreatedClaimSuccess] = useState<{ id: string; controlNo: string } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const nextContexts = await getOperationalCustomerContexts();
      const ids = nextContexts.map((context) => context.customer_id);
      if (!active) return;
      setContexts(nextContexts);
      if (!ids.length) { setLoading(false); return; }
      const [vehicleResult, policyResult, insurerResult] = await Promise.all([
        supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no'),
        supabase.from('policies').select('*').in('customer_id', ids).order('end_date', { ascending: false }),
        supabase.from('insurance_companies').select('*'),
      ]);
      if (!active) return;
      const nextVehicles = vehicleResult.data ?? [];
      const nextPolicies = policyResult.data ?? [];
      setVehicles(nextVehicles);
      setPolicies(nextPolicies);
      setInsurers(insurerResult.data ?? []);

      const routedPolicy = policyId ? nextPolicies.find((item) => item.id === policyId) : null;
      const routedVehicle = vehicleId ? nextVehicles.find((item) => item.id === vehicleId) : null;
      const fallbackPolicy = routedPolicy ?? (routedVehicle ? nextPolicies.find((item) => item.vehicle_id === routedVehicle.id) : nextPolicies[0]) ?? null;
      const fallbackVehicle = routedVehicle ?? (fallbackPolicy ? nextVehicles.find((item) => item.id === fallbackPolicy.vehicle_id) : nextVehicles[0]) ?? null;
      setSelectedCustomerId(fallbackVehicle?.customer_id ?? nextContexts[0]?.customer_id ?? '');
      setSelectedVehicleId(fallbackVehicle?.id ?? '');
      setLoading(false);
    })();
    return () => { active = false; };
  }, [policyId, router, vehicleId]);

  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const selectedPolicy = useMemo(() => {
    if (!selectedVehicle) return null;
    const routed = policyId ? policies.find((item) => item.id === policyId && item.vehicle_id === selectedVehicle.id) : null;
    return routed ?? policies.find((item) => item.vehicle_id === selectedVehicle.id) ?? null;
  }, [policies, policyId, selectedVehicle]);
  const selectedInsurer = useMemo(() => selectedPolicy ? insurers.find((item) => item.id === selectedPolicy.insurance_company_id) ?? null : null, [insurers, selectedPolicy]);
  const selectedContext = useMemo(() => contexts.find((context) => context.customer_id === selectedCustomerId) ?? null, [contexts, selectedCustomerId]);

  async function pickDocument(key: Exclude<DocumentKey, 'bulk'>) {
    setMessage('');
    const multiMedia = isMultiMediaKey(key);
    const pickerTypes = key === 'accident_video' ? ['video/*'] : key === 'accident_photo' ? ['image/*'] : ['application/pdf', 'image/*'];
    const result = await DocumentPicker.getDocumentAsync({ type: pickerTypes, multiple: multiMedia, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const picked: PickedDocument[] = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size ?? null }));
    const limit = key === 'accident_video' ? MAX_VIDEO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
    const label = key === 'accident_video' ? '50 MB' : '5 MB';
    const tooLarge = picked.find((file) => file.size != null && file.size > limit);
    if (tooLarge) return setMessage(`${tooLarge.name} is larger than ${label}. Please choose smaller files.`);
    setDocuments((current) => ({ ...current, [key]: multiMedia ? [...current[key], ...picked] : [picked[0]] }));
  }

  async function pickBulkDocuments() {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const additions: PickedDocument[] = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size ?? null }));
    const tooLarge = additions.find((file) => file.size != null && file.size > MAX_UPLOAD_SIZE_BYTES);
    if (tooLarge) return setMessage(`${tooLarge.name} is larger than 5 MB. Please choose smaller files.`);
    setDocuments((current) => ({ ...current, bulk: [...current.bulk, ...additions] }));
  }

  function requestDelete(key: DocumentKey, title: string) { if (!uploadingDocuments) setDeleteTarget({ key, title }); }
  function confirmDelete() {
    if (!deleteTarget) return;
    setDocuments((current) => ({ ...current, [deleteTarget.key]: [] }));
    setDeleteTarget(null);
  }
  function tileState(key: Exclude<DocumentKey, 'bulk'>): DocumentTileState { return documents[key].length ? 'ready' : 'idle'; }
  function mediaCount(key: 'accident_photo' | 'accident_video') { return documents[key].length; }
  function mediaStatusLabel(key: 'accident_photo' | 'accident_video') {
    const count = mediaCount(key);
    if (!count) return undefined;
    const noun = key === 'accident_photo' ? 'photo' : 'video';
    return `${count} ${noun}${count === 1 ? '' : 's'} ready`;
  }

  async function captureCurrentLocation() {
    if (locating) return;
    setLocationNotice(null);
    setLocating(true);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) { setLocationNotice({ tone: 'error', text: 'Turn on device location services, or enter the location manually.' }); return; }
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) { setLocationNotice({ tone: 'error', text: 'Location permission is not available. You can still enter the location manually.' }); return; }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinates = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      let resolvedLocation = `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
      try {
        const [address] = await Location.reverseGeocodeAsync(coordinates);
        if (address) {
          const parts = [address.name, address.street, address.district, address.city || address.subregion, address.region, address.postalCode].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
          const uniqueParts = parts.filter((part, index, items) => items.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index);
          if (uniqueParts.length) resolvedLocation = uniqueParts.join(', ');
        }
      } catch { /* coordinates are a valid fallback */ }
      setLocation(resolvedLocation);
      setLocationNotice({ tone: 'info', text: 'Current location added. You can edit it if needed.' });
    } catch {
      setLocationNotice({ tone: 'error', text: 'Could not fetch your current location. Please try again or enter it manually.' });
    } finally { setLocating(false); }
  }

  async function uploadClaimDocument(targetClaimId: string, customerId: string, documentType: string, pickedFile: PickedDocument) {
    const isAccidentVideo = documentType === DOCUMENT_TYPE_BY_KEY.accident_video;
    try {
      const session = await getCurrentSession();
      if (!session?.user) return false;
      let uploadUri = pickedFile.uri;
      let uploadName = pickedFile.name;
      let uploadMimeType = pickedFile.mimeType ?? 'application/octet-stream';
      if (isAccidentVideo) {
        setVideoProcessingStatus(pickedFile.size && pickedFile.size > 10 * 1024 * 1024 ? 'Preparing video for compression…' : 'Preparing video…');
        const prepared = await prepareVideoForUpload(pickedFile.uri, pickedFile.size, (progress) => setVideoProcessingStatus(`Compressing video… ${Math.round(progress * 100)}%`));
        uploadUri = prepared.uri;
        if (prepared.compressed) {
          const stem = pickedFile.name.replace(/\.[^.]+$/, '') || 'accident-video';
          uploadName = `${stem}.mp4`;
          uploadMimeType = 'video/mp4';
        }
        setVideoProcessingStatus(prepared.compressed ? 'Uploading compressed video…' : 'Uploading video…');
      }
      const extension = uploadName.includes('.') ? uploadName.split('.').pop() : 'bin';
      const storagePath = `${customerId}/${targetClaimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const response = await fetch(uploadUri);
      const body = await response.arrayBuffer();
      const max = isAccidentVideo ? MAX_VIDEO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
      if (body.byteLength > max) return false;
      const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: uploadMimeType, upsert: false });
      if (uploadResult.error) return false;
      const record = await supabase.from('claim_documents').insert({ claim_id: targetClaimId, customer_id: customerId, document_type: documentType, file_name: uploadName, storage_bucket: 'claim-documents', storage_path: storagePath, mime_type: uploadMimeType, file_size: body.byteLength, uploaded_by: session.user.id });
      return !record.error;
    } catch { return false; }
    finally { if (isAccidentVideo) setVideoProcessingStatus(''); }
  }

  async function persistPendingDocuments(targetClaimId: string, customerId: string) {
    const queued: Array<{ type: string; file: PickedDocument }> = [
      ...documents.rc.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.rc, file })),
      ...documents.insurance.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.insurance, file })),
      ...documents.licence.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.licence, file })),
      ...documents.gr.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.gr, file })),
      ...documents.accident_photo.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.accident_photo, file })),
      ...documents.accident_video.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.accident_video, file })),
      ...documents.bulk.map((file) => ({ type: BULK_DOCUMENT_TYPE, file })),
      ...(voiceNote ? [{ type: VOICE_NOTE_DOCUMENT_TYPE, file: voiceNote }] : []),
    ];
    if (!queued.length) return { total: 0, saved: 0 };
    setUploadingDocuments(true);
    let saved = 0;
    for (const item of queued) if (await uploadClaimDocument(targetClaimId, customerId, item.type, item.file)) saved += 1;
    setUploadingDocuments(false);
    return { total: queued.length, saved };
  }

  async function submit() {
    if (!selectedVehicle || !selectedPolicy || !selectedContext || saving || uploadingDocuments || voiceRecording) return;
    setMessage('');
    setValidationMessage('');
    const missingMandatoryFields = [!incidentDate ? 'Accident Date' : '', !incidentTime ? 'Accident Time' : '', !intimationDate ? 'Spot Intimation Date' : '', !intimationTime ? 'Spot Intimation Time' : ''].filter(Boolean);
    if (missingMandatoryFields.length) return setValidationMessage(`Please complete the required Stage 1 fields: ${missingMandatoryFields.join(', ')}.`);
    const incidentAt = parseDateTime(incidentDate, incidentTime);
    const spotIntimationAt = parseDateTime(intimationDate, intimationTime);
    if (!incidentAt) return setValidationMessage('Please enter Accident Date and Time.');
    if (!spotIntimationAt) return setValidationMessage('Please enter Spot Intimation Date and Time.');
    if (incidentAt.getTime() > Date.now()) return setValidationMessage('Accident Date / Time cannot be in the future.');
    if (spotIntimationAt.getTime() > Date.now()) return setValidationMessage('Spot Intimation Date / Time cannot be in the future.');
    if (spotIntimationAt.getTime() < incidentAt.getTime()) return setValidationMessage('Spot Intimation Date / Time cannot be earlier than Accident Date / Time.');

    setSaving(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) { setSaving(false); return router.replace('/login'); }
      const payload = {
        claim_no: makeClaimNumber(),
        customer_id: selectedContext.customer_id,
        vehicle_id: selectedVehicle.id,
        policy_id: selectedPolicy.id,
        insurance_company_id: selectedPolicy.insurance_company_id,
        current_status: 'Initial Documents Pending' as const,
        accident_at: incidentAt.toISOString(),
        spot_intimation_at: spotIntimationAt.toISOString(),
        accident_location: location.trim() || null,
        accident_description: [driver.trim() ? `Driver: ${driver.trim()}` : '', phone.trim() ? `Driver phone: ${phone.trim()}` : ''].filter(Boolean).join('\n') || null,
        estimated_loss: null,
        created_by: session.user.id,
      };
      const { data: claim, error } = await supabase.from('claims').insert(payload).select('*').single();
      if (error || !claim) { setSaving(false); return setMessage(mapSubmitError(error)); }
      const persisted = await persistPendingDocuments(claim.id, claim.customer_id);
      if (persisted.saved !== persisted.total) setMessage(`${persisted.saved} of ${persisted.total} selected documents were saved to the claim. The saved documents are available in Claim Tracker.`);
      try {
        await recordClaimEvent({ claimId: claim.id, customerId: claim.customer_id, fromStatus: null, toStatus: claim.current_status, notes: 'New incident claim reported by customer.', changedBy: session.user.id, title: `New claim ${claim.claim_no}` });
      } catch { /* creation must not fail because notification logging is unavailable */ }
      setSaving(false);
      setCreatedClaimSuccess({ id: claim.id, controlNo: claim.claim_no });
    } catch {
      setSaving(false);
      setMessage('We could not submit the incident report right now. Please try again.');
    }
  }

  if (loading) return <Screen title="Spot Intimation"><LoadingState label="Opening policy" /></Screen>;

  return (
    <Screen title="Spot Intimation" showTitleHeader={false}>
      {selectedPolicy && selectedVehicle ? (
        <InternalSpotIntimationIdentityCard
          claimNo="New claim"
          insurerName={selectedInsurer?.name ?? 'Insurance company'}
          vehicleNo={selectedVehicle.vehicle_no}
          policyNo={selectedPolicy.policy_no}
          vehicleMeta={[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' · ')}
        />
      ) : null}
      <ExternalClaimErrorPopup visible={Boolean(message)} message={message} title="Something went wrong" onClose={() => setMessage('')} />

      <ClaimFormSection title="Incident Details" subtitle="Accident date, time and first insurer intimation" iconImage={require('../assets/claims/claim-intimation.png')}>
        <AppDatePicker label="Accident Date *" value={incidentDate} onChange={setIncidentDate} maxDate={todayIsoDate()} />
        <TimePickerField label="Accident Time *" value={incidentTime} onPress={() => setTimeTarget('incident')} />
        <View style={styles.subsection}><Text style={styles.subsectionTitle}>Spot Intimation</Text></View>
        <AppDatePicker label="Spot Intimation Date *" value={intimationDate} onChange={setIntimationDate} maxDate={todayIsoDate()} />
        <TimePickerField label="Spot Intimation Time *" value={intimationTime} onPress={() => setTimeTarget('intimation')} />
        <View style={styles.gap} />
        <TextField label="Driver Name (Optional)" value={driver} onChangeText={setDriver} />
        <View style={styles.gap} />
        <TextField label="Driver Number (Optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={styles.gap} />
        <View style={styles.locationFieldWrap}>
          <TextField label="Location (Optional)" value={location} onChangeText={(value) => { setLocation(value); setLocationNotice(null); }} />
          <Pressable accessibilityRole="button" accessibilityLabel={locating ? 'Locating current location' : 'Use current location'} accessibilityState={{ disabled: locating }} hitSlop={8} disabled={locating} onPress={() => void captureCurrentLocation()} style={({ pressed }) => [styles.gpsLocationInlineAction, locating && styles.gpsLocationButtonDisabled, pressed && !locating && styles.gpsLocationInlineActionPressed]}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#0A43A3" />
            <Text style={styles.gpsLocationInlineText}>Use Current Location</Text>
          </Pressable>
        </View>
        {locationNotice ? <View style={[styles.locationNotice, locationNotice.tone === 'error' && styles.locationNoticeError]}><MaterialCommunityIcons name={locationNotice.tone === 'error' ? 'alert-circle-outline' : 'check-circle-outline'} size={15} color={locationNotice.tone === 'error' ? '#B42318' : '#16764B'} /><Text style={[styles.locationNoticeText, locationNotice.tone === 'error' && styles.locationNoticeTextError]}>{locationNotice.text}</Text></View> : null}
      </ClaimFormSection>

      <View style={styles.documentReadyCard}>
        <View style={styles.documentReadyHeader}><View style={styles.documentReadyHeaderCopy}><Text style={styles.documentReadyTitle}>Upload claim documents</Text></View><View style={styles.documentReadyBadge}><Text style={styles.documentReadyBadgeText}>Optional now</Text></View></View>
        <View style={styles.documentReadyGrid}>
          <DocumentReadyTile title="RC Copy" fileName={documents.rc[0]?.name ?? ''} source={require('../assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png')} state={tileState('rc')} onPress={() => void pickDocument('rc')} onRemove={() => requestDelete('rc', documents.rc[0]?.name ?? 'RC Copy')} />
          <DocumentReadyTile title="Insurance Copy" fileName={documents.insurance[0]?.name ?? ''} source={require('../assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png')} state={tileState('insurance')} onPress={() => void pickDocument('insurance')} onRemove={() => requestDelete('insurance', documents.insurance[0]?.name ?? 'Insurance Copy')} />
          <DocumentReadyTile title="Driver Licence" fileName={documents.licence[0]?.name ?? ''} source={require('../assets/brand/spot-intimation/glossy_purple_id_card_icon.png')} state={tileState('licence')} onPress={() => void pickDocument('licence')} onRemove={() => requestDelete('licence', documents.licence[0]?.name ?? 'Driver Licence')} />
          <DocumentReadyTile title="GR / Load Bill" fileName={documents.gr[0]?.name ?? ''} source={require('../assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png')} state={tileState('gr')} onPress={() => void pickDocument('gr')} onRemove={() => requestDelete('gr', documents.gr[0]?.name ?? 'GR / Load Bill')} />
          <DocumentReadyTile title="Accident Photo" statusText={mediaStatusLabel('accident_photo')} source={require('../assets/brand/spot-intimation/glossy_pink_camera_document_icon.png')} state={tileState('accident_photo')} onPress={() => void pickDocument('accident_photo')} onRemove={() => requestDelete('accident_photo', `${mediaCount('accident_photo')} accident photo${mediaCount('accident_photo') === 1 ? '' : 's'}`)} />
          <DocumentReadyTile title="Accident Video" statusText={videoProcessingStatus || mediaStatusLabel('accident_video')} artwork="accident-video" state={tileState('accident_video')} onPress={() => void pickDocument('accident_video')} onRemove={() => requestDelete('accident_video', `${mediaCount('accident_video')} accident video${mediaCount('accident_video') === 1 ? '' : 's'}`)} />
        </View>
        <View style={styles.bulkUploadShell}>
          <Pressable accessibilityRole="button" disabled={uploadingDocuments} onPress={() => void pickBulkDocuments()} style={[styles.bulkUpload, documents.bulk.length > 0 && styles.bulkUploadSelected]}>
            <Image source={require('../assets/claims/claim-documents.png')} style={styles.bulkUploadIconArtwork} resizeMode="contain" />
            <View style={styles.bulkUploadCopy}><Text style={styles.bulkUploadTitle}>Upload multiple documents</Text><Text style={styles.bulkUploadText}>{documents.bulk.length > 0 ? `${documents.bulk.length} file${documents.bulk.length === 1 ? '' : 's'} ready · They will be saved when the claim starts` : 'Select several files now, or tap again later to add more.'}</Text></View>
            {!documents.bulk.length ? <MaterialCommunityIcons name="plus-circle-outline" size={21} color="#0A43A3" /> : null}
          </Pressable>
          {documents.bulk.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Remove all bulk documents" disabled={uploadingDocuments} onPress={() => requestDelete('bulk', 'uploaded documents')} style={styles.bulkRemoveButton}><MaterialCommunityIcons name="close" size={14} color="#C43232" /></Pressable> : null}
        </View>
      </View>

      <IncidentVoiceNote value={voiceNote} saved={false} busy={saving || uploadingDocuments} onChange={setVoiceNote} onRecordingChange={setVoiceRecording} />

      <ClaimActionBar primaryDisabled={saving || uploadingDocuments || voiceRecording || !selectedPolicy} primaryIcon="arrow-right" primaryLabel={voiceRecording ? 'Stop recording first' : saving || uploadingDocuments ? 'Saving...' : 'Start Claim & Continue'} onPrimary={() => void submit()} onAssistance={() => router.push('/customer/support')} />

      <Modal visible={Boolean(createdClaimSuccess)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
        <View style={styles.controlSuccessBackdrop}><View accessibilityRole="alert" style={styles.controlSuccessCard}><View style={styles.controlSuccessIcon}><MaterialCommunityIcons name="check" size={18} color="#FFFFFF" /></View><Text style={styles.controlSuccessTitle}>Control No. Created</Text><Pressable accessibilityRole="button" accessibilityLabel="Open claim using generated control number" onPress={() => { const target = createdClaimSuccess; if (!target) return; setCreatedClaimSuccess(null); router.replace({ pathname: '/customer/internal-spot-status', params: { id: target.id } }); }} style={({ pressed }) => [styles.controlSuccessNumber, pressed && styles.controlSuccessNumberPressed]}><View style={styles.controlSuccessNumberCopy}><Text style={styles.controlSuccessNumberLabel}>CONTROL NO.</Text><Text style={styles.controlSuccessNumberValue}>{createdClaimSuccess?.controlNo ?? ''}</Text></View><View style={styles.controlSuccessOk}><Text style={styles.controlSuccessOkText}>OK</Text></View></Pressable></View></View>
      </Modal>

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.validationBackdrop}><View accessibilityRole="alert" style={styles.validationCard}><View style={styles.deleteConfirmIcon}><MaterialCommunityIcons name="trash-can-outline" size={19} color="#C43232" /></View><Text style={styles.validationTitle}>Delete document?</Text><Text style={styles.validationBody}>{deleteTarget ? `Are you sure you want to delete ${deleteTarget.title}?` : ''}</Text><View style={styles.deleteConfirmActions}><Pressable accessibilityRole="button" onPress={() => setDeleteTarget(null)} style={styles.deleteCancelButton}><Text style={styles.deleteCancelText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={uploadingDocuments} onPress={confirmDelete} style={styles.deleteConfirmButton}><Text style={styles.deleteConfirmText}>Delete</Text></Pressable></View></View></View>
      </Modal>

      <ExternalClaimErrorPopup visible={Boolean(validationMessage)} message={validationMessage} title="Alert" onClose={() => setValidationMessage('')} />
      <TimePickerModal value={timeTarget === 'intimation' ? intimationTime : incidentTime} visible={timeTarget !== null} title={timeTarget === 'intimation' ? 'Select spot intimation time' : 'Select incident time'} onClose={() => setTimeTarget(null)} onSelect={(value) => { if (timeTarget === 'intimation') setIntimationTime(value); else setIncidentTime(value); setTimeTarget(null); }} />
    </Screen>
  );
}

function InternalSpotIntimationIdentityCard({ claimNo, insurerName, vehicleNo, policyNo, vehicleMeta }: { claimNo?: string | null; insurerName?: string | null; vehicleNo?: string | null; policyNo?: string | null; vehicleMeta?: string | null }) {
  return (
    <View style={styles.spotStatusCard}>
      <View style={styles.spotStatusGlowLarge} />
      <View style={styles.spotStatusGlowSmall} />
      <View style={styles.spotStatusHeaderRow}>
        <View style={[styles.spotStatusIconBadge, styles.spotStatusStageBadge]}>
          <Image source={require('../assets/claims/claim-intimation.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
        </View>
        <Text style={styles.spotStatusHeaderTitle} numberOfLines={1}>Spot Intimation</Text>
        <Text style={styles.spotStatusClaimNo} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>
      <View style={styles.spotStatusHeaderDivider} />
      <View style={styles.spotStatusInfoGrid}>
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusVehicleBadge]}>
              <Image source={require('../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={styles.spotStatusMainInfoLabel}>Vehicle: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusMakeModelBadge]}>
              <Image source={require('../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
          </View>
        </View>
        <View style={styles.spotStatusSectionDivider} />
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusPolicyBadge]}>
              <Image source={require('../assets/claims/policy.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={[styles.spotStatusMainInfoLabel, styles.spotStatusPolicyMainLabel]}>Policy: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{policyNo || '—'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusInsurerBadge]}>
              <Image source={require('../assets/claims/accounts-finance.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}


function DocumentReadyTile({ title, fileName, statusText, source, iconName, iconColor, artwork, state, onPress, onRemove }: { title: string; fileName?: string; statusText?: string; source?: any; iconName?: DocumentTileIconName; iconColor?: string; artwork?: 'accident-video'; state: DocumentTileState; onPress: () => void; onRemove: () => void }) {
  const ready = state === 'ready';
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: state !== 'idle' }} onPress={onPress} style={[styles.documentReadyTile, ready && styles.documentReadyTileReady]}>{state !== 'idle' ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={(event) => { event.stopPropagation(); onRemove(); }} style={styles.documentRemoveButton}><MaterialCommunityIcons name="close" size={13} color="#C43232" /></Pressable> : null}<View style={styles.documentReadyArtworkWrap}>{artwork === 'accident-video' ? <AccidentVideoArtwork /> : source ? <Image source={source} style={styles.documentReadyArtwork} resizeMode="contain" /> : iconName ? <MaterialCommunityIcons name={iconName} size={32} color={iconColor ?? '#0A43A3'} /> : null}</View><Text style={styles.documentReadyTileText} numberOfLines={2}>{title}</Text>{fileName ? <Text style={styles.documentReadyFileName} numberOfLines={1}>{fileName}</Text> : null}<Text style={[styles.documentReadyStatus, ready && styles.documentReadyStatusReady]}>{statusText ?? (ready ? 'Ready' : 'Tap to upload')}</Text></Pressable>;
}

function AccidentVideoArtwork() { return <View style={styles.accidentVideoArtwork}><View style={styles.accidentVideoGloss} /><View style={styles.accidentVideoFold} /><MaterialCommunityIcons name="video" size={18} color="#FFFFFF" /><View style={styles.accidentVideoLineLong} /><View style={styles.accidentVideoLineShort} /></View>; }
function TimePickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <View style={styles.timeField}><Text style={styles.timeLabel}>{label}</Text><Pressable accessibilityRole="button" onPress={onPress} style={styles.timeButton}><MaterialCommunityIcons name="clock-outline" size={19} color="#0A43A3" /><Text style={[styles.timeValue, !value && styles.timePlaceholder]}>{value ? formatTime(value) : 'Select time'}</Text><MaterialCommunityIcons name="chevron-down" size={21} color={palette.navy} /></Pressable></View>; }
function TimePickerModal({ value, visible, title, onClose, onSelect }: { value: string; visible: boolean; title: string; onClose: () => void; onSelect: (value: string) => void }) { const [hour, setHour] = useState(() => parseTime(value).hour); const [minute, setMinute] = useState(() => parseTime(value).minute); useEffect(() => { if (!visible) return; const parsed = parseTime(value); setHour(parsed.hour); setMinute(parsed.minute); }, [value, visible]); return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.timeModalBackdrop}><View style={styles.timeModalCard}><View style={styles.timeModalHeader}><View><Text style={styles.timeModalEyebrow}>CLAIM TIMELINE</Text><Text style={styles.timeModalTitle}>{title}</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={styles.timeClose}><MaterialCommunityIcons name="close" size={21} color={palette.navy} /></Pressable></View><View style={styles.timeColumns}><TimeColumn label="Hour" value={hour} options={Array.from({ length: 24 }, (_, index) => index)} onSelect={setHour} /><Text style={styles.timeColon}>:</Text><TimeColumn label="Minute" value={minute} options={[0,5,10,15,20,25,30,35,40,45,50,55]} onSelect={setMinute} /></View><Pressable accessibilityRole="button" onPress={() => onSelect(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)} style={styles.timeDone}><Text style={styles.timeDoneText}>Use this time</Text><MaterialCommunityIcons name="check" size={19} color="#FFFFFF" /></Pressable></View></View></Modal>; }
function TimeColumn({ label, value, options, onSelect }: { label: string; value: number; options: number[]; onSelect: (value: number) => void }) { return <View style={styles.timeColumn}><Text style={styles.timeColumnLabel}>{label}</Text><View style={styles.timeOptions}>{options.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === value }} onPress={() => onSelect(option)} style={[styles.timeOption, option === value && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, option === value && styles.timeOptionTextSelected]}>{String(option).padStart(2, '0')}</Text></Pressable>)}</View></View>; }

function parseTime(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: new Date().getHours(), minute: Math.floor(new Date().getMinutes() / 5) * 5 }; }
function parseDateTime(date: string, time: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null; const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.trim().split(':').map(Number); const value = new Date(year, month - 1, day, hour, minute); return Number.isNaN(value.getTime()) ? null : value; }
function todayIsoDate() { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function formatTime(value: string) { const parsed = parseTime(value); const date = new Date(2000, 0, 1, parsed.hour, parsed.minute); return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function mapSubmitError(error: { message?: string; code?: string } | null) { const value = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase(); if (value.includes('duplicate') || value.includes('unique')) return 'A claim has already been started for this incident. Open My Claims to continue.'; return error?.message || 'We could not create this claim right now. Please try again.'; }

const styles = StyleSheet.create({
  spotStatusCard: { position: 'relative', overflow: 'hidden', width: '100%', borderRadius: 18, backgroundColor: '#062D70', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 10, shadowColor: '#062D70', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  spotStatusGlowLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0C58C8', right: -95, top: -105, opacity: 0.26 },
  spotStatusGlowSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(120,169,255,0.16)', right: -20, top: -62 },
  spotStatusHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  spotStatusIconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  spotStatusBadgeArtwork: { width: 21, height: 21 },
  spotStatusStageBadge: { backgroundColor: '#0B51BE' },
  spotStatusHeaderTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  spotStatusClaimNo: { maxWidth: '38%', color: '#FFFFFF', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'right', letterSpacing: 0.1 },
  spotStatusHeaderDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 8, marginBottom: 8 },
  spotStatusInfoGrid: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  spotStatusInfoSection: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  spotStatusSectionDivider: { width: 1, backgroundColor: 'rgba(174,204,255,0.18)', marginHorizontal: 5, marginVertical: 1 },
  spotStatusMainInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  spotStatusVehicleBadge: { backgroundColor: '#EAF2FF' },
  spotStatusPolicyBadge: { backgroundColor: '#E8F7F1' },
  spotStatusMainInfoLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.4, lineHeight: 14 },
  spotStatusMainInfoLabel: { color: '#D8E7FF', fontWeight: '800' },
  spotStatusPolicyMainLabel: { color: '#A9E7D0' },
  spotStatusMainInfoValue: { color: '#FFFFFF', fontWeight: '900' },
  spotStatusSecondaryInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 },
  spotStatusMakeModelBadge: { backgroundColor: '#E8F1FF' },
  spotStatusInsurerBadge: { backgroundColor: '#FFF2D8' },
  spotStatusSecondaryValue: { flex: 1, minWidth: 0, color: '#EAF2FF', fontSize: 8.8, lineHeight: 11.5, fontWeight: '700' },
  gap: { height: 10 },
  subsection: { marginTop: 16, marginBottom: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E7EBF0' },
  subsectionTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  locationFieldWrap: { position: 'relative' },
  gpsLocationInlineAction: { position: 'absolute', top: -3, right: 0, zIndex: 2, minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: 2 },
  gpsLocationInlineActionPressed: { opacity: 0.72 },
  gpsLocationButtonDisabled: { opacity: 0.58 },
  gpsLocationInlineText: { color: '#0A43A3', fontSize: 10.5, lineHeight: 14, fontWeight: '900' },
  locationNotice: { marginTop: 7, borderRadius: 11, backgroundColor: '#EFFAF4', borderWidth: 1, borderColor: '#B7E4CC', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationNoticeError: { backgroundColor: '#FFF5F5', borderColor: '#F2C5C2' },
  locationNoticeText: { flex: 1, color: '#166A45', fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  locationNoticeTextError: { color: '#9F2D24' },
  documentReadyCard: { borderRadius: 18, borderWidth: 1, borderColor: '#D7E2EF', backgroundColor: '#FFFFFF', padding: 12, marginBottom: 12, shadowColor: '#14375F', shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  documentReadyHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  documentReadyHeaderCopy: { flex: 1, minWidth: 0 },
  documentReadyTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  documentReadyBadge: { borderRadius: 999, backgroundColor: '#EEF5FF', paddingHorizontal: 9, paddingVertical: 5 },
  documentReadyBadgeText: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900' },
  documentReadyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  documentReadyTile: { position: 'relative', width: '31.5%', minWidth: 0, minHeight: 106, borderRadius: 14, backgroundColor: '#F7FAFF', borderWidth: 1.5, borderColor: '#E2EAF4', paddingVertical: 8, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  documentReadyTileReady: { backgroundColor: '#F2F7FF', borderColor: '#6D9EE8' },
  documentRemoveButton: { position: 'absolute', top: 5, right: 5, zIndex: 3, width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
  documentReadyArtworkWrap: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  documentReadyArtwork: { width: 43, height: 43 },
  accidentVideoArtwork: { width: 36, height: 38, borderRadius: 8, backgroundColor: '#FF1018', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingTop: 1, shadowColor: '#B60000', shadowOpacity: 0.18, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  accidentVideoGloss: { position: 'absolute', top: 2, left: 3, width: 21, height: 8, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.20)', transform: [{ rotate: '-12deg' }] },
  accidentVideoFold: { position: 'absolute', top: 0, right: 0, width: 11, height: 11, borderBottomLeftRadius: 7, backgroundColor: '#FFDDE2' },
  accidentVideoLineLong: { width: 19, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF', marginTop: 3 },
  accidentVideoLineShort: { width: 12, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF', marginTop: 2 },
  documentReadyTileText: { color: palette.navy, fontSize: 8.5, lineHeight: 11, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  documentReadyFileName: { maxWidth: '100%', color: '#56657A', fontSize: 7.3, lineHeight: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  documentReadyStatus: { color: '#7A8799', fontSize: 7.5, fontWeight: '800', marginTop: 3 },
  documentReadyStatusReady: { color: '#326FC6' },
  bulkUploadShell: { position: 'relative' },
  bulkUpload: { minHeight: 58, marginTop: 10, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#AFC8E8', backgroundColor: '#F7FAFF', paddingHorizontal: 10, paddingRight: 38, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bulkUploadSelected: { borderStyle: 'solid', borderColor: '#52B57F', backgroundColor: '#EFFAF4' },
  bulkUploadIconArtwork: { width: 34, height: 34 },
  bulkUploadCopy: { flex: 1, minWidth: 0 },
  bulkUploadTitle: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  bulkUploadText: { color: '#718198', fontSize: 8.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  bulkRemoveButton: { position: 'absolute', top: 15, right: 7, zIndex: 3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
  validationBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7, 24, 50, 0.48)', paddingHorizontal: 24 },
  validationCard: { width: '100%', maxWidth: 340, borderRadius: 20, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  validationTitle: { color: '#172033', fontSize: 18, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  validationBody: { color: '#667085', fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center', marginTop: 7, paddingHorizontal: 4 },
  deleteConfirmIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  deleteConfirmActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 14 },
  deleteCancelButton: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  deleteCancelText: { color: palette.navy, fontSize: 11, fontWeight: '900' },
  deleteConfirmButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#C43232', alignItems: 'center', justifyContent: 'center' },
  deleteConfirmText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  controlSuccessBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5, 20, 48, 0.48)', paddingHorizontal: 28 },
  controlSuccessCard: { width: '100%', maxWidth: 300, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  controlSuccessIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#168161', alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  controlSuccessTitle: { color: palette.navy, fontSize: 15, lineHeight: 19, fontWeight: '900', textAlign: 'center' },
  controlSuccessNumber: { width: '100%', minHeight: 58, marginTop: 10, borderRadius: 11, borderWidth: 1, borderColor: '#D8E3F0', backgroundColor: '#F8FBFF', paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  controlSuccessNumberPressed: { backgroundColor: '#EEF5FF', borderColor: '#BFD4EE', transform: [{ scale: 0.995 }] },
  controlSuccessNumberCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  controlSuccessNumberLabel: { color: '#6B7B90', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.7 },
  controlSuccessNumberValue: { color: palette.navy, fontSize: 17, lineHeight: 21, fontWeight: '900', marginTop: 2 },
  controlSuccessOk: { minWidth: 54, height: 34, borderRadius: 10, backgroundColor: '#0A43A3', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  controlSuccessOkText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900', letterSpacing: 0.2 },
  timeField: { gap: 5, marginTop: 10 },
  timeLabel: { color: '#3F4D63', fontSize: 11, fontWeight: '800' },
  timeButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#D2DFEC', backgroundColor: '#FBFDFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '800' },
  timePlaceholder: { color: '#8A94A6' },
  timeModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 28, 62, 0.38)' },
  timeModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  timeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  timeModalEyebrow: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  timeModalTitle: { color: palette.navy, fontSize: 19, fontWeight: '900', marginTop: 3 },
  timeClose: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  timeColumns: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 },
  timeColumn: { flex: 1, minWidth: 0 },
  timeColumnLabel: { color: '#667085', fontSize: 10, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  timeOption: { width: 48, height: 40, borderRadius: 10, backgroundColor: '#F5F8FC', alignItems: 'center', justifyContent: 'center' },
  timeOptionSelected: { backgroundColor: '#0A43A3' },
  timeOptionText: { color: '#56657A', fontSize: 12, fontWeight: '800' },
  timeOptionTextSelected: { color: '#FFFFFF' },
  timeColon: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 23 },
  timeDone: { minHeight: 50, marginTop: 18, borderRadius: 14, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
