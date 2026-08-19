import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CLAIM_STAGE_ICON, ClaimProgressRail, ClaimStageHeader, StageDetailsCard, StageSaveButton } from '@/components/claim-stage';
import { AppDatePicker } from '@/components/design-system';
import { LoadingState, Message, Screen, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { InsuranceCompany, Vehicle } from '@/lib/types';

type ExternalPolicy = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
};

export default function SelfManagedClaimScreen() {
  const router = useRouter();
  const { externalPolicyId } = useLocalSearchParams<{ externalPolicyId?: string }>();
  const [policy, setPolicy] = useState<ExternalPolicy | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [insurer, setInsurer] = useState<InsuranceCompany | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [driver, setDriver] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [documentMap, setDocumentMap] = useState<Record<string, { name: string; uri: string; mimeType?: string | null; size?: number | null }[]>>({});
  const insurerName = insurer?.name ?? 'United India';
  const documentArtwork = {
    'RC Copy': require('../../assets/brand/spot-intimation/glossy_green_vehicle_document_icon.png'),
    'Insurance Copy': require('../../assets/brand/spot-intimation/glossy_blue_secure_policy_document_icon.png'),
    'Driving License': require('../../assets/brand/spot-intimation/glossy_purple_id_card_icon.png'),
    'GR Copy': require('../../assets/brand/spot-intimation/glossy_orange_delivery_document_icon.png'),
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!externalPolicyId) { setMessage('Select a policy before starting a claim.'); setLoading(false); return; }
      const { data } = await (supabase as any).from('external_policies').select('*').eq('id', externalPolicyId).maybeSingle();
      if (!active) return;
      const next = data as ExternalPolicy | null;
      if (!next) { setMessage('This customer-added policy is not available.'); setLoading(false); return; }
      const [result, insurerResult] = await Promise.all([
        supabase.from('vehicles').select('*').eq('id', next.vehicle_id).maybeSingle(),
        supabase.from('insurance_companies').select('*').eq('id', next.insurance_company_id).maybeSingle(),
      ]);
      if (!active) return;
      setPolicy(next);
      setVehicle(result.data ?? null);
      setInsurer(insurerResult.data ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [externalPolicyId]);

  async function pickDocument(documentType: string) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      return setMessage('Please upload a document smaller than 5 MB.');
    }
    setDocumentMap((current) => ({
      ...current,
      [documentType]: [{ name: asset.name || 'Document', uri: asset.uri, mimeType: asset.mimeType ?? null, size: asset.size ?? null }],
    }));
    setMessage('');
  }

  async function pickBulkDocuments() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled) return;
    const assets = result.assets ?? [];
    if (!assets.length) return;
    const mapped = assets.map((asset) => ({
      name: asset.name || 'Document',
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    }));
    setDocumentMap((current) => ({ ...current, bulk: [...(current.bulk ?? []), ...mapped] }));
    setMessage('');
  }

  async function submit() {
    if (!policy || !vehicle || saving) return;
    setMessage('');
    const accidentAt = parseIncident(date, time);
    if (!accidentAt) return setMessage('Enter a valid accident date and time.');
    if (accidentAt.getTime() > Date.now()) return setMessage('Accident date and time cannot be in the future.');
    setSaving(true);
    const { data, error } = await (supabase.rpc as any)('create_self_managed_external_claim', {
      p_customer_id: policy.customer_id,
      p_vehicle_id: policy.vehicle_id,
      p_external_policy_id: policy.id,
      p_accident_at: accidentAt.toISOString(),
      p_driver_name: driver.trim() || null,
      p_driver_phone: phone.trim() || null,
      p_location: location.trim() || null,
    });
    setSaving(false);
    if (error) return setMessage(error.message || 'We could not start claim tracking.');
    const created = Array.isArray(data) ? data[0] : data;
    if (created?.claim_id) router.replace({ pathname: '/customer/claim-detail', params: { id: created.claim_id } });
    else setMessage('The claim was not created. Please try again.');
  }

  if (loading) return <Screen title="Spot Intimation" brandHeaderVariant="navy"><LoadingState label="Opening policy" /></Screen>;
  return <Screen title="Spot Intimation" showTitleHeader={false} brandHeaderVariant="navy">
    <ClaimStageHeader step={1} icon={CLAIM_STAGE_ICON.spot_intimation} title="Spot Intimation" />
    <ClaimProgressRail step={1} />

    {message ? <Message type="error">{message}</Message> : null}

    <View style={styles.policyBanner}>
      <View style={styles.policyBannerIcon}><MaterialCommunityIcons name="file-document-outline" size={27} color="#0A43A3" /></View>
      <View style={styles.policyBannerCopy}>
        <Text style={styles.policyBannerLabel}>EXTERNAL POLICY</Text>
        <Text style={styles.policyBannerNumber}>{policy?.policy_no ?? '—'}</Text>
        <Text style={styles.policyBannerVehicle}>{vehicle?.vehicle_no ?? '—'}</Text>
      </View>
      <MaterialCommunityIcons name="shield-check" size={25} color="#16B86A" />
      <View style={styles.policyBannerRule} />
      <View style={styles.policyNotice}><MaterialCommunityIcons name="information-outline" size={17} color="#FFFFFF" /><Text style={styles.policyNoticeText}>This claim is being tracked by you. Sankalp is not processing this claim unless you request assistance.</Text></View>
    </View>

    <StageDetailsCard icon="clipboard-text-outline" title="Incident Details" subtitle="Accident date and time are required">
      <View style={styles.stepList}>
        <View style={styles.formRow}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
          <View style={styles.stepFieldWrap}>
            <View style={styles.dateTimeRow}>
              <View style={styles.inlineInput}><AppDatePicker label="Accident Date" required fullScreen value={date} onChange={setDate} maxDate={new Date().toISOString().slice(0, 10)} /></View>
              <View style={styles.inlineInputRight}><TimePickerField value={time} onPress={() => setTimePickerOpen(true)} compact /></View>
            </View>
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
          <View style={styles.stepFieldWrap}>
            <TextField label="Driver Name (Optional)" rightIcon="account-outline" value={driver} onChangeText={setDriver} placeholder="Enter Driver Name" />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
          <View style={styles.stepFieldWrap}>
            <TextField label="Driver Number (Optional)" rightIcon="phone-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Enter Driver Mobile Number" />
          </View>
        </View>

        <View style={styles.formRow}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>4</Text></View>
          <View style={styles.stepFieldWrap}>
            <TextField label="Location (Optional)" rightIcon="map-marker-outline" value={location} onChangeText={setLocation} placeholder="Enter Accident Location" />
          </View>
        </View>
      </View>
    </StageDetailsCard>

    <View style={styles.documentsShell}>
      <View style={styles.documentsHeader}><View><Text style={styles.documentsTitle}>UPLOAD DOCUMENTS (OPTIONAL)</Text><Text style={styles.documentsSubtitle}>Upload any documents you have. All are optional.</Text></View><View style={styles.optionalPill}><Text style={styles.optionalPillText}>All optional</Text></View></View>
      <View style={styles.uploadGrid}>
        {[
          { label: 'RC Copy', subtitle: 'Upload File', text: 'JPG, PNG, PDF (Max 5MB)' },
          { label: 'Insurance Copy', subtitle: 'Upload File', text: 'JPG, PNG, PDF (Max 5MB)' },
          { label: 'Driving License', subtitle: 'Upload File', text: 'JPG, PNG, PDF (Max 5MB)' },
          { label: 'GR Copy', subtitle: 'Upload File', text: 'JPG, PNG, PDF (Max 5MB)' },
        ].map((doc) => (
          <View key={doc.label} style={[styles.uploadTile, documentMap[doc.label]?.[0] && styles.uploadTileUploaded]}>
            {documentMap[doc.label]?.[0] ? (
              <View style={styles.uploadedBadge}><MaterialCommunityIcons name="check" size={11} color="#FFFFFF" /></View>
            ) : null}
            <Image source={documentArtwork[doc.label as keyof typeof documentArtwork]} resizeMode="contain" style={styles.documentArtwork} />
            <Text style={styles.uploadLabel} numberOfLines={2}>{doc.label}</Text>
            <View style={styles.uploadStack}>
              <Pressable style={styles.uploadButton} accessibilityRole="button" onPress={() => void pickDocument(doc.label)}>
                <Text style={styles.uploadButtonText}>{documentMap[doc.label]?.[0] ? 'Uploaded' : 'Upload'}</Text>
              </Pressable>
              {documentMap[doc.label]?.[0] ? (
                <Text style={styles.selectedFileText} numberOfLines={1}>{documentMap[doc.label]?.[0]?.name}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <Pressable style={styles.bulkUploadButton} accessibilityRole="button" onPress={() => void pickBulkDocuments()}>
        <MaterialCommunityIcons name="tray-arrow-up" size={20} color={palette.navy} />
        <View style={styles.bulkUploadCopy}><Text style={styles.bulkUploadText}>{documentMap.bulk?.length ? `Bulk Documents Upload (${documentMap.bulk.length})` : 'Bulk Documents Upload'}</Text><Text style={styles.bulkUploadSub}>Upload multiple documents at once</Text></View>
        <Text style={styles.bulkUploadTag}>New</Text>
        <MaterialCommunityIcons name="chevron-right" size={19} color={palette.navy} />
      </Pressable>
    </View>

    <StageSaveButton label="SUBMIT" savingLabel="Starting claim..." saving={saving} disabled={!policy} onPress={submit} />
    <TimePickerModal value={time} visible={timePickerOpen} onClose={() => setTimePickerOpen(false)} onSelect={(value) => { setTime(value); setTimePickerOpen(false); }} />
  </Screen>;
}

function SummaryFact({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={styles.summaryFact}>
    <View style={styles.summaryFactIcon}><MaterialCommunityIcons name={icon} size={16} color="#0A43A3" /></View>
    <View style={styles.summaryFactCopy}><Text style={styles.summaryFactLabel}>{label}</Text><Text style={styles.summaryFactValue} numberOfLines={1}>{value}</Text></View>
  </View>;
}

function TimePickerField({ value, onPress, compact = false }: { value: string; onPress: () => void; compact?: boolean }) {
  return <View style={[styles.timeField, compact && styles.timeFieldCompact]}>
    <Text style={styles.timeLabel}>Accident Time <Text style={styles.requiredStar}>*</Text></Text>
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.timeButton}>
      <MaterialCommunityIcons name="clock-outline" size={19} color="#0A43A3" />
      <Text style={[styles.timeValue, compact && styles.timeValueCompact, !value && styles.timePlaceholder, !value && styles.timeHint]}>{value || 'HH:MM'}</Text>
      <MaterialCommunityIcons name="chevron-down" size={21} color={palette.navy} />
    </Pressable>
  </View>;
}

function TimePickerModal({ value, visible, onClose, onSelect }: { value: string; visible: boolean; onClose: () => void; onSelect: (value: string) => void }) {
  const [hour, setHour] = useState(() => parseTime(value).hour);
  const [minute, setMinute] = useState(() => parseTime(value).minute);
  useEffect(() => {
    if (!visible) return;
    const parsed = parseTime(value);
    setHour(parsed.hour);
    setMinute(parsed.minute);
  }, [value, visible]);
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.timeModalBackdrop} onPress={onClose}>
      <Pressable style={styles.timeModalCard} onPress={(event) => event.stopPropagation()}>
        <View style={styles.timeModalHeader}><View><Text style={styles.timeModalEyebrow}>INCIDENT DETAILS</Text><Text style={styles.timeModalTitle}>Select accident time</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={styles.timeClose}><MaterialCommunityIcons name="close" size={21} color={palette.navy} /></Pressable></View>
        <View style={styles.timeColumns}>
          <TimeColumn label="Hour" value={hour} options={Array.from({ length: 24 }, (_, index) => index)} onSelect={setHour} />
          <Text style={styles.timeColon}>:</Text>
          <TimeColumn label="Minute" value={minute} options={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]} onSelect={setMinute} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => onSelect(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)} style={styles.timeDone}><Text style={styles.timeDoneText}>Use this time</Text><MaterialCommunityIcons name="check" size={19} color="#FFFFFF" /></Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}

function TimeColumn({ label, value, options, onSelect }: { label: string; value: number; options: number[]; onSelect: (value: number) => void }) {
  return <View style={styles.timeColumn}><Text style={styles.timeColumnLabel}>{label}</Text><View style={styles.timeOptions}>{options.map((option) => <Pressable key={option} accessibilityRole="button" onPress={() => onSelect(option)} style={[styles.timeOption, option === value && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, option === value && styles.timeOptionTextSelected]}>{String(option).padStart(2, '0')}</Text></Pressable>)}</View></View>;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: new Date().getHours(), minute: Math.floor(new Date().getMinutes() / 5) * 5 };
}

function parseIncident(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(time.trim())) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.trim().split(':').map(Number);
  const value = new Date(year, month - 1, day, hour, minute);
  return Number.isNaN(value.getTime()) ? null : value;
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F6', marginBottom: 14, padding: 12 },
  summaryEyebrow: { color: '#0A43A3', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 10 },
  summaryLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryFact: { width: '48%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 5 },
  summaryFactIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  summaryFactCopy: { flex: 1, minWidth: 0 },
  summaryFactLabel: { color: '#68778A', fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryFactValue: { color: palette.navy, fontSize: 11.5, fontWeight: '800', marginTop: 2 },
  policyBanner: { minHeight: 150, marginBottom: 14, borderRadius: 20, backgroundColor: '#0A43A3', padding: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  policyBannerIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  policyBannerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  policyBannerLabel: { color: '#C7DBF7', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  policyBannerNumber: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4 },
  policyBannerVehicle: { color: '#D8E8FB', fontSize: 11, fontWeight: '700', marginTop: 2 },
  policyBannerRule: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 12, marginBottom: 10 },
  policyNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, width: '100%' },
  policyNoticeText: { flex: 1, color: '#FFFFFF', fontSize: 10.5, lineHeight: 15, fontWeight: '600' },
  stepList: { padding: 12, gap: 14 },
  formRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepBadgeText: { color: '#0A43A3', fontSize: 10.5, fontWeight: '900' },
  stepFieldWrap: { flex: 1, minWidth: 0 },
  stepLabel: { color: '#3F4D63', fontSize: 10.5, fontWeight: '700', marginBottom: 6 },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  inlineInput: { flex: 1.2, minWidth: 0 },
  inlineInputRight: { flex: 0.8, minWidth: 0 },
  timeField: { gap: 7, marginBottom: 12 },
  timeFieldCompact: { marginBottom: 12 },
  timeLabel: { color: '#3F4D63', fontSize: 10.5, fontWeight: '700' },
  requiredStar: { color: '#D14343', fontWeight: '800' },
  timeButton: { minHeight: 50, borderRadius: 17, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FBFDFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeButtonCompact: { minHeight: 50 },
  timeValue: { flex: 1, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  timeHint: { fontSize: 10, fontWeight: '600' },
  selectedFileText: { color: '#0A43A3', fontSize: 10, fontWeight: '700', marginTop: 6, marginLeft: 8 },
  timeValueCompact: { fontSize: 15 },
  timePlaceholder: { color: '#8A94A6' },
  uploadList: { padding: 12, gap: 12 },
  documentsShell: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F6', marginBottom: 14, padding: 12 },
  documentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  documentsTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  documentsSubtitle: { color: '#6C7D91', fontSize: 9.5, fontWeight: '600', marginTop: 2 },
  optionalPill: { borderRadius: 999, backgroundColor: '#EAF3FF', paddingHorizontal: 9, paddingVertical: 6 },
  optionalPillText: { color: '#0A43A3', fontSize: 9, fontWeight: '800' },
  uploadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploadTile: { width: '48%', minHeight: 132, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F6', backgroundColor: '#FFFFFF', alignItems: 'center', padding: 8, position: 'relative' },
  uploadTileUploaded: { borderColor: '#9AD9B5', backgroundColor: '#EFFAF3' },
  uploadedBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#16B86A', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  documentArtwork: { width: 48, height: 48, marginBottom: 4 },
  uploadSub: { color: '#6C7D91', fontSize: 9, fontWeight: '600' },
  uploadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  uploadStack: { flex: 1, minWidth: 0 },
  uploadAction: { flex: 1, minWidth: 0 },
  uploadActionUploaded: {},
  uploadMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  uploadLabel: { color: palette.navy, fontSize: 11.5, fontWeight: '800' },
  uploadButton: { width: '82%', minHeight: 44, marginTop: 5, alignSelf: 'center', borderRadius: 11, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  uploadButtonText: { width: '100%', color: '#0A43A3', fontSize: 10.5, lineHeight: 14, fontWeight: '800', textAlign: 'center', includeFontPadding: false },
  bulkUploadButton: { marginTop: 16, marginHorizontal: 0, marginBottom: 2, borderWidth: 1, borderColor: '#D6E5F8', backgroundColor: '#F7FAFF', height: 58, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bulkUploadCopy: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 0, paddingVertical: 1 },
  bulkUploadText: { color: palette.navy, fontSize: 12, lineHeight: 13, fontWeight: '800', includeFontPadding: false },
  bulkUploadSub: { color: '#6C7D91', fontSize: 9, lineHeight: 10, fontWeight: '600', marginTop: 0, includeFontPadding: false },
  bulkUploadTag: { color: '#FFFFFF', backgroundColor: '#0A43A3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  timeModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 28, 62, 0.38)' },
  timeModalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  timeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  timeModalEyebrow: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  timeModalTitle: { color: palette.navy, fontSize: 19, fontWeight: '900', marginTop: 3 },
  timeClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  timeColumns: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 10 },
  timeColumn: { flex: 1, minWidth: 0 },
  timeColumnLabel: { color: '#667085', fontSize: 10, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  timeOption: { width: 48, height: 38, borderRadius: 10, backgroundColor: '#F5F8FC', alignItems: 'center', justifyContent: 'center' },
  timeOptionSelected: { backgroundColor: '#0A43A3' },
  timeOptionText: { color: '#56657A', fontSize: 12, fontWeight: '800' },
  timeOptionTextSelected: { color: '#FFFFFF' },
  timeColon: { color: palette.navy, fontSize: 23, fontWeight: '900', marginTop: 23 },
  timeDone: { minHeight: 48, marginTop: 18, borderRadius: 14, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  timeDoneText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  policyCard: { padding: 14, marginBottom: 10 },
  policyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  policyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1, minWidth: 0 },
  policyLabel: { color: '#0A43A3', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  policyNumber: { color: palette.navy, fontSize: 15, fontWeight: '900', marginTop: 2 },
  policyVehicle: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  noticeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, borderTopColor: '#E7EEF7', marginTop: 12, paddingTop: 11 },
  noticeText: { flex: 1, color: '#4F6380', fontSize: 10.3, lineHeight: 15, fontWeight: '600' },
  formCard: { padding: 14, marginBottom: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { color: palette.slate, fontSize: 10, fontWeight: '600', marginTop: 2 },
});
