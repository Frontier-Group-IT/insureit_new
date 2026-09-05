import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDatePicker } from '@/components/design-system';
import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';
import { ClaimActionBar, ClaimFormSection, ClaimIdentityCard, ExternalClaimStageHeader } from '@/components/external-claim-ui';
import { Screen, TextField } from '@/components/ui';
import { getCurrentSession, makeClaimNumber } from '@/lib/auth';
import { recordClaimEvent } from '@/lib/claim-notifications';
import { customerAccountTitle, getOperationalCustomerContexts, partnerTypeLabel, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type TimeTarget = 'incident' | 'intimation' | null;
type DocumentKey = 'rc' | 'insurance' | 'licence' | 'gr' | 'accident_photo' | 'accident_video' | 'bulk';
type PickedDocument = { name: string; uri: string; mimeType?: string | null; size?: number | null };
type DeleteTarget = { key: DocumentKey; title: string } | null;

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

export default function ReportAccidentScreen() {
  const router = useRouter();
  const { vehicleId, policyId } = useLocalSearchParams<{ vehicleId?: string; policyId?: string }>();

  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? '');

  const [incidentDate, setIncidentDate] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [intimationDate, setIntimationDate] = useState('');
  const [intimationTime, setIntimationTime] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [location, setLocation] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [documents, setDocuments] = useState<Record<DocumentKey, PickedDocument[]>>({
    rc: [], insurance: [], licence: [], gr: [], accident_photo: [], accident_video: [], bulk: [],
  });
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeTarget, setTimeTarget] = useState<TimeTarget>(null);
  const [expiryWarningOpen, setExpiryWarningOpen] = useState(false);
  const [expiryWarningAcknowledged, setExpiryWarningAcknowledged] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const nextContexts = await getOperationalCustomerContexts();
      const ids = nextContexts.map((context) => context.customer_id);
      setContexts(nextContexts);
      setSelectedCustomerId(nextContexts[0]?.customer_id ?? '');
      if (!ids.length) return;

      const [vehicleResult, policyResult, insurerResult] = await Promise.all([
        supabase.from('vehicles').select('*').in('customer_id', ids).order('vehicle_no'),
        supabase.from('policies').select('*').in('customer_id', ids).order('end_date', { ascending: false }),
        supabase.from('insurance_companies').select('*'),
      ]);

      const nextVehicles = vehicleResult.data ?? [];
      setVehicles(nextVehicles);
      setPolicies(policyResult.data ?? []);
      setInsurers(insurerResult.data ?? []);

      if (vehicleId && nextVehicles.some((vehicle) => vehicle.id === vehicleId)) {
        const routeVehicle = nextVehicles.find((vehicle) => vehicle.id === vehicleId);
        setSelectedCustomerId(routeVehicle?.customer_id ?? nextContexts[0]?.customer_id ?? '');
        setSelectedVehicleId(vehicleId);
      } else if (nextVehicles.length === 1) {
        setSelectedVehicleId(nextVehicles[0].id);
        setSelectedCustomerId(nextVehicles[0].customer_id);
      }
    }

    void load();
  }, [router, vehicleId]);

  const accountVehicles = useMemo(
    () => vehicles.filter((item) => item.customer_id === selectedCustomerId),
    [selectedCustomerId, vehicles],
  );
  const selectedVehicle = useMemo(
    () => accountVehicles.find((item) => item.id === selectedVehicleId) ?? null,
    [accountVehicles, selectedVehicleId],
  );
  const selectedPolicy = useMemo(() => {
    if (!selectedVehicle) return null;
    const routed = policyId ? policies.find((item) => item.id === policyId && item.vehicle_id === selectedVehicle.id) : null;
    return routed ?? policies.find((item) => item.vehicle_id === selectedVehicle.id) ?? null;
  }, [policies, policyId, selectedVehicle]);
  const selectedInsurer = useMemo(() => {
    if (!selectedPolicy) return null;
    return insurers.find((item) => item.id === selectedPolicy.insurance_company_id) ?? null;
  }, [insurers, selectedPolicy]);
  const selectedContext = useMemo(
    () => contexts.find((context) => context.customer_id === selectedCustomerId) ?? null,
    [contexts, selectedCustomerId],
  );

  useEffect(() => {
    setExpiryWarningAcknowledged(false);
  }, [incidentDate, selectedPolicy?.id]);

  function selectAccount(customerId: string) {
    setSelectedCustomerId(customerId);
    const firstVehicle = vehicles.find((vehicle) => vehicle.customer_id === customerId);
    setSelectedVehicleId(firstVehicle?.id ?? '');
  }

  function selectVehicle(nextVehicleId: string) {
    setSelectedVehicleId(nextVehicleId);
    const vehicle = vehicles.find((item) => item.id === nextVehicleId);
    if (vehicle) setSelectedCustomerId(vehicle.customer_id);
  }

  async function pickDocument(key: Exclude<DocumentKey, 'bulk'>) {
    setMessage('');
    const isMedia = key === 'accident_photo' || key === 'accident_video';
    const type = key === 'accident_video' ? ['video/*'] : key === 'accident_photo' ? ['image/*'] : ['application/pdf', 'image/*'];
    const result = await DocumentPicker.getDocumentAsync({ type, multiple: isMedia, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;

    const picked = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size ?? null }));
    const limit = key === 'accident_video' ? MAX_VIDEO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
    const label = key === 'accident_video' ? '50 MB' : '5 MB';
    const tooLarge = picked.find((file) => file.size != null && file.size > limit);
    if (tooLarge) return setMessage(`${tooLarge.name} is larger than ${label}. Please choose a smaller file.`);

    setDocuments((current) => ({ ...current, [key]: isMedia ? [...current[key], ...picked] : [picked[0]] }));
  }

  async function pickBulkDocuments() {
    setMessage('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size ?? null }));
    const tooLarge = picked.find((file) => file.size != null && file.size > MAX_UPLOAD_SIZE_BYTES);
    if (tooLarge) return setMessage(`${tooLarge.name} is larger than 5 MB. Please choose a smaller file.`);
    setDocuments((current) => ({ ...current, bulk: [...current.bulk, ...picked] }));
  }

  function requestDelete(key: DocumentKey, title: string) {
    setDeleteTarget({ key, title });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDocuments((current) => ({ ...current, [deleteTarget.key]: [] }));
    setDeleteTarget(null);
  }

  async function captureCurrentLocation() {
    if (loadingLocation) return;
    setLocationNotice('');
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationNotice('Location permission is not available. You can still enter the location manually.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let resolved = `${current.coords.latitude.toFixed(6)}, ${current.coords.longitude.toFixed(6)}`;
      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude: current.coords.latitude, longitude: current.coords.longitude });
        if (address) {
          const parts = [address.name, address.street, address.district, address.city || address.subregion, address.region, address.postalCode]
            .map((part) => part?.trim())
            .filter((part): part is string => Boolean(part));
          if (parts.length) resolved = Array.from(new Set(parts)).join(', ');
        }
      } catch {
        // Keep coordinates when reverse geocoding is unavailable.
      }
      setLocation(resolved);
      setLocationNotice('Current location added. You can edit it if needed.');
    } catch {
      setLocationNotice('Could not fetch your current location. Please try again or enter it manually.');
    } finally {
      setLoadingLocation(false);
    }
  }

  async function uploadPendingDocuments(claimId: string, customerId: string) {
    const queued = [
      ...documents.rc.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.rc, file })),
      ...documents.insurance.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.insurance, file })),
      ...documents.licence.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.licence, file })),
      ...documents.gr.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.gr, file })),
      ...documents.accident_photo.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.accident_photo, file })),
      ...documents.accident_video.map((file) => ({ type: DOCUMENT_TYPE_BY_KEY.accident_video, file })),
      ...documents.bulk.map((file) => ({ type: BULK_DOCUMENT_TYPE, file })),
    ];
    if (!queued.length) return { saved: 0, total: 0 };

    const session = await getCurrentSession();
    if (!session?.user) return { saved: 0, total: queued.length };
    setUploadingDocuments(true);
    let saved = 0;
    try {
      for (const item of queued) {
        const extension = item.file.name.includes('.') ? item.file.name.split('.').pop() : 'bin';
        const storagePath = `${customerId}/${claimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        try {
          const response = await fetch(item.file.uri);
          const body = await response.arrayBuffer();
          const limit = item.type === DOCUMENT_TYPE_BY_KEY.accident_video ? MAX_VIDEO_UPLOAD_SIZE_BYTES : MAX_UPLOAD_SIZE_BYTES;
          if (body.byteLength > limit) continue;
          const uploaded = await supabase.storage.from('claim-documents').upload(storagePath, body, {
            contentType: item.file.mimeType ?? 'application/octet-stream',
            upsert: false,
          });
          if (uploaded.error) continue;
          const record = await supabase.from('claim_documents').insert({
            claim_id: claimId,
            customer_id: customerId,
            document_type: item.type,
            file_name: item.file.name,
            storage_bucket: 'claim-documents',
            storage_path: storagePath,
            mime_type: item.file.mimeType ?? null,
            file_size: body.byteLength,
            uploaded_by: session.user.id,
          });
          if (!record.error) saved += 1;
        } catch {
          // Continue with the remaining selected documents.
        }
      }
    } finally {
      setUploadingDocuments(false);
    }
    return { saved, total: queued.length };
  }

  async function submit(options?: { allowExpiredPolicy?: boolean }) {
    setMessage('');
    if (!selectedVehicle || !selectedPolicy) return setMessage('Vehicle and active policy details are required.');
    if (!driverName.trim() || !driverPhone.trim()) return setMessage('Enter driver name and mobile number.');
    if (!selectedContext) return setMessage('Select the customer account for this claim.');

    const incidentAt = parseDateTime(incidentDate, incidentTime);
    const spotIntimationAt = parseDateTime(intimationDate, intimationTime);
    if (!incidentAt) return setMessage('Select the accident date and time.');
    if (!spotIntimationAt) return setMessage('Select the spot intimation date and time.');
    if (incidentAt.getTime() > Date.now()) return setMessage('Accident Date / Time cannot be in the future.');
    if (spotIntimationAt.getTime() > Date.now()) return setMessage('Spot Intimation Date / Time cannot be in the future.');
    if (spotIntimationAt.getTime() < incidentAt.getTime()) return setMessage('Spot Intimation Date / Time cannot be earlier than Accident Date / Time.');
    if (!location.trim()) return setMessage('Enter the incident location.');

    const policyExpiredBeforeIncident = isIncidentAfterPolicyExpiry(selectedPolicy, incidentAt);
    if (policyExpiredBeforeIncident && !options?.allowExpiredPolicy && !expiryWarningAcknowledged) {
      setExpiryWarningOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const payload = {
        claim_no: makeClaimNumber(),
        customer_id: selectedContext.customer_id,
        vehicle_id: selectedVehicle.id,
        policy_id: selectedPolicy.id,
        insurance_company_id: selectedPolicy.insurance_company_id,
        current_status: 'Initial Documents Pending' as const,
        accident_at: incidentAt.toISOString(),
        spot_intimation_at: spotIntimationAt.toISOString(),
        accident_location: location.trim(),
        accident_description: `Driver: ${driverName.trim()}\nDriver phone: ${driverPhone.trim()}${policyExpiredBeforeIncident ? `\nPolicy expiry warning: Policy expired on ${formatDate(selectedPolicy.end_date)} before incident date ${formatDate(incidentAt.toISOString())}.` : ''}`,
        estimated_loss: null,
        created_by: session.user.id,
      };

      const { data: claim, error } = await supabase.from('claims').insert(payload).select('*').single();
      if (error || !claim) return setMessage(mapSubmitError(error));

      const persisted = await uploadPendingDocuments(claim.id, claim.customer_id);
      if (persisted.saved !== persisted.total) {
        setMessage(`${persisted.saved} of ${persisted.total} selected documents were saved. You can add the remaining documents on the next screen.`);
      }

      try {
        await recordClaimEvent({
          claimId: claim.id,
          customerId: claim.customer_id,
          fromStatus: null,
          toStatus: claim.current_status,
          notes: 'New incident claim reported by customer.',
          changedBy: session.user.id,
          title: `New claim ${claim.claim_no}`,
        });
      } catch {
        // Claim creation must not fail if notification logging is unavailable.
      }

      router.replace({ pathname: '/customer/upload-documents', params: { claimId: claim.id } });
    } catch {
      setMessage('We could not submit the incident report right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const mediaStatus = (key: 'accident_photo' | 'accident_video') => {
    const count = documents[key].length;
    if (!count) return undefined;
    return `${count} ${key === 'accident_photo' ? 'photo' : 'video'}${count === 1 ? '' : 's'} ready`;
  };

  return (
    <Screen title="Spot Intimation" showTitleHeader={false}>
      <ExternalClaimStageHeader
        step={1}
        title="Spot Intimation"
        subtitle="Start tracking an incident."
        vehicleNo={selectedVehicle?.vehicle_no ?? undefined}
        onBack={() => router.back()}
      />

      {contexts.length > 1 ? <AccountSelector contexts={contexts} selectedCustomerId={selectedCustomerId} onSelect={selectAccount} /> : null}

      {accountVehicles.length > 1 ? (
        <View style={styles.vehiclePicker}>
          <Text style={styles.selectorLabel}>Vehicle</Text>
          {accountVehicles.map((vehicle) => {
            const active = vehicle.id === selectedVehicleId;
            return (
              <Pressable key={vehicle.id} onPress={() => selectVehicle(vehicle.id)} style={[styles.vehicleOption, active && styles.vehicleOptionActive]}>
                <Text style={[styles.vehicleOptionText, active && styles.vehicleOptionTextActive]}>{vehicle.vehicle_no}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selectedPolicy && selectedVehicle ? (
        <ClaimIdentityCard
          claimNo="New claim"
          insurerName={selectedInsurer?.name ?? 'Insurance company'}
          vehicleNo={selectedVehicle.vehicle_no}
          policyNo={selectedPolicy.policy_no}
          vehicleMeta={[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' · ')}
        />
      ) : null}

      <ExternalClaimErrorPopup visible={Boolean(message)} message={message} title="Alert" onClose={() => setMessage('')} />

      <ClaimFormSection title="Incident Details" subtitle="Accident date, time and first insurer intimation" iconImage={require('../../assets/claims/claim-intimation.png')}>
        <AppDatePicker label="Accident Date *" value={incidentDate} onChange={setIncidentDate} maxDate={todayIsoDate()} />
        <TimePickerField label="Accident Time *" value={incidentTime} onPress={() => setTimeTarget('incident')} />
        <View style={styles.subsection}><Text style={styles.subsectionTitle}>Spot Intimation</Text></View>
        <AppDatePicker label="Spot Intimation Date *" value={intimationDate} onChange={setIntimationDate} maxDate={todayIsoDate()} />
        <TimePickerField label="Spot Intimation Time *" value={intimationTime} onPress={() => setTimeTarget('intimation')} />
        <View style={styles.gap} />
        <TextField label="Driver Name *" value={driverName} onChangeText={setDriverName} />
        <View style={styles.gap} />
        <TextField label="Driver Number *" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />
        <View style={styles.gap} />
        <View style={styles.locationFieldWrap}>
          <TextField label="Location *" value={location} onChangeText={(value) => { setLocation(value); setLocationNotice(''); }} />
          <Pressable disabled={loadingLocation} onPress={() => void captureCurrentLocation()} style={styles.gpsInlineAction}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#0A43A3" />
            <Text style={styles.gpsInlineText}>{loadingLocation ? 'Locating...' : 'Use Current Location'}</Text>
          </Pressable>
        </View>
        {locationNotice ? <Text style={styles.locationNotice}>{locationNotice}</Text> : null}
      </ClaimFormSection>

      <View style={styles.documentReadyCard}>
        <View style={styles.documentReadyHeader}>
          <Text style={styles.documentReadyTitle}>Upload claim documents</Text>
          <View style={styles.documentReadyBadge}><Text style={styles.documentReadyBadgeText}>Optional now</Text></View>
        </View>
        <View style={styles.documentReadyGrid}>
          <DocumentReadyTile title="RC Copy" fileName={documents.rc[0]?.name} source={require('../../assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png')} onPress={() => void pickDocument('rc')} onRemove={() => requestDelete('rc', documents.rc[0]?.name ?? 'RC Copy')} />
          <DocumentReadyTile title="Insurance Copy" fileName={documents.insurance[0]?.name} source={require('../../assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png')} onPress={() => void pickDocument('insurance')} onRemove={() => requestDelete('insurance', documents.insurance[0]?.name ?? 'Insurance Copy')} />
          <DocumentReadyTile title="Driver Licence" fileName={documents.licence[0]?.name} source={require('../../assets/brand/spot-intimation/glossy_purple_id_card_icon.png')} onPress={() => void pickDocument('licence')} onRemove={() => requestDelete('licence', documents.licence[0]?.name ?? 'Driver Licence')} />
          <DocumentReadyTile title="GR / Load Bill" fileName={documents.gr[0]?.name} source={require('../../assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png')} onPress={() => void pickDocument('gr')} onRemove={() => requestDelete('gr', documents.gr[0]?.name ?? 'GR / Load Bill')} />
          <DocumentReadyTile title="Accident Photo" statusText={mediaStatus('accident_photo')} source={require('../../assets/brand/spot-intimation/glossy_pink_camera_document_icon.png')} onPress={() => void pickDocument('accident_photo')} onRemove={() => requestDelete('accident_photo', 'accident photos')} />
          <DocumentReadyTile title="Accident Video" statusText={mediaStatus('accident_video')} iconName="video-outline" iconColor="#E12C48" onPress={() => void pickDocument('accident_video')} onRemove={() => requestDelete('accident_video', 'accident videos')} />
        </View>
        <View style={styles.bulkUploadShell}>
          <Pressable onPress={() => void pickBulkDocuments()} style={[styles.bulkUpload, documents.bulk.length > 0 && styles.bulkUploadSelected]}>
            <Image source={require('../../assets/claims/claim-documents.png')} style={styles.bulkUploadIcon} resizeMode="contain" />
            <View style={styles.bulkUploadCopy}>
              <Text style={styles.bulkUploadTitle}>Upload multiple documents</Text>
              <Text style={styles.bulkUploadText}>{documents.bulk.length ? `${documents.bulk.length} file${documents.bulk.length === 1 ? '' : 's'} ready` : 'Select several files now, or add them on the next screen.'}</Text>
            </View>
            <MaterialCommunityIcons name="plus-circle-outline" size={21} color="#0A43A3" />
          </Pressable>
          {documents.bulk.length ? <Pressable onPress={() => requestDelete('bulk', 'uploaded documents')} style={styles.bulkRemove}><MaterialCommunityIcons name="close" size={14} color="#C43232" /></Pressable> : null}
        </View>
      </View>

      <View style={styles.voicePlaceholder}>
        <View style={styles.voiceHeadingRow}>
          <View style={styles.voiceIcon}><MaterialCommunityIcons name="microphone-outline" size={25} color="#0A43A3" /></View>
          <View style={styles.voiceCopy}>
            <Text style={styles.voiceTitle}>Incident Voice Note</Text>
            <Text style={styles.voiceText}>Describe what happened in your own words so the incident is easier to understand later.</Text>
          </View>
        </View>
        <Pressable disabled style={styles.voiceButton}>
          <MaterialCommunityIcons name="microphone" size={18} color="#FFFFFF" />
          <Text style={styles.voiceButtonText}>Record Voice Note</Text>
        </Pressable>
        <View style={styles.voiceComingSoon}><MaterialCommunityIcons name="clock-outline" size={14} color="#60738B" /><Text style={styles.voiceComingSoonText}>This feature will be added soon.</Text></View>
      </View>

      <ClaimActionBar
        primaryDisabled={submitting || uploadingDocuments || !selectedPolicy}
        primaryIcon="arrow-right"
        primaryLabel={submitting || uploadingDocuments ? 'Saving...' : 'Save & Continue'}
        onPrimary={() => void submit()}
        onAssistance={() => router.push('/customer/support')}
      />

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#C43232" />
            <Text style={styles.modalTitle}>Delete document?</Text>
            <Text style={styles.modalBody}>{deleteTarget ? `Are you sure you want to delete ${deleteTarget.title}?` : ''}</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setDeleteTarget(null)} style={styles.modalSecondary}><Text style={styles.modalSecondaryText}>Cancel</Text></Pressable>
              <Pressable onPress={confirmDelete} style={styles.modalPrimary}><Text style={styles.modalPrimaryText}>Delete</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={expiryWarningOpen} transparent animationType="fade" onRequestClose={() => setExpiryWarningOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="shield-alert-outline" size={28} color="#B42318" />
            <Text style={styles.modalTitle}>Policy expired before incident date</Text>
            <Text style={styles.modalBody}>The selected policy expired on {formatDate(selectedPolicy?.end_date)}. You can still continue, but this claim may need extra insurer review.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setExpiryWarningOpen(false)} style={styles.modalSecondary}><Text style={styles.modalSecondaryText}>Review Date</Text></Pressable>
              <Pressable onPress={() => { setExpiryWarningOpen(false); setExpiryWarningAcknowledged(true); void submit({ allowExpiredPolicy: true }); }} style={styles.modalPrimary}><Text style={styles.modalPrimaryText}>Continue</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <TimePickerModal
        value={timeTarget === 'intimation' ? intimationTime : incidentTime}
        visible={timeTarget !== null}
        title={timeTarget === 'intimation' ? 'Select spot intimation time' : 'Select incident time'}
        onClose={() => setTimeTarget(null)}
        onSelect={(value) => { if (timeTarget === 'intimation') setIntimationTime(value); else setIncidentTime(value); setTimeTarget(null); }}
      />
    </Screen>
  );
}

function AccountSelector({ contexts, selectedCustomerId, onSelect }: { contexts: CustomerAccountContext[]; selectedCustomerId: string; onSelect: (customerId: string) => void }) {
  return <View style={styles.selectorCard}>
    <Text style={styles.selectorLabel}>Report for</Text>
    {contexts.map((context) => {
      const active = context.customer_id === selectedCustomerId;
      return <Pressable key={context.customer_id} onPress={() => onSelect(context.customer_id)} style={[styles.accountOption, active && styles.accountOptionActive]}>
        <View><Text style={styles.accountTitle}>{customerAccountTitle(context)}</Text><Text style={styles.accountMeta}>{context.access_source === 'group_child' ? 'Associated account' : 'Parent account'} · {partnerTypeLabel(context.partner_type)}</Text></View>
        <MaterialCommunityIcons name={active ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={active ? '#0A43A3' : '#8EA0B6'} />
      </Pressable>;
    })}
  </View>;
}

function DocumentReadyTile({ title, fileName, statusText, source, iconName, iconColor, onPress, onRemove }: { title: string; fileName?: string; statusText?: string; source?: any; iconName?: keyof typeof MaterialCommunityIcons.glyphMap; iconColor?: string; onPress: () => void; onRemove: () => void }) {
  const selected = Boolean(fileName || statusText);
  return <Pressable onPress={onPress} style={[styles.documentTile, selected && styles.documentTileSelected]}>
    {selected ? <Pressable onPress={(event) => { event.stopPropagation(); onRemove(); }} style={styles.documentRemove}><MaterialCommunityIcons name="close" size={13} color="#C43232" /></Pressable> : null}
    <View style={styles.documentArtworkWrap}>{source ? <Image source={source} style={styles.documentArtwork} resizeMode="contain" /> : iconName ? <MaterialCommunityIcons name={iconName} size={32} color={iconColor ?? '#0A43A3'} /> : null}</View>
    <Text style={styles.documentTileTitle}>{title}</Text>
    {fileName ? <Text style={styles.documentFileName} numberOfLines={1}>{fileName}</Text> : null}
    <Text style={[styles.documentStatus, selected && styles.documentStatusSelected]}>{statusText ?? (selected ? 'Ready' : 'Tap to upload')}</Text>
  </Pressable>;
}

function TimePickerField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.timeField}><Text style={styles.timeLabel}>{label}</Text><Pressable onPress={onPress} style={styles.timeButton}><MaterialCommunityIcons name="clock-outline" size={19} color="#0A43A3" /><Text style={[styles.timeValue, !value && styles.timePlaceholder]}>{value ? formatTime(value) : 'Select time'}</Text><MaterialCommunityIcons name="chevron-down" size={21} color={palette.navy} /></Pressable></View>;
}

function TimePickerModal({ value, visible, title, onClose, onSelect }: { value: string; visible: boolean; title: string; onClose: () => void; onSelect: (value: string) => void }) {
  const parsed = parseTime(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  useEffect(() => { if (visible) { const next = parseTime(value); setHour(next.hour); setMinute(next.minute); } }, [value, visible]);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.timeModalCard}><Text style={styles.modalTitle}>{title}</Text><View style={styles.timeAdjustRow}><TimeAdjust label="Hour" value={hour} max={23} onChange={setHour} /><Text style={styles.timeColon}>:</Text><TimeAdjust label="Minute" value={minute} max={59} step={5} onChange={setMinute} /></View><View style={styles.modalActions}><Pressable onPress={onClose} style={styles.modalSecondary}><Text style={styles.modalSecondaryText}>Cancel</Text></Pressable><Pressable onPress={() => onSelect(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)} style={styles.modalPrimary}><Text style={styles.modalPrimaryText}>Done</Text></Pressable></View></View></View></Modal>;
}

function TimeAdjust({ label, value, max, step = 1, onChange }: { label: string; value: number; max: number; step?: number; onChange: (value: number) => void }) {
  const move = (delta: number) => onChange((value + delta + max + 1) % (max + 1));
  return <View style={styles.timeAdjust}><Text style={styles.timeAdjustLabel}>{label}</Text><Pressable onPress={() => move(step)} style={styles.timeAdjustButton}><MaterialCommunityIcons name="chevron-up" size={22} color="#0A43A3" /></Pressable><Text style={styles.timeAdjustValue}>{String(value).padStart(2, '0')}</Text><Pressable onPress={() => move(-step)} style={styles.timeAdjustButton}><MaterialCommunityIcons name="chevron-down" size={22} color="#0A43A3" /></Pressable></View>;
}

function parseDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return { hour: 12, minute: 0 };
  const [hour, minute] = value.split(':').map(Number);
  return { hour: Math.min(23, Math.max(0, hour)), minute: Math.min(59, Math.max(0, minute)) };
}

function formatTime(value: string) {
  const parsed = parseTime(value);
  const date = new Date(2000, 0, 1, parsed.hour, parsed.minute);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function isIncidentAfterPolicyExpiry(policy: Policy | null, incidentAt: Date | null) {
  if (!policy?.end_date || !incidentAt) return false;
  const expiry = new Date(`${policy.end_date.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(expiry.getTime()) && incidentAt.getTime() > expiry.getTime();
}

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mapSubmitError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  if (message.includes('duplicate')) return 'A claim already exists for these details. Please check My Claims.';
  if (message.includes('policy')) return 'The selected policy could not be used for this claim.';
  return error?.message || 'We could not submit the incident report right now. Please try again.';
}

const styles = StyleSheet.create({
  selectorCard: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#D9E2EE', backgroundColor: '#FFFFFF', gap: 9 },
  selectorLabel: { color: '#40536D', fontSize: 12, fontWeight: '700' },
  accountOption: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: '#DFE6EF', paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountOptionActive: { borderColor: '#0A43A3', backgroundColor: '#F3F7FF' },
  accountTitle: { color: palette.navy, fontSize: 14, fontWeight: '800' },
  accountMeta: { color: '#65758A', fontSize: 11, marginTop: 2 },
  vehiclePicker: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#D9E2EE', backgroundColor: '#FFFFFF', gap: 8 },
  vehicleOption: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#DCE5EF', paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#F9FBFD' },
  vehicleOptionActive: { borderColor: palette.navy, backgroundColor: '#EDF4FF' },
  vehicleOptionText: { color: palette.navy, fontSize: 14, fontWeight: '800' },
  vehicleOptionTextActive: { color: palette.navy },
  subsection: { marginTop: 6, marginBottom: 2 },
  subsectionTitle: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  gap: { height: 8 },
  locationFieldWrap: { position: 'relative' },
  gpsInlineAction: { marginTop: 8, alignSelf: 'flex-end', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#C9D9F3', backgroundColor: '#F7FAFF' },
  gpsInlineText: { color: '#0A43A3', fontSize: 12, fontWeight: '700' },
  locationNotice: { marginTop: 8, color: '#60738B', fontSize: 12, lineHeight: 17 },
  timeField: { gap: 7 },
  timeLabel: { color: palette.navy, fontSize: 13, fontWeight: '700' },
  timeButton: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#D8E1EC', backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeValue: { flex: 1, color: palette.navy, fontSize: 14, fontWeight: '700' },
  timePlaceholder: { color: '#8C98A9', fontWeight: '600' },
  documentReadyCard: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#D9E2EE', backgroundColor: '#FFFFFF' },
  documentReadyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  documentReadyTitle: { color: palette.navy, fontSize: 17, fontWeight: '900' },
  documentReadyBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F3F7FF' },
  documentReadyBadgeText: { color: '#0A43A3', fontSize: 10, fontWeight: '800' },
  documentReadyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  documentTile: { width: '48.5%', minHeight: 142, borderRadius: 17, borderWidth: 1, borderColor: '#DCE5EF', backgroundColor: '#FBFCFE', alignItems: 'center', padding: 12 },
  documentTileSelected: { borderColor: '#AFC7EE', backgroundColor: '#F6F9FF' },
  documentRemove: { position: 'absolute', right: 7, top: 7, zIndex: 2, width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2F2' },
  documentArtworkWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  documentArtwork: { width: 44, height: 44 },
  documentTileTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '800', textAlign: 'center' },
  documentFileName: { marginTop: 4, color: '#617188', fontSize: 10.5, maxWidth: '100%' },
  documentStatus: { marginTop: 7, color: '#7A8798', fontSize: 10, fontWeight: '700' },
  documentStatusSelected: { color: '#18864B' },
  bulkUploadShell: { marginTop: 12, position: 'relative' },
  bulkUpload: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFD0E8', backgroundColor: '#F8FBFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulkUploadSelected: { borderColor: '#79A3DD', backgroundColor: '#F2F7FF' },
  bulkUploadIcon: { width: 34, height: 34 },
  bulkUploadCopy: { flex: 1 },
  bulkUploadTitle: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  bulkUploadText: { color: '#66768B', fontSize: 11, marginTop: 2, lineHeight: 15 },
  bulkRemove: { position: 'absolute', right: -4, top: -7, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF2F2', alignItems: 'center', justifyContent: 'center' },
  voicePlaceholder: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: '#D9E2EE', backgroundColor: '#FFFFFF' },
  voiceHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  voiceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F0F5FF', alignItems: 'center', justifyContent: 'center' },
  voiceCopy: { flex: 1 },
  voiceTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' },
  voiceText: { color: '#65758A', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  voiceButton: { marginTop: 12, minHeight: 46, borderRadius: 14, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: 0.6 },
  voiceButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  voiceComingSoon: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  voiceComingSoonText: { color: '#60738B', fontSize: 10.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,24,52,0.46)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 390, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 20, alignItems: 'center' },
  modalTitle: { marginTop: 8, color: palette.navy, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalBody: { marginTop: 8, color: '#607087', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  modalActions: { marginTop: 18, width: '100%', flexDirection: 'row', gap: 10 },
  modalSecondary: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: '#D4DEEA', alignItems: 'center', justifyContent: 'center' },
  modalSecondaryText: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  modalPrimary: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#0A43A3', alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  timeModalCard: { width: '100%', maxWidth: 360, borderRadius: 22, backgroundColor: '#FFFFFF', padding: 20 },
  timeAdjustRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  timeColon: { color: palette.navy, fontSize: 30, fontWeight: '800' },
  timeAdjust: { alignItems: 'center' },
  timeAdjustLabel: { color: '#6B7A90', fontSize: 11, fontWeight: '700' },
  timeAdjustButton: { width: 42, height: 35, alignItems: 'center', justifyContent: 'center' },
  timeAdjustValue: { minWidth: 52, color: palette.navy, fontSize: 28, fontWeight: '900', textAlign: 'center' },
});
