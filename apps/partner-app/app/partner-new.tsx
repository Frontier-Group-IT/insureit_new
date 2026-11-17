import { Fragment, useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { PartnerStackBottomNavigation, type PartnerTabDestination } from '@/components/partner-stack-bottom-navigation';
import { PartnerPolicyCalendarDialog } from '@/components/policy-intakes/partner-policy-calendar-dialog';
import { supabase } from '@/lib/supabase';
import { usePartnerSession } from '@/providers/partner-session-provider';

type Field = 'document_received_at' | 'associate_employee_id' | 'pos_first_name' | 'pos_middle_name' | 'pos_last_name'
  | 'pan_number' | 'aadhaar_number' | 'date_of_birth' | 'mobile' | 'email'
  | 'address' | 'city' | 'state' | 'postal_code' | 'bank_id' | 'bank_account_number'
  | 'bank_ifsc_code' | 'gst_number';
type Option = { id: string; name: string };
type DocumentType = 'aadhaar_front' | 'aadhaar_back' | 'pan_copy' | 'cancelled_cheque' | 'photograph' | 'gst_copy';
const uploadSlots: Array<{ type: DocumentType; label: string }> = [
  { type: 'aadhaar_front', label: 'Aadhaar Front' }, { type: 'aadhaar_back', label: 'Aadhaar Back' },
  { type: 'pan_copy', label: 'PAN Copy' }, { type: 'cancelled_cheque', label: 'Cancelled Cheque / Bank Proof' },
  { type: 'photograph', label: 'Photograph' }, { type: 'gst_copy', label: 'GST Certificate' },
];
type MasterData = { ok?: boolean; error?: string; rms?: Option[]; banks?: Option[] };
const initial: Record<Field, string> = {
  document_received_at: '', associate_employee_id: '', pos_first_name: '', pos_middle_name: '', pos_last_name: '',
  pan_number: '', aadhaar_number: '', date_of_birth: '', mobile: '', email: '',
  address: '', city: '', state: '', postal_code: '', bank_id: '', bank_account_number: '',
  bank_ifsc_code: '', gst_number: '',
};
const sections: Array<{ heading: string; inputs: Array<{ key: Field; label: string; hint: string; optional?: boolean; secret?: boolean; keyboard?: 'default' | 'phone-pad' | 'email-address' | 'number-pad' }> }> = [
  { heading: 'Identity & contact', inputs: [
    { key: 'document_received_at', label: 'Documents received', hint: 'DD/MM/YYYY', optional: true },
    { key: 'pos_first_name', label: 'First name', hint: 'First name' },
    { key: 'pos_middle_name', label: 'Middle name', hint: 'Middle name', optional: true },
    { key: 'pos_last_name', label: 'Last name', hint: 'Last name', optional: true },
    { key: 'pan_number', label: 'PAN', hint: 'ABCDE1234F' },
    { key: 'aadhaar_number', label: 'Aadhaar', hint: '12-digit Aadhaar', keyboard: 'number-pad', secret: true },
    { key: 'date_of_birth', label: 'Date of Birth', hint: 'DD/MM/YYYY' },
    { key: 'mobile', label: 'Mobile', hint: '10-digit mobile', keyboard: 'phone-pad' },
    { key: 'email', label: 'Email', hint: 'Email address', keyboard: 'email-address' },
  ] },
  { heading: 'Address', inputs: [
    { key: 'address', label: 'Address', hint: 'Complete address' },
    { key: 'postal_code', label: 'PIN Code', hint: '6-digit PIN', keyboard: 'number-pad' },
    { key: 'city', label: 'City', hint: 'City' },
    { key: 'state', label: 'State', hint: 'State' },
  ] },
  { heading: 'Bank & tax', inputs: [
    { key: 'bank_account_number', label: 'Account Number', hint: 'Bank account number', keyboard: 'number-pad', secret: true },
    { key: 'bank_ifsc_code', label: 'IFSC', hint: 'ABCD0123456' },
    { key: 'gst_number', label: 'GST Number', hint: 'GSTIN', optional: true },
  ] },
];
function isoDate(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}` : null;
}
async function authenticatedRequest(method: 'GET' | 'POST', body?: unknown) {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error('Sign in again to continue.');
  const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
  return fetch(`${base}/api/partner/onboarding/partner-only`, {
    method, headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
export default function AddPartnerScreen() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = width >= 350 && fontScale <= 1.3;
  const cellStyle = twoColumns ? styles.halfField : styles.fullField;
  const { context } = usePartnerSession();
  const allowed = context?.identity.actor_kind === 'employee'
    && canPartnerAccess(context, 'create_intermediary_application', 'edit');
  const [form, setForm] = useState(initial);
  const [rms, setRms] = useState<Option[]>([]);
  const [banks, setBanks] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [selector, setSelector] = useState<'rm' | 'bank' | null>(null);
  const [selectorQuery, setSelectorQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [uploaded, setUploaded] = useState<Partial<Record<DocumentType, string>>>({});
  const [dateField, setDateField] = useState<'date_of_birth' | 'document_received_at' | null>(null);
  const set = (key: Field, value: string) => setForm(old => ({ ...old, [key]: value }));
  const hasUnsavedDetails = !applicationId && (Object.keys(initial) as Field[]).some(key => form[key] !== initial[key]);
  const leavePartnerForm = (destination?: PartnerTabDestination) => {
    if (saving || uploadingType) return;
    const leave = () => destination ? router.navigate(destination as never) : router.back();
    if (!hasUnsavedDetails) { leave(); return; }
    Alert.alert('Discard Partner details?', 'Your entered details have not been submitted.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard & Leave', style: 'destructive', onPress: leave },
    ]);
  };
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void (async () => {
      try {
        const response = await authenticatedRequest('GET');
        const result = await response.json() as MasterData;
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not load RM and Bank lists.');
        if (active) { setRms(result.rms || []); setBanks(result.banks || []); }
      } catch (error) {
        if (active) Alert.alert('Master data unavailable', error instanceof Error ? error.message : 'Please retry.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [allowed]);
  const setSelectedDate = (date: Date | undefined) => {
    if (dateField && date) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      set(dateField, `${day}/${month}/${date.getFullYear()}`);
    }
    setDateField(null);
  };
  const selectOptions = selector === 'rm' ? rms : banks;
  const selectedValue = selector === 'rm' ? form.associate_employee_id : form.bank_id;
  const filteredOptions = selectOptions.filter(option => option.name.toLocaleLowerCase().includes(selectorQuery.trim().toLocaleLowerCase()));
  const openSelector = (kind: 'rm' | 'bank') => { setSelectorQuery(''); setSelector(kind); };
  const closeSelector = () => { Keyboard.dismiss(); setSelector(null); setSelectorQuery(''); };
  const savePartner = async (nextStep: 'exit' | 'upload') => {
    if (saving || uploadingType || !allowed) return;
    if (applicationId) {
      if (nextStep === 'exit') router.replace('/(tabs)/policies');
      else setUploadOpen(true);
      return;
    }
    const dob = isoDate(form.date_of_birth);
    const received = form.document_received_at.trim() ? isoDate(form.document_received_at) : null;
    const normalized = {
      ...form, date_of_birth: dob, document_received_at: received,
      mobile: form.mobile.trim(), email: form.email.trim().toLowerCase(),
      pan_number: form.pan_number.trim().toUpperCase(), gst_number: form.gst_number.trim().toUpperCase(),
      aadhaar_number: form.aadhaar_number.replace(/\s/g, ''),
      bank_account_number: form.bank_account_number.trim(),
      bank_ifsc_code: form.bank_ifsc_code.trim().toUpperCase(),
      postal_code: form.postal_code.trim(),
    };
    if (!form.pos_first_name.trim() || !form.associate_employee_id || !form.bank_id
      || !/^[6-9][0-9]{9}$/.test(normalized.mobile)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
      || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized.pan_number)
      || !/^[0-9]{12}$/.test(normalized.aadhaar_number) || !dob
      || (form.document_received_at.trim() && !received)
      || dob > new Date().toISOString().slice(0, 10)
      || !form.address.trim() || !form.city.trim() || !form.state.trim()
      || !/^[0-9]{6}$/.test(normalized.postal_code)
      || !/^[0-9]{6,20}$/.test(normalized.bank_account_number)
      || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized.bank_ifsc_code)
      || (normalized.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized.gst_number))) {
      Alert.alert('Check Partner details', 'Complete all required fields with valid dates, PAN, Aadhaar, mobile, bank account and IFSC.');
      return;
    }
    setSaving(true);
    try {
      const response = await authenticatedRequest('POST', normalized);
      const result = await response.json() as { ok?: boolean; error?: string; application_id?: string };
      if (!response.ok || !result.ok || !result.application_id) throw new Error(result.error || 'Partner application could not be submitted.');
      setApplicationId(result.application_id);
      if (nextStep === 'exit') {
        Alert.alert('Partner details saved', 'Primary details saved and sent to Operations for review.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/policies') },
        ]);
      } else {
        setUploadOpen(true);
      }
    } catch (error) {
      Alert.alert('Unable to save Partner', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };
  const uploadDocument = async (type: DocumentType) => {
    if (!applicationId || uploadingType) return;
    if (type === 'gst_copy' && !form.gst_number.trim()) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets.length) return;
      const file = result.assets[0];
      if (!file.size || file.size > 10 * 1024 * 1024) {
        Alert.alert('Unsupported document', 'Choose a PDF, JPG or PNG under 10 MB.');
        return;
      }
      const mime = file.mimeType || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf'
        : file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mime)) {
        Alert.alert('Unsupported document', 'Choose a PDF, JPG or PNG file.');
        return;
      }
      setUploadingType(type);
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error('Sign in again to upload documents.');
      const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
      const body = new FormData();
      body.append('application_id', applicationId);
      body.append('document_type', type);
      body.append('file', { uri: file.uri, name: file.name, type: mime } as unknown as Blob);
      const response = await fetch(`${base}/api/partner/onboarding/partner-only/documents`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body,
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Document upload failed.');
      setUploaded(previous => ({ ...previous, [type]: file.name }));
      Alert.alert('Uploaded', `${file.name} saved successfully.`);
    } catch (error) {
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setUploadingType(null);
    }
  };
  if (!allowed) return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.heading}>Add Partner</Text><Text>Employee Partner-onboarding permission required.</Text></View></SafeAreaView>;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar style="light" backgroundColor="#071E49" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" onPress={() => leavePartnerForm()} hitSlop={10}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></Pressable>
          <View style={styles.headerTitleGroup}>
            <Ionicons name="person-add-outline" size={22} color="#FFFFFF" />
            <Text style={styles.heading}>Add Partner</Text>
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {sections.map((section, index) => (
            <View key={section.heading} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <Text style={styles.sectionTitle}>{section.heading}</Text>
              </View>
              <View style={styles.sectionBody}>
                {index === 2 ? (
                  <View style={[styles.field, cellStyle]}>
                    <Text style={styles.label}>Bank *</Text>
                    <Pressable disabled={loading || Boolean(applicationId)} accessibilityRole="button" onPress={() => openSelector('bank')} style={styles.select}>
                      <Text style={styles.selectText} numberOfLines={1}>{banks.find(x => x.id === form.bank_id)?.name || (loading ? 'Loading banks…' : 'Select bank')}</Text>
                      <Ionicons name="chevron-down" size={17} color="#17365D" />
                    </Pressable>
                  </View>
                ) : null}
                {section.inputs.map(field => (
                  <Fragment key={field.key}>
                    <View style={[styles.field, cellStyle]}>
                      <Text style={styles.label}>{field.label}{field.optional ? '' : ' *'}</Text>
                      {field.key === 'document_received_at' || field.key === 'date_of_birth' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Select ${field.label}`}
                          disabled={Boolean(applicationId)} onPress={() => setDateField(field.key as 'date_of_birth' | 'document_received_at')} style={styles.select}>
                          <Text style={styles.selectText} numberOfLines={1}>{form[field.key] || 'DD/MM/YYYY'}</Text>
                          <Ionicons name="calendar-outline" size={18} color="#17365D" />
                        </Pressable>
                      ) : (
                        <TextInput editable={!applicationId} value={form[field.key]} onChangeText={text => set(field.key, text)}
                          placeholder={field.hint} placeholderTextColor="#8997A8"
                          keyboardType={field.keyboard || 'default'} secureTextEntry={Boolean(field.secret)}
                          autoCapitalize={field.key === 'email' ? 'none' : field.key === 'pan_number' || field.key === 'bank_ifsc_code' || field.key === 'gst_number' ? 'characters' : 'sentences'}
                          autoCorrect={false} maxLength={field.key === 'address' ? 300 : field.key === 'aadhaar_number' ? 12 : 150}
                          style={styles.input} />
                      )}
                    </View>
                    {field.key === 'document_received_at' ? (
                      <View style={[styles.field, cellStyle]}>
                        <Text style={styles.label}>RM *</Text>
                        <Pressable disabled={loading || Boolean(applicationId)} accessibilityRole="button" onPress={() => openSelector('rm')} style={styles.select}>
                          <Text style={styles.selectText} numberOfLines={1}>{rms.find(x => x.id === form.associate_employee_id)?.name || (loading ? 'Loading RMs…' : 'Select RM')}</Text>
                          <Ionicons name="chevron-down" size={17} color="#17365D" />
                        </Pressable>
                      </View>
                    ) : null}
                  </Fragment>
                ))}
              </View>
            </View>
          ))}

        </ScrollView>
        <View style={styles.actionFooter}>
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Save and exit Partner form"
              disabled={saving || loading || Boolean(uploadingType)}
              onPress={() => void savePartner('exit')}
              style={[styles.actionButton, styles.saveExitButton, (saving || loading || uploadingType) && styles.disabled]}>
              <Text style={styles.saveExitText}>{saving ? 'Saving…' : 'Save & Exit'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Upload Partner documents"
              disabled={saving || loading || Boolean(uploadingType)}
              onPress={() => void savePartner('upload')}
              style={[styles.actionButton, styles.uploadButton, (saving || loading || uploadingType) && styles.disabled]}>
              <Text style={styles.submitText}>{uploadingType ? 'Uploading…' : saving ? 'Saving…' : 'Upload Documents'}</Text>
            </Pressable>
          </View>
        </View>
        <PartnerPolicyCalendarDialog
          visible={Boolean(dateField)}
          value={dateField && isoDate(form[dateField]) ? new Date(`${isoDate(form[dateField])}T12:00:00`) : new Date()}
          maximumDate={new Date()}
          onCancel={() => setDateField(null)}
          onConfirm={date => setSelectedDate(date)}
        />
        <Modal visible={uploadOpen} transparent animationType="fade" onRequestClose={() => { if (!uploadingType) setUploadOpen(false); }}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { if (!uploadingType) setUploadOpen(false); }} accessibilityLabel="Close upload options" />
            <View style={styles.modalKeyboardArea} pointerEvents="box-none">
              <View style={styles.modal}>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>Upload Partner Documents</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close upload options" disabled={Boolean(uploadingType)}
                    onPress={() => setUploadOpen(false)}><Ionicons name="close" size={22} color="#4C5970" /></Pressable>
                </View>
                <Text style={styles.uploadHint}>PDF, JPG or PNG, maximum 10 MB per document. Tap a category to select its file.</Text>
                <ScrollView style={styles.modalOptionList}>
                  {uploadSlots.filter(slot => slot.type !== 'gst_copy' || Boolean(form.gst_number.trim())).map(slot => (
                    <Pressable key={slot.type} accessibilityRole="button" disabled={Boolean(uploadingType)}
                      onPress={() => void uploadDocument(slot.type)} style={styles.option}>
                      <View style={styles.uploadLabel}>
                        <Text style={styles.selectText}>{slot.label}</Text>
                        {uploaded[slot.type] ? <Text style={styles.uploadedName} numberOfLines={1}>{uploaded[slot.type]}</Text> : null}
                      </View>
                      <Ionicons name={uploaded[slot.type] ? 'checkmark-circle' : 'cloud-upload-outline'} size={21} color="#17365D" />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={selector !== null} transparent animationType="fade" onRequestClose={closeSelector}>
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFillObject} accessibilityLabel="Close selection popup" onPress={closeSelector} />
            <KeyboardAvoidingView style={styles.modalKeyboardArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
              <View style={styles.modal}>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>{selector === 'rm' ? 'Select RM' : 'Select Bank'}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close selection popup" hitSlop={10} onPress={closeSelector}>
                    <Ionicons name="close" size={22} color="#4C5970" />
                  </Pressable>
                </View>
                <View style={styles.modalSearchRow}>
                  <TextInput
                    accessibilityLabel={selector === 'rm' ? 'Search RM name' : 'Search bank name'}
                    value={selectorQuery}
                    onChangeText={setSelectorQuery}
                    placeholder={selector === 'rm' ? 'Search RM name' : 'Search bank name'}
                    placeholderTextColor="#8997A8"
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={() => Keyboard.dismiss()}
                    style={styles.modalSearchInput}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel="Finish searching" onPress={() => Keyboard.dismiss()} style={styles.modalSearchButton}>
                    <Ionicons name="search" size={19} color="#FFFFFF" />
                  </Pressable>
                </View>
                <ScrollView style={styles.modalOptionList} keyboardShouldPersistTaps="always">
                  {filteredOptions.length ? filteredOptions.map(option => (
                    <Pressable key={option.id} accessibilityRole="button"
                      accessibilityLabel={`Select ${option.name}`}
                      accessibilityState={{ selected: option.id === selectedValue }}
                      onPress={() => { set(selector === 'rm' ? 'associate_employee_id' : 'bank_id', option.id); closeSelector(); }}
                      style={[styles.option, option.id === selectedValue && styles.selectedOption]}>
                      <Text style={styles.selectText}>{option.name}</Text>
                      {option.id === selectedValue ? <Ionicons name="checkmark" size={17} color="#17365D" /> : null}
                    </Pressable>
                  )) : (
                    <Text style={styles.emptyOptions}>{selectorQuery.trim() ? 'No matching results.' : 'No options available.'}</Text>
                  )}
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
      <PartnerStackBottomNavigation activeTab="more" includeBottomInset onNavigate={leavePartnerForm} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F2F5FB' }, screen: { flex: 1, backgroundColor: '#071E49' },
  header: { height: 54, backgroundColor: '#071E49', borderBottomWidth: 1, borderBottomColor: '#071E49', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 14 },
  heading: { fontSize: 17, color: '#FFFFFF', fontWeight: '800' },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  content: { padding: 12, paddingBottom: 35, gap: 12 },
  section: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E7F1', borderRadius: 14, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#F9FBFD', borderBottomWidth: 1, borderBottomColor: '#E1E7F1' },
  index: { backgroundColor: '#17365D', borderRadius: 7, width: 33, height: 33, justifyContent: 'center', alignItems: 'center' },
  indexText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: '#172846', fontSize: 13, fontWeight: '800' },
  sectionBody: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  halfField: { width: '48.5%' }, fullField: { width: '100%' },
  field: { gap: 5 }, label: { fontSize: 11, fontWeight: '700', color: '#33465D' },
  input: { minHeight: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#152A49' },
  select: { minHeight: 44, borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#17365D', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  actionFooter: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E0E6F0', paddingVertical: 9, paddingHorizontal: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionButton: { minHeight: 44, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveExitButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE4F2' },
  saveExitText: { color: '#17365D', fontWeight: '700', fontSize: 12 },
  uploadButton: { backgroundColor: '#4379EF' },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 12 }, disabled: { opacity: .55 },
  modalBackdrop: { flex: 1, backgroundColor: '#14233B88' },
  modalKeyboardArea: { flex: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, gap: 12, maxHeight: '80%' },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: '#E7EDF5' },
  modalTitle: { color: '#17365D', fontSize: 16, fontWeight: '800' },
  modalSearchRow: { flexDirection: 'row', gap: 8 },
  modalSearchInput: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#152A49' },
  modalSearchButton: { width: 44, borderRadius: 10, backgroundColor: '#17365D', alignItems: 'center', justifyContent: 'center' },
  modalOptionList: { maxHeight: 350 },
  option: { minHeight: 45, padding: 12, borderBottomWidth: 1, borderBottomColor: '#E7EDF5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedOption: { backgroundColor: '#EAF3FF' },
  emptyOptions: { color: '#71819A', fontSize: 12, padding: 16 },
  uploadHint: { color: '#64748B', fontSize: 12, lineHeight: 18 },
  uploadLabel: { flex: 1, gap: 3 },
  uploadedName: { color: '#16805C', fontSize: 11 },
});
