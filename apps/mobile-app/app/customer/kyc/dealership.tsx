import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { ensureCustomerOnboardingForPartner, getCurrentSession, getOnboardingDocuments, getProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { CustomerOnboardingApplication, CustomerOnboardingDocument, IndiaLocation, Json } from '@/lib/types';

type DealershipType = 'posp' | 'misp';
type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };
type FileKey = 'gst_copy' | 'representative_aadhaar_front' | 'representative_aadhaar_back' | 'representative_pan_copy';
type FileMap = Partial<Record<FileKey, PickedFile>>;

const maxFileSize = 5 * 1024 * 1024;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const salesOptions = [['less_than_500', 'Less than 500'], ['500_to_1000', '500 to 1000'], ['more_than_1000', 'More than 1000']] as const;

export default function DealershipKycScreen() {
  const router = useRouter();
  const [application, setApplication] = useState<CustomerOnboardingApplication | null>(null);
  const [documents, setDocuments] = useState<CustomerOnboardingDocument[]>([]);
  const [dealershipType, setDealershipType] = useState<DealershipType>('posp');
  const [dealershipName, setDealershipName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [locality, setLocality] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<IndiaLocation | null>(null);
  const [locationOptions, setLocationOptions] = useState<IndiaLocation[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationSearched, setLocationSearched] = useState(false);
  const [oemName, setOemName] = useState('');
  const [oemQuery, setOemQuery] = useState('');
  const [oemOpen, setOemOpen] = useState(false);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [yearlySalesBand, setYearlySalesBand] = useState('');
  const [yearlySalesOpen, setYearlySalesOpen] = useState(false);
  const [gstRegistered, setGstRegistered] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeMobile, setRepresentativeMobile] = useState('');
  const [representativeEmail, setRepresentativeEmail] = useState('');
  const [representativeAadhaar, setRepresentativeAadhaar] = useState('');
  const [representativePan, setRepresentativePan] = useState('');
  const [files, setFiles] = useState<FileMap>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const [nextProfile, nextApplication, manufacturerResult] = await Promise.all([
          getProfile(session.user.id),
          ensureCustomerOnboardingForPartner(session.user, 'dealership'),
          supabase.from('vehicle_manufacturers').select('name').eq('is_active', true).order('sort_order', { ascending: true }).order('name', { ascending: true }),
        ]);
        if (['submitted', 'under_review'].includes(nextApplication.status)) return router.replace('/customer/home');
        if (nextApplication.partner_type !== 'dealership') {
          if (active) setError('Your Dealership KYC could not be opened. Go back and choose the partner type again.');
          return;
        }
        const nextDocuments = await getOnboardingDocuments(nextApplication.id);
        if (!active) return;
        const draft = asDraft(nextApplication.draft_data);
        setApplication(nextApplication);
        setDocuments(nextDocuments);
        setDealershipType(textDraft(draft, 'dealership_type') === 'misp' ? 'misp' : 'posp');
        setDealershipName(textDraft(draft, 'dealership_name'));
        setOwnerName(textDraft(draft, 'owner_name') || nextProfile?.full_name || '');
        setPhone(normalizeMobile(textDraft(draft, 'phone') || nextProfile?.phone || session.user.phone || ''));
        setEmail(textDraft(draft, 'email') || nextProfile?.email || session.user.email || '');
        setStreet(textDraft(draft, 'address_street'));
        setLocality(textDraft(draft, 'address_locality'));
        const draftOem = textDraft(draft, 'oem_name');
        setOemName(draftOem);
        setOemQuery(draftOem);
        setManufacturers((manufacturerResult.data ?? []).map((item) => item.name).filter(Boolean));
        setYearlySalesBand(textDraft(draft, 'yearly_sales_band'));
        setGstRegistered(draft.is_gst_registered === true);
        setGstNumber(textDraft(draft, 'gst_number'));
        setRepresentativeName(textDraft(draft, 'representative_name'));
        setRepresentativeMobile(normalizeMobile(textDraft(draft, 'representative_mobile')));
        setRepresentativeEmail(textDraft(draft, 'representative_email'));
        setRepresentativePan(textDraft(draft, 'representative_pan'));
        const locationId = textDraft(draft, 'india_location_id');
        if (locationId) {
          const locationResult = await supabase.from('india_locations').select('*').eq('id', locationId).maybeSingle();
          if (locationResult.data && active) {
            setSelectedLocation(locationResult.data);
            setLocationQuery(locationResult.data.city_name);
          }
        }
      } catch {
        if (active) setError('We could not open Dealership KYC. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    const query = locationQuery.trim().replace(/[^a-zA-Z\s.'-]/g, '');
    if (query.length < 2 || (selectedLocation && query.toLowerCase() === selectedLocation.city_name.toLowerCase())) {
      setLocationOptions([]);
      setLocationSearching(false);
      setLocationSearched(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLocationSearching(true);
      setLocationSearched(false);
      const result = await supabase.from('india_locations').select('*').ilike('city_name', `%${query}%`).order('city_name').order('state_name').limit(15);
      if (!active) return;
      setLocationSearching(false);
      setLocationSearched(true);
      if (result.error) {
        setLocationOptions([]);
        setError('City search is temporarily unavailable. Please try again.');
        return;
      }
      setError('');
      setLocationOptions(result.data ?? []);
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [locationQuery, selectedLocation]);

  async function chooseFile(key: FileKey) {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > maxFileSize) return setError('Each file must be 5 MB or smaller.');
    setFiles((current) => ({ ...current, [key]: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null } }));
  }

  function chooseLocation(location: IndiaLocation) {
    setSelectedLocation(location);
    setLocationQuery(location.city_name);
    setLocationOptions([]);
    setLocationSearched(false);
  }

  function validate() {
    if (!dealershipName.trim()) return 'Enter dealership name.';
    if (!ownerName.trim()) return 'Enter owner name.';
    if (!/^\d{10}$/.test(phone)) return 'Enter a valid dealership mobile number.';
    if (!selectedLocation || !street.trim()) return 'Complete address and select city from the list.';
    if (!oemName.trim()) return 'Enter dealership OEM.';
    if (!yearlySalesBand) return 'Select yearly sales.';
    if (gstRegistered && !gstPattern.test(gstNumber)) return 'Enter a valid GSTIN.';
    if (!representativeName.trim()) return 'Enter representative name.';
    if (!/^\d{10}$/.test(representativeMobile)) return 'Enter a valid representative mobile number.';
    if (!/^\d{12}$/.test(representativeAadhaar)) return 'Enter a valid 12-digit representative Aadhaar.';
    if (!panPattern.test(representativePan)) return 'Enter a valid representative PAN.';
    const existing = new Set<string>(documents.filter((item) => item.verification_status !== 'rejected').map((item) => String(item.document_type)));
    if (!files.representative_aadhaar_front && !existing.has('representative_aadhaar_front')) return 'Attach Aadhaar front.';
    if (!files.representative_aadhaar_back && !existing.has('representative_aadhaar_back')) return 'Attach Aadhaar back.';
    if (!files.representative_pan_copy && !existing.has('representative_pan_copy')) return 'Attach PAN copy.';
    if (gstRegistered && !files.gst_copy && !existing.has('gst_copy')) return 'Attach GST certificate.';
    return '';
  }

  async function submit() {
    if (!application || !selectedLocation || submitting) return;
    const issue = validate();
    if (issue) return setError(issue);
    setSubmitting(true);
    setError('');
    try {
      const draft: Json = {
        dealership_type: dealershipType,
        dealership_name: dealershipName.trim(),
        owner_name: ownerName.trim(),
        phone,
        email: email.trim().toLowerCase() || null,
        address_street: street.trim(),
        address_locality: locality.trim() || null,
        india_location_id: selectedLocation.id,
        city: selectedLocation.city_name,
        state: selectedLocation.state_name,
        postal_code: selectedLocation.pincode,
        oem_name: oemName.trim(),
        yearly_sales_band: yearlySalesBand,
        is_gst_registered: gstRegistered,
        gst_number: gstRegistered ? gstNumber : null,
        representative_name: representativeName.trim(),
        representative_mobile: representativeMobile,
        representative_email: representativeEmail.trim().toLowerCase() || null,
        representative_aadhaar: representativeAadhaar,
        representative_pan: representativePan,
      };
      for (const [documentType, file] of Object.entries(files)) if (file) await uploadDocument(application.id, documentType, file);
      const submitted = await (supabase.rpc as any)('submit_dealership_onboarding_application', { p_application_id: application.id, p_draft_data: draft });
      if (submitted.error) throw new Error(submitted.error.message || 'Dealership KYC could not be submitted.');
      setSuccessVisible(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Dealership KYC could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator size="large" color="#0A43A3" /><Text>Preparing Dealership KYC</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={() => router.replace('/customer/kyc/partner-type')} style={styles.back}><MaterialCommunityIcons name="chevron-left" size={27} color={palette.navy} /></Pressable><BrandLogo width={145} /><View style={{ width: 42 }} /></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <Text style={styles.title}>Dealership KYC</Text>
      
      <Section title="Dealership type"><View style={styles.choiceGrid}><Choice active={dealershipType === 'posp'} label="POSP" onPress={() => setDealershipType('posp')} /><Choice active={dealershipType === 'misp'} label="MISP" onPress={() => setDealershipType('misp')} /></View></Section>
      <Section title="Dealership details"><Field label="Dealership name" value={dealershipName} onChangeText={setDealershipName} /><Field label="Owner name" value={ownerName} onChangeText={setOwnerName} /><Field label="Mobile number" value={phone} onChangeText={(value) => setPhone(normalizeMobile(value))} keyboardType="phone-pad" /><Field label="Email optional" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /></Section>
      <Section title="Address & business profile"><Field label="Street" value={street} onChangeText={setStreet} /><Field label="Locality" value={locality} onChangeText={setLocality} /><LocationField query={locationQuery} selected={selectedLocation} options={locationOptions} searching={locationSearching} searched={locationSearched} onChange={(value) => { setLocationQuery(value); setSelectedLocation(null); }} onSelect={chooseLocation} /><OemSelector manufacturers={manufacturers} selectedOem={oemName} query={oemQuery} open={oemOpen} onOpenChange={setOemOpen} onQueryChange={(value) => { setOemQuery(value); setOemName(value); setOemOpen(true); }} onSelect={(value) => { setOemName(value); setOemQuery(value); setOemOpen(false); }} /><OptionDropdown label="Yearly sales" value={yearlySalesBand} options={salesOptions} open={yearlySalesOpen} onToggle={() => setYearlySalesOpen((value) => !value)} onSelect={(value) => { setYearlySalesBand(value); setYearlySalesOpen(false); }} /></Section>
      <Section title="GST details"><View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.label}>GST registered</Text><Text style={styles.hint}>Enable when GST applies.</Text></View><Switch value={gstRegistered} onValueChange={setGstRegistered} /></View>{gstRegistered ? <><Field label="GSTIN" value={gstNumber} onChangeText={(value) => setGstNumber(value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 15))} /><DocumentField label="GST certificate" file={files.gst_copy?.name} onPress={() => void chooseFile('gst_copy')} /></> : null}</Section>
      <Section title={`${dealershipType === 'posp' ? 'POSP' : 'DP'} representative`}><Field label="Full name" value={representativeName} onChangeText={setRepresentativeName} /><Field label="Mobile number" value={representativeMobile} onChangeText={(value) => setRepresentativeMobile(normalizeMobile(value))} keyboardType="phone-pad" /><Field label="Email optional" value={representativeEmail} onChangeText={setRepresentativeEmail} keyboardType="email-address" autoCapitalize="none" /><Field label="Aadhaar number" value={representativeAadhaar} onChangeText={(value) => setRepresentativeAadhaar(value.replace(/\D/g, '').slice(0, 12))} keyboardType="number-pad" /><Field label="PAN number" value={representativePan} onChangeText={(value) => setRepresentativePan(normalizePan(value))} autoCapitalize="none" autoCorrect={false} /><DocumentField label="Aadhaar front" file={files.representative_aadhaar_front?.name} onPress={() => void chooseFile('representative_aadhaar_front')} /><DocumentField label="Aadhaar back" file={files.representative_aadhaar_back?.name} onPress={() => void chooseFile('representative_aadhaar_back')} /><DocumentField label="PAN copy" file={files.representative_pan_copy?.name} onPress={() => void chooseFile('representative_pan_copy')} /></Section>
    </ScrollView>
    <View style={styles.footer}>{error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}<Pressable disabled={submitting} onPress={() => void submit()} style={[styles.submit, submitting && styles.disabled]}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Dealership KYC</Text>}</Pressable></View>
    </KeyboardAvoidingView>
    <Modal visible={successVisible} transparent animationType="fade"><View style={styles.modalBackdrop}>{dealershipType === 'posp' ? <PospSuccessModal onDone={() => router.replace('/customer/home')} /> : <View style={styles.modal}><Text style={styles.modalTitle}>KYC submitted</Text><Text style={styles.modalText}>Your Dealership details have been submitted for verification.</Text><Pressable onPress={() => router.replace('/customer/home')} style={styles.modalButton}><Text style={styles.submitText}>Return to dashboard</Text></Pressable></View>}</View></Modal>
  </SafeAreaView>;
}

async function uploadDocument(applicationId: string, type: string, file: PickedFile) {
  const session = await getCurrentSession();
  if (!session?.user) throw new Error('Sign in again.');
  const response = await fetch(file.uri);
  const bytes = await response.arrayBuffer();
  const extension = file.mimeType === 'application/pdf' ? 'pdf' : file.mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${applicationId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const upload = await supabase.storage.from('customer-documents').upload(path, bytes, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
  if (upload.error) throw upload.error;
  const record = await supabase.from('customer_onboarding_documents').upsert({ application_id: applicationId, document_type: type, file_name: file.name, storage_bucket: 'customer-documents', storage_path: path, mime_type: file.mimeType, file_size: file.size, verification_status: 'pending', uploaded_by: session.user.id }, { onConflict: 'application_id,document_type' });
  if (record.error) { await supabase.storage.from('customer-documents').remove([path]); throw record.error; }
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.card}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { label, ...rest } = props; return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...rest} placeholderTextColor="#9AA7B8" style={styles.input} /></View>; }
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></Pressable>; }
function DocumentField({ label, file, onPress }: { label: string; file?: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.file, file && styles.fileReady]}><MaterialCommunityIcons name={file ? 'check-circle' : 'cloud-upload-outline'} size={20} color={file ? '#12805C' : '#0A43A3'} /><View style={{ flex: 1 }}><Text style={styles.fileTitle}>{label}</Text><Text style={styles.fileMeta} numberOfLines={1}>{file || 'Tap to choose PDF, JPG or PNG'}</Text></View></Pressable>; }
function LocationField({ query, selected, options, searching, searched, onChange, onSelect }: { query: string; selected: IndiaLocation | null; options: IndiaLocation[]; searching: boolean; searched: boolean; onChange: (value: string) => void; onSelect: (location: IndiaLocation) => void }) { return <View style={styles.field}><Text style={styles.label}>City</Text><View style={[styles.locationShell, selected && styles.locationSelected]}><TextInput value={query} onChangeText={onChange} placeholder="Enter at least 2 letters" placeholderTextColor="#9AA7B8" style={styles.locationInput} />{searching ? <ActivityIndicator size="small" color="#0A43A3" /> : <MaterialCommunityIcons name={selected ? 'check-circle' : 'magnify'} size={19} color={selected ? '#12805C' : '#607089'} />}</View>{options.length ? <View style={styles.locationList}>{options.map((item) => <Pressable key={item.id} onPress={() => onSelect(item)} style={styles.locationOption}><View style={{ flex: 1 }}><Text style={styles.locationCity}>{item.city_name}</Text><Text style={styles.locationMeta}>{[item.district, item.state_name, item.pincode].filter(Boolean).join(' - ')}</Text></View><MaterialCommunityIcons name="chevron-right" size={19} color="#728197" /></Pressable>)}</View> : null}{searched && !searching && !selected && query.trim().length >= 2 && !options.length ? <Text style={styles.locationEmpty}>No matching city found.</Text> : null}{selected ? <Text style={styles.selectedLocation}>{selected.city_name}, {selected.state_name} - {selected.pincode}</Text> : null}</View>; }
function OptionDropdown({ label, value, options, open, onToggle, onSelect }: { label: string; value: string; options: readonly (readonly [string, string])[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void }) { const selected = options.find(([option]) => option === value); return <View style={styles.field}><Text style={styles.label}>{label}</Text><Pressable onPress={onToggle} style={styles.dropdownButton}><Text style={styles.dropdownValue}>{selected?.[1] || 'Select'}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={palette.navy} /></Pressable>{open ? <View style={styles.dropdownMenu}>{options.map(([option, optionLabel]) => <Pressable key={option} onPress={() => onSelect(option)} style={[styles.dropdownItem, value === option && styles.dropdownItemActive]}><Text style={[styles.dropdownItemText, value === option && styles.dropdownItemTextActive]}>{optionLabel}</Text>{value === option ? <MaterialCommunityIcons name="check-circle" size={18} color={palette.navy} /> : null}</Pressable>)}</View> : null}</View>; }
function OemSelector({ manufacturers, selectedOem, query, open, onOpenChange, onQueryChange, onSelect }: { manufacturers: string[]; selectedOem: string; query: string; open: boolean; onOpenChange: (open: boolean) => void; onQueryChange: (value: string) => void; onSelect: (value: string) => void }) {
  const visible = manufacturers.filter((manufacturer) => !query.trim() || manufacturer.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  return <View style={styles.field}><Text style={styles.label}>Dealership OEM</Text><View style={styles.oemBox}><Pressable onPress={() => onOpenChange(!open)} style={styles.oemHeader}><View style={{ flex: 1 }}><Text style={styles.oemValue} numberOfLines={1}>{selectedOem || 'Select OEM'}</Text><Text style={styles.oemHint}>Search from approved vehicle manufacturers</Text></View><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={palette.navy} /></Pressable>{open ? <><View style={styles.oemSearch}><MaterialCommunityIcons name="magnify" size={18} color="#7A8799" /><TextInput value={query} onChangeText={onQueryChange} placeholder="Search OEM" placeholderTextColor="#8A94A6" style={styles.oemSearchInput} /></View>{manufacturers.length ? <View style={styles.oemGrid}>{visible.map((manufacturer) => <Pressable key={manufacturer} onPress={() => onSelect(manufacturer)} style={[styles.oemChip, selectedOem === manufacturer && styles.oemChipActive]}><Text style={[styles.oemChipText, selectedOem === manufacturer && styles.oemChipTextActive]} numberOfLines={1}>{manufacturer}</Text></Pressable>)}</View> : <TextInput value={selectedOem} onChangeText={onSelect} placeholder="Enter OEM" placeholderTextColor="#9AA7B8" style={styles.input} />}</> : null}</View></View>;
}
function PospSuccessModal({ onDone }: { onDone: () => void }) {
  return <View style={styles.pospModal}><View style={styles.confettiRow}><Text style={styles.confetti}>•</Text><Text style={styles.confettiBlue}>⌁</Text><View style={styles.pospCheck}><MaterialCommunityIcons name="check" size={44} color="#21A66B" /></View><Text style={styles.confettiBlue}>•</Text><Text style={styles.confettiGold}>⌁</Text></View><Text style={styles.pospTitle}>Thank You!</Text><View style={styles.envelope}><MaterialCommunityIcons name="email-check-outline" size={70} color="#5178D6" /></View><Text style={styles.pospLead}>Your information is received.</Text><Text style={styles.pospSub}>Please wait for verification.</Text><View style={styles.pospDivider} /><View style={styles.trainingRow}><View style={styles.trainingIcon}><MaterialCommunityIcons name="school-outline" size={28} color="#0A43A3" /></View><View style={{ flex: 1 }}><Text style={styles.trainingTitle}>Training link</Text><Text style={styles.trainingText}>You will receive the training link on your registered email id after verification.</Text></View></View><Pressable onPress={onDone} style={styles.pospButton}><Text style={styles.pospButtonText}>OK, Got It</Text></Pressable></View>;
}
function normalizeMobile(value: string) { return value.replace(/\D/g, '').slice(-10); }
function normalizePan(value: string) { const cleaned = value.replace(/[^a-z0-9]/gi, '').toUpperCase(); return collapseDoubledTyping(cleaned).slice(0, 10); }
function collapseDoubledTyping(value: string) { if (value.length >= 4 && value.length % 2 === 0) { let collapsed = ''; for (let index = 0; index < value.length; index += 2) { if (value[index] !== value[index + 1]) return value; collapsed += value[index]; } return collapsed; } return value; }
function asDraft(value: Json | null): Record<string, Json | undefined> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : {}; }
function textDraft(draft: Record<string, Json | undefined>, key: string) { const value = draft[key]; return typeof value === 'string' ? value : ''; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8FC' }, keyboard: { flex: 1 }, header: { height: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }, back: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D8E2EE', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 110, gap: 14 }, title: { color: palette.navy, fontSize: 22, fontWeight: '800' }, error: { borderRadius: 12, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', padding: 10, flexDirection: 'row', gap: 8 }, errorText: { flex: 1, color: '#B42318', fontSize: 11, lineHeight: 15 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D9E2ED', borderRadius: 16, padding: 15, gap: 10 }, sectionTitle: { color: palette.navy, fontSize: 15, fontWeight: '800' }, field: { gap: 6 }, label: { color: palette.navy, fontSize: 12, fontWeight: '800' }, hint: { color: '#7A8798', fontSize: 10, marginTop: 2 }, input: { minHeight: 50, borderWidth: 1, borderColor: '#D4DDE8', borderRadius: 11, paddingHorizontal: 12, color: '#17202F', fontSize: 14 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: '#D8E3EF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: '#0A43A3', borderColor: '#0A43A3' }, choiceText: { color: '#65758B', fontSize: 11, fontWeight: '800' }, choiceTextActive: { color: '#fff' },
  switchRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 }, file: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BCD0E8', backgroundColor: '#F8FBFF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, fileReady: { borderStyle: 'solid', borderColor: '#B9E5D1', backgroundColor: '#F0FBF5' }, fileTitle: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, fileMeta: { color: '#667085', fontSize: 9.5, marginTop: 2 },
  locationShell: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#fff', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, locationSelected: { borderColor: '#8ED7B7', backgroundColor: '#F7FFFB' }, locationInput: { flex: 1, minHeight: 46, color: palette.navy, fontSize: 13, fontWeight: '600' }, locationList: { marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0EA', backgroundColor: '#fff', overflow: 'hidden' }, locationOption: { minHeight: 54, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, locationCity: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, locationMeta: { color: '#667085', fontSize: 9.3, marginTop: 2 }, locationEmpty: { color: '#B42318', fontSize: 10, marginTop: 6 }, selectedLocation: { color: '#12805C', fontSize: 11, fontWeight: '800', marginTop: 6 },
  dropdownButton: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D4DDE8', backgroundColor: '#FFFFFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dropdownValue: { color: palette.navy, fontSize: 13, fontWeight: '800' }, dropdownMenu: { borderRadius: 12, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden' }, dropdownItem: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, dropdownItemActive: { backgroundColor: '#EEF5FF' }, dropdownItemText: { color: '#65758B', fontSize: 12, fontWeight: '700' }, dropdownItemTextActive: { color: palette.navy, fontWeight: '900' },
  oemBox: { borderRadius: 15, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 10, gap: 9 }, oemHeader: { minHeight: 46, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, oemValue: { color: palette.navy, fontSize: 13, fontWeight: '900' }, oemHint: { color: '#667085', fontSize: 9.5, marginTop: 2, fontWeight: '600' }, oemSearch: { minHeight: 42, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 }, oemSearchInput: { flex: 1, minHeight: 40, color: palette.navy, fontSize: 13, fontWeight: '700' }, oemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, oemChip: { maxWidth: '48%', minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' }, oemChipActive: { borderColor: palette.navy, backgroundColor: '#EEF5FF' }, oemChipText: { color: '#607089', fontSize: 11, fontWeight: '800' }, oemChipTextActive: { color: palette.navy },
  footer: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' }, submit: { minHeight: 54, borderRadius: 12, backgroundColor: '#0A3B8F', alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.65 }, submitText: { color: '#fff', fontWeight: '800' }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 390, alignItems: 'center' }, modalTitle: { fontSize: 20, fontWeight: '800', color: palette.navy }, modalText: { marginTop: 8, textAlign: 'center', color: '#59687A', lineHeight: 20 }, modalButton: { marginTop: 20, minHeight: 48, borderRadius: 12, backgroundColor: '#0A3B8F', paddingHorizontal: 20, justifyContent: 'center' },
  pospModal: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 390, alignItems: 'center' }, confettiRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }, confetti: { color: '#F4A940', fontSize: 28, fontWeight: '900' }, confettiBlue: { color: '#1E7BD8', fontSize: 25, fontWeight: '900' }, confettiGold: { color: '#F4A940', fontSize: 25, fontWeight: '900' }, pospCheck: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' }, pospTitle: { marginTop: 12, color: '#061D5C', fontSize: 38, fontWeight: '900', letterSpacing: 0 }, envelope: { marginTop: 16, width: 112, height: 92, borderRadius: 18, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' }, pospLead: { marginTop: 24, color: palette.navy, fontSize: 18, fontWeight: '900', textAlign: 'center' }, pospSub: { marginTop: 6, color: '#667085', fontSize: 14, fontWeight: '700', textAlign: 'center' }, pospDivider: { height: 1, backgroundColor: '#DCE3ED', width: '100%', marginVertical: 20 }, trainingRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 }, trainingIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, trainingTitle: { color: palette.navy, fontSize: 15, fontWeight: '900' }, trainingText: { color: '#59687A', fontSize: 12.5, lineHeight: 18, marginTop: 4, fontWeight: '600' }, pospButton: { marginTop: 24, minHeight: 52, borderRadius: 13, backgroundColor: '#061D70', width: '100%', alignItems: 'center', justifyContent: 'center' }, pospButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
