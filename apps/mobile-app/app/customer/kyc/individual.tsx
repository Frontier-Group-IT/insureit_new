import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import {
  getCurrentSession,
  getOnboardingApplicationForUser,
  getOnboardingDocuments,
  getProfile,
  saveOnboardingDraft,
  submitIndividualOnboarding,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { CustomerOnboardingApplication, CustomerOnboardingDocument, IndiaLocation, Json, Profile } from '@/lib/types';

type DocumentType = CustomerOnboardingDocument['document_type'];
type FleetBand = 'less_than_5' | '5_to_20' | '20_to_50' | 'more_than_50';
type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };

const maxFileSize = 5 * 1024 * 1024;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const documentLabels: Record<DocumentType, string> = {
  pan_copy: 'PAN card',
  aadhaar_front: 'Aadhaar front',
  aadhaar_back: 'Aadhaar back',
  gst_copy: 'GST certificate',
};
const fleetOptions: { value: FleetBand; label: string }[] = [
  { value: 'less_than_5', label: 'Less than 5' },
  { value: '5_to_20', label: '5 to 20' },
  { value: '20_to_50', label: '20 to 50' },
  { value: 'more_than_50', label: 'More than 50' },
];

export default function IndividualKycScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<CustomerOnboardingApplication | null>(null);
  const [documents, setDocuments] = useState<CustomerOnboardingDocument[]>([]);
  const [files, setFiles] = useState<Partial<Record<DocumentType, PickedFile>>>({});
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressLocality, setAddressLocality] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [location, setLocation] = useState<IndiaLocation | null>(null);
  const [locationOptions, setLocationOptions] = useState<IndiaLocation[]>([]);
  const [legalTradeName, setLegalTradeName] = useState('');
  const [gstRegistered, setGstRegistered] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [fleetBand, setFleetBand] = useState<FleetBand | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [error, setError] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, nextApplication] = await Promise.all([
          getProfile(session.user.id),
          getOnboardingApplicationForUser(session.user.id),
        ]);
        if (!nextApplication || nextApplication.partner_type !== 'individual_proprietor') return router.replace('/customer/kyc/partner-type');
        if (nextApplication.status === 'submitted' || nextApplication.status === 'under_review') return router.replace('/customer/home');
        const nextDocuments = await getOnboardingDocuments(nextApplication.id);
        if (!active) return;
        const draft = asDraft(nextApplication.draft_data);
        setProfile(nextProfile);
        setApplication(nextApplication);
        setDocuments(nextDocuments);
        setFullName(textDraft(draft, 'contact_name') || nextProfile?.full_name || '');
        setEmail(textDraft(draft, 'email') || nextProfile?.email || session.user.email || '');
        setPanNumber(textDraft(draft, 'pan_number'));
        setAddressStreet(textDraft(draft, 'address_street'));
        setAddressLocality(textDraft(draft, 'address_locality'));
        setPostalCode(textDraft(draft, 'postal_code'));
        setLegalTradeName(textDraft(draft, 'legal_trade_name'));
        setGstRegistered(Boolean(draft.is_gst_registered));
        setGstNumber(textDraft(draft, 'gst_number'));
        const reviewNotes = textDraft(draft, 'review_notes');
        if (nextApplication.status === 'changes_requested' && reviewNotes) setError(`Please update your application: ${reviewNotes}`);
        const savedFleet = textDraft(draft, 'fleet_size_band');
        if (fleetOptions.some((option) => option.value === savedFleet)) setFleetBand(savedFleet as FleetBand);
        const locationId = textDraft(draft, 'india_location_id');
        if (locationId) {
          const result = await supabase.from('india_locations').select('*').eq('id', locationId).maybeSingle();
          if (active && result.data) setLocation(result.data);
        }
      } catch {
        if (active) setError('We could not open your KYC application. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (postalCode.length !== 6 || location?.pincode === postalCode) {
      setLocationOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLookingUpPin(true);
      const { data, error: lookupError } = await supabase.from('india_locations').select('*').eq('pincode', postalCode).order('city_name').limit(12);
      setLookingUpPin(false);
      if (lookupError) return setError('PIN code lookup is unavailable. Please try again.');
      const options = data ?? [];
      setLocationOptions(options);
      if (options.length === 1) {
        setLocation(options[0]);
        setLocationOptions([]);
        setError('');
      } else if (!options.length) setError('We could not find this PIN code. Check it and try again.');
    }, 300);
    return () => clearTimeout(timer);
  }, [location?.pincode, postalCode]);

  const phone = application?.applicant_phone ?? profile?.phone ?? '';
  const existingTypes = useMemo(() => new Set(documents.filter((item) => item.verification_status !== 'rejected').map((item) => item.document_type)), [documents]);

  function selectLocation(nextLocation: IndiaLocation) {
    setLocation(nextLocation);
    setPostalCode(nextLocation.pincode);
    setLocationOptions([]);
    setError('');
  }

  async function chooseFile(type: DocumentType) {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > maxFileSize) return setError(`${documentLabels[type]} must be 5 MB or smaller.`);
    setFiles((current) => ({
      ...current,
      [type]: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null },
    }));
  }

  function validate() {
    if (fullName.trim().length < 2) return 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
    if (!panPattern.test(panNumber)) return 'Enter a valid PAN number, for example ABCDE1234F.';
    if (!/^\d{12}$/.test(aadhaarNumber)) return 'Enter a valid 12-digit Aadhaar number.';
    if (!addressStreet.trim()) return 'Enter your complete street address.';
    if (!location || postalCode.length !== 6) return 'Enter the PIN code and select your city.';
    if (!fleetBand) return 'Select your fleet size.';
    if (gstRegistered && !legalTradeName.trim()) return 'Enter the legal trade name shown on the GST certificate.';
    if (gstRegistered && !gstPattern.test(gstNumber)) return 'Enter a valid 15-character GSTIN.';
    const required: DocumentType[] = ['pan_copy', 'aadhaar_front', 'aadhaar_back', ...(gstRegistered ? ['gst_copy' as const] : [])];
    const missing = required.find((type) => !files[type] && !existingTypes.has(type));
    if (missing) return `Attach ${documentLabels[missing]}.`;
    return '';
  }

  async function submit() {
    if (!application || submitting) return;
    const validationError = validate();
    if (validationError) return setError(validationError);
    if (!location || !fleetBand) return;
    setSubmitting(true);
    setError('');
    try {
      const draft: Json = {
        contact_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        pan_number: panNumber,
        address_street: addressStreet.trim(),
        address_locality: addressLocality.trim() || null,
        india_location_id: location.id,
        city: location.city_name,
        state: location.state_name,
        postal_code: location.pincode,
        legal_trade_name: legalTradeName.trim() || null,
        is_gst_registered: gstRegistered,
        gst_number: gstRegistered ? gstNumber : null,
        fleet_size_band: fleetBand,
      };
      await saveOnboardingDraft(application.id, draft, 3);
      let nextDocuments = documents;
      for (const [type, file] of Object.entries(files) as [DocumentType, PickedFile][]) {
        nextDocuments = await uploadDocument(application.id, type, file, nextDocuments);
      }
      setDocuments(nextDocuments);
      await submitIndividualOnboarding({
        applicationId: application.id,
        contactName: fullName.trim(),
        email: email.trim(),
        panNumber,
        aadhaarNumber,
        addressStreet: addressStreet.trim(),
        addressLocality: addressLocality.trim(),
        indiaLocationId: location.id,
        city: location.city_name,
        state: location.state_name,
        postalCode: location.pincode,
        legalTradeName: legalTradeName.trim(),
        isGstRegistered: gstRegistered,
        gstNumber,
        fleetSizeBand: fleetBand,
      });
      setAadhaarNumber('');
      setFiles({});
      setSuccessVisible(true);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : '';
      setError(message || 'Your KYC could not be submitted. Your saved details are still available.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><ActivityIndicator size="large" color="#0A43A3" /><Text style={styles.loadingText}>Preparing your KYC form</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/customer/kyc/partner-type')} style={styles.backButton}><MaterialCommunityIcons name="chevron-left" size={27} color={palette.navy} /></Pressable>
        <BrandLogo width={145} />
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Complete Your KYC</Text>
        <KycStepper />
        <View style={styles.partnerSummary}><View style={styles.partnerIcon}><MaterialCommunityIcons name="account-outline" size={21} color="#0A43A3" /></View><View style={styles.partnerCopy}><Text style={styles.partnerEyebrow}>Partner type</Text><Text style={styles.partnerTitle}>Individual / Proprietor</Text></View><MaterialCommunityIcons name="check-circle" size={21} color="#21A66B" /></View>

        {error ? <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View> : null}

        <FormSection number="1" title="Personal information" subtitle="Use details that match your identity documents.">
          <Field label="Full name" required value={fullName} onChangeText={setFullName} placeholder="Your full legal name" autoCapitalize="words" />
          <Field label="Mobile number" required value={phone} editable={false} icon="lock-outline" />
          <Field label="Email address" required value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="PAN number" required value={panNumber} onChangeText={(value) => setPanNumber(value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10))} placeholder="ABCDE1234F" autoCapitalize="characters" />
          <Field label="Aadhaar number" required value={aadhaarNumber} onChangeText={(value) => setAadhaarNumber(value.replace(/\D/g, '').slice(0, 12))} placeholder="12-digit Aadhaar number" keyboardType="number-pad" secureTextEntry />
          <Text style={styles.privacyNote}>Your Aadhaar number is verified during submission. Only a protected hash and the last four digits are retained.</Text>
        </FormSection>

        <FormSection number="2" title="Address" subtitle="Choose a valid PIN code so the portal receives structured location data.">
          <Field label="Street address" required value={addressStreet} onChangeText={setAddressStreet} placeholder="House, building, street" multiline />
          <Field label="Locality / landmark" value={addressLocality} onChangeText={setAddressLocality} placeholder="Area or nearby landmark" />
          <Field label="PIN code" required value={postalCode} onChangeText={(value) => { setPostalCode(value.replace(/\D/g, '').slice(0, 6)); setLocation(null); }} placeholder="6-digit PIN code" keyboardType="number-pad" trailing={lookingUpPin ? <ActivityIndicator size="small" color="#0A43A3" /> : undefined} />
          {locationOptions.length ? <View style={styles.locationList}>{locationOptions.map((option) => <Pressable key={option.id} onPress={() => selectLocation(option)} style={styles.locationOption}><View><Text style={styles.locationCity}>{option.city_name}</Text><Text style={styles.locationMeta}>{option.district}, {option.state_name}</Text></View><MaterialCommunityIcons name="chevron-right" size={19} color="#728197" /></Pressable>)}</View> : null}
          <View style={styles.locationRow}><ReadOnlyField label="City" value={location?.city_name ?? ''} /><ReadOnlyField label="State" value={location?.state_name ?? ''} /></View>
        </FormSection>

        <FormSection number="3" title="Business details" subtitle="Tell us about your fleet and GST registration.">
          <Text style={styles.fieldLabel}>Fleet size <Text style={styles.required}>*</Text></Text>
          <View style={styles.choiceGrid}>{fleetOptions.map((option) => <Pressable key={option.value} onPress={() => setFleetBand(option.value)} style={[styles.choice, fleetBand === option.value && styles.choiceActive]}><Text style={[styles.choiceText, fleetBand === option.value && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View>
          <View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchTitle}>GST registered</Text><Text style={styles.switchSub}>Enable this if you have an active GSTIN.</Text></View><Switch value={gstRegistered} onValueChange={setGstRegistered} trackColor={{ false: '#D4DDE8', true: '#8BCDB8' }} thumbColor={gstRegistered ? '#0F9F6E' : '#FFFFFF'} /></View>
          {gstRegistered ? <><Field label="Legal trade name" required value={legalTradeName} onChangeText={setLegalTradeName} placeholder="Name shown on GST certificate" autoCapitalize="words" /><Field label="GSTIN" required value={gstNumber} onChangeText={(value) => setGstNumber(value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 15))} placeholder="15-character GSTIN" autoCapitalize="characters" /></> : null}
        </FormSection>

        <FormSection number="4" title="Documents" subtitle="PDF, JPG or PNG. Maximum 5 MB per file.">
          <DocumentField type="pan_copy" file={files.pan_copy} existing={existingTypes.has('pan_copy')} onPress={() => void chooseFile('pan_copy')} />
          <View style={styles.aadhaarPair}><View style={styles.documentHalf}><DocumentField type="aadhaar_front" file={files.aadhaar_front} existing={existingTypes.has('aadhaar_front')} onPress={() => void chooseFile('aadhaar_front')} compact /></View><View style={styles.documentHalf}><DocumentField type="aadhaar_back" file={files.aadhaar_back} existing={existingTypes.has('aadhaar_back')} onPress={() => void chooseFile('aadhaar_back')} compact /></View></View>
          {gstRegistered ? <DocumentField type="gst_copy" file={files.gst_copy} existing={existingTypes.has('gst_copy')} onPress={() => void chooseFile('gst_copy')} /> : null}
        </FormSection>

        <View style={styles.consent}><MaterialCommunityIcons name="shield-lock-outline" size={20} color="#0F8060" /><Text style={styles.consentText}>Your information is encrypted in transit and will be reviewed only for onboarding and compliance.</Text></View>
      </ScrollView>
      <View style={styles.footer}><Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={[styles.submitButton, submitting && styles.submitDisabled]}>{submitting ? <><ActivityIndicator color="#FFFFFF" /><Text style={styles.submitText}>Submitting securely</Text></> : <><Text style={styles.submitText}>Review & Submit</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></>}</Pressable></View>
      <SuccessModal visible={successVisible} onDone={() => router.replace('/customer/home')} />
    </SafeAreaView>
  );
}

async function uploadDocument(applicationId: string, type: DocumentType, file: PickedFile, currentDocuments: CustomerOnboardingDocument[]) {
  const session = await getCurrentSession();
  if (!session?.user) throw new Error('Your session expired. Please sign in again.');
  const response = await fetch(file.uri);
  const body = await response.arrayBuffer();
  if (body.byteLength > maxFileSize) throw new Error(`${documentLabels[type]} must be 5 MB or smaller.`);
  const extension = safeExtension(file);
  const storagePath = `${applicationId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const upload = await supabase.storage.from('customer-documents').upload(storagePath, body, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
  if (upload.error) throw new Error(`${documentLabels[type]} could not be uploaded.`);
  const existing = currentDocuments.find((item) => item.document_type === type);
  const { data, error } = await supabase.from('customer_onboarding_documents').upsert({
    application_id: applicationId,
    document_type: type,
    file_name: file.name,
    storage_bucket: 'customer-documents',
    storage_path: storagePath,
    mime_type: file.mimeType,
    file_size: file.size ?? body.byteLength,
    verification_status: 'pending',
    rejection_reason: null,
    uploaded_by: session.user.id,
    verified_by: null,
    verified_at: null,
  }, { onConflict: 'application_id,document_type' }).select('*').single();
  if (error || !data) {
    await supabase.storage.from('customer-documents').remove([storagePath]);
    throw new Error(`${documentLabels[type]} record could not be saved.`);
  }
  if (existing?.storage_path && existing.storage_path !== storagePath) await supabase.storage.from('customer-documents').remove([existing.storage_path]);
  return [data, ...currentDocuments.filter((item) => item.document_type !== type)];
}

function KycStepper() {
  return <View style={styles.stepper}>{['Partner', 'Details', 'Documents', 'Review'].map((label, index) => <View key={label} style={styles.stepItem}><View style={[styles.stepCircle, index <= 2 && styles.stepActive]}>{index === 0 ? <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" /> : <Text style={[styles.stepNumber, index <= 2 && styles.stepNumberActive]}>{index + 1}</Text>}</View><Text style={[styles.stepLabel, index <= 2 && styles.stepLabelActive]}>{label}</Text>{index < 3 ? <View style={[styles.stepLine, index < 2 && styles.stepLineActive]} /> : null}</View>)}</View>;
}

function FormSection({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionNumber}><Text style={styles.sectionNumberText}>{number}</Text></View><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View></View><View style={styles.sectionBody}>{children}</View></View>;
}

function Field({ label, required, icon, trailing, ...props }: React.ComponentProps<typeof TextInput> & { label: string; required?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap; trailing?: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text><View style={[styles.inputShell, props.multiline && styles.inputShellMultiline, props.editable === false && styles.inputDisabled]}><TextInput placeholderTextColor="#9AA7B7" style={[styles.input, props.multiline && styles.inputMultiline]} {...props} />{icon ? <MaterialCommunityIcons name={icon} size={17} color="#8492A5" /> : null}{trailing}</View></View>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) { return <View style={styles.readOnlyField}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.readOnlyShell}><Text numberOfLines={1} style={[styles.readOnlyText, !value && styles.readOnlyPlaceholder]}>{value || 'Select PIN first'}</Text></View></View>; }

function DocumentField({ type, file, existing, onPress, compact = false }: { type: DocumentType; file?: PickedFile; existing: boolean; onPress: () => void; compact?: boolean }) {
  const ready = Boolean(file || existing);
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.documentField, compact && styles.documentFieldCompact, ready && styles.documentReady]}><View style={[styles.documentIcon, ready && styles.documentIconReady]}><MaterialCommunityIcons name={ready ? 'check' : 'cloud-upload-outline'} size={21} color={ready ? '#FFFFFF' : '#0A43A3'} /></View><View style={styles.documentCopy}><Text style={styles.documentTitle}>{documentLabels[type]} <Text style={styles.required}>*</Text></Text><Text numberOfLines={1} style={styles.documentMeta}>{file?.name ?? (existing ? 'Uploaded - tap to replace' : 'Tap to choose file')}</Text></View></Pressable>;
}

function SuccessModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}><View style={styles.successBackdrop}><View style={styles.successCard}><View style={styles.successHalo}><View style={styles.successIcon}><MaterialCommunityIcons name="check" size={45} color="#FFFFFF" /></View></View><Text style={styles.successTitle}>KYC submitted</Text><Text style={styles.successBody}>Thank you. Your details and documents are now queued for verification. We will notify you when your customer profile is activated.</Text><View style={styles.successStatus}><View style={styles.statusDot} /><Text style={styles.successStatusText}>Verification pending</Text></View><Pressable accessibilityRole="button" onPress={onDone} style={styles.doneButton}><Text style={styles.doneText}>Back to dashboard</Text></Pressable></View></View></Modal>;
}

function asDraft(value: Json): Record<string, Json | undefined> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : {}; }
function textDraft(draft: Record<string, Json | undefined>, key: string) { return typeof draft[key] === 'string' ? draft[key] as string : ''; }
function safeExtension(file: PickedFile) { if (file.mimeType === 'application/pdf') return 'pdf'; if (file.mimeType === 'image/png') return 'png'; return 'jpg'; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F8FC' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: '#5E6D80', fontSize: 13 },
  header: { height: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DFE6EF' },
  backButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D7E1EC', alignItems: 'center', justifyContent: 'center' }, headerSpacer: { width: 42 },
  content: { paddingHorizontal: 15, paddingTop: 16, paddingBottom: 28 }, screenTitle: { color: palette.navy, fontSize: 21, fontWeight: '800' },
  stepper: { flexDirection: 'row', marginTop: 19, marginBottom: 20 }, stepItem: { flex: 1, alignItems: 'center', position: 'relative' }, stepCircle: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', zIndex: 2 }, stepActive: { backgroundColor: '#0A3B8F', borderColor: '#0A3B8F' }, stepNumber: { color: '#8491A3', fontSize: 12, fontWeight: '700' }, stepNumberActive: { color: '#FFFFFF' }, stepLabel: { marginTop: 6, color: '#8793A4', fontSize: 9.5 }, stepLabelActive: { color: palette.navy, fontWeight: '700' }, stepLine: { position: 'absolute', left: '66%', top: 15, width: '68%', height: 2, backgroundColor: '#D9E1EA' }, stepLineActive: { backgroundColor: '#7FA8E3' },
  partnerSummary: { minHeight: 66, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E4F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 }, partnerIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' }, partnerCopy: { flex: 1 }, partnerEyebrow: { color: '#708096', fontSize: 9.5, textTransform: 'uppercase' }, partnerTitle: { color: palette.navy, fontSize: 14, fontWeight: '700', marginTop: 2 },
  errorBox: { borderRadius: 12, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', padding: 11, flexDirection: 'row', gap: 8, marginBottom: 12 }, errorText: { flex: 1, color: '#B42318', fontSize: 11.5, lineHeight: 16 },
  section: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5EF', marginBottom: 12, overflow: 'hidden', shadowColor: '#102A4C', shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 }, sectionHeader: { minHeight: 64, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FBFDFF', borderBottomWidth: 1, borderBottomColor: '#E7EDF4' }, sectionNumber: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#0A3B8F', alignItems: 'center', justifyContent: 'center' }, sectionNumberText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, sectionHeading: { flex: 1 }, sectionTitle: { color: palette.navy, fontSize: 15, fontWeight: '800' }, sectionSubtitle: { color: '#6D7B8D', fontSize: 10.5, lineHeight: 14, marginTop: 2 }, sectionBody: { padding: 13 },
  field: { marginBottom: 13 }, fieldLabel: { color: '#344054', fontSize: 11.5, fontWeight: '700', marginBottom: 6 }, required: { color: '#D92D20' }, inputShell: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, inputShellMultiline: { minHeight: 82, alignItems: 'flex-start' }, inputDisabled: { backgroundColor: '#F3F6FA' }, input: { flex: 1, minHeight: 48, color: '#172033', fontSize: 13.5, fontWeight: '400' }, inputMultiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' }, privacyNote: { color: '#557067', fontSize: 9.8, lineHeight: 14, backgroundColor: '#F0FAF6', borderRadius: 9, padding: 9, marginTop: -4 },
  locationList: { borderRadius: 12, borderWidth: 1, borderColor: '#D9E3EE', marginTop: -8, marginBottom: 13, overflow: 'hidden' }, locationOption: { minHeight: 52, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E9EEF4' }, locationCity: { color: palette.navy, fontSize: 12.5, fontWeight: '700' }, locationMeta: { color: '#6D7A8B', fontSize: 9.8, marginTop: 2 }, locationRow: { flexDirection: 'row', gap: 9 }, readOnlyField: { flex: 1 }, readOnlyShell: { minHeight: 47, borderRadius: 11, backgroundColor: '#F3F6FA', borderWidth: 1, borderColor: '#E0E6EE', paddingHorizontal: 10, justifyContent: 'center' }, readOnlyText: { color: '#344054', fontSize: 11.5 }, readOnlyPlaceholder: { color: '#9AA6B5' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }, choice: { width: '48.5%', minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#D9E2EC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, choiceActive: { borderColor: '#0A43A3', backgroundColor: '#ECF4FF' }, choiceText: { color: '#5F6E81', fontSize: 11.5, fontWeight: '600' }, choiceTextActive: { color: '#0A43A3', fontWeight: '800' }, switchRow: { minHeight: 61, borderRadius: 12, backgroundColor: '#F7FAFD', borderWidth: 1, borderColor: '#E1E7EF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 13 }, switchCopy: { flex: 1 }, switchTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '700' }, switchSub: { color: '#708095', fontSize: 9.7, marginTop: 2 },
  documentField: { minHeight: 67, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#AFC7E2', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, documentFieldCompact: { minHeight: 92, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }, documentReady: { borderStyle: 'solid', borderColor: '#9BD7C1', backgroundColor: '#F2FBF7' }, documentIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#E7F1FF', alignItems: 'center', justifyContent: 'center' }, documentIconReady: { backgroundColor: '#18A572' }, documentCopy: { flex: 1, minWidth: 0 }, documentTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '700' }, documentMeta: { color: '#718095', fontSize: 9.5, marginTop: 3 }, aadhaarPair: { flexDirection: 'row', gap: 9 }, documentHalf: { flex: 1 },
  consent: { borderRadius: 13, backgroundColor: '#EFF9F5', borderWidth: 1, borderColor: '#CDEADF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, consentText: { flex: 1, color: '#426459', fontSize: 10.2, lineHeight: 15 },
  footer: { paddingHorizontal: 15, paddingTop: 10, paddingBottom: 11, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#DFE6EF' }, submitButton: { minHeight: 53, borderRadius: 12, backgroundColor: '#0A3B8F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, submitDisabled: { opacity: 0.7 }, submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  successBackdrop: { flex: 1, backgroundColor: 'rgba(8,18,35,0.68)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }, successCard: { width: '100%', maxWidth: 390, borderRadius: 21, backgroundColor: '#FFFFFF', paddingHorizontal: 23, paddingTop: 27, paddingBottom: 20, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 }, successHalo: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#EAF9F2', alignItems: 'center', justifyContent: 'center' }, successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#28B779', alignItems: 'center', justifyContent: 'center', shadowColor: '#28B779', shadowOpacity: 0.25, shadowRadius: 14, elevation: 4 }, successTitle: { color: palette.navy, fontSize: 21, fontWeight: '800', marginTop: 18 }, successBody: { color: '#536276', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 }, successStatus: { marginTop: 15, borderRadius: 99, backgroundColor: '#FFF7E8', paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7 }, statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D99316' }, successStatusText: { color: '#855A13', fontSize: 10.5, fontWeight: '700' }, doneButton: { width: '100%', minHeight: 51, borderRadius: 12, backgroundColor: '#0A3B8F', alignItems: 'center', justifyContent: 'center', marginTop: 19 }, doneText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
});
