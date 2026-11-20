import { partnerAlert } from '@/components/ui/partner-alert-provider';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { PartnerStackBottomNavigation, type PartnerTabDestination } from '@/components/partner-stack-bottom-navigation';
import { PartnerPolicyCalendarDialog } from '@/components/policy-intakes/partner-policy-calendar-dialog';
import { supabase } from '@/lib/supabase';
import { MispPartnerForm } from '@/components/misp-partner-form';
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
type MasterData = { ok?: boolean; error?: string; rms?: Option[]; banks?: Option[]; oems?: Option[];  };
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
type FieldErrors = Partial<Record<Field, string>>;
const validationOrder: Field[] = [
  // Guide POSP entry from RM through the required fields, one at a time.
  'associate_employee_id', 'pos_first_name', 'pan_number',
  'aadhaar_number', 'date_of_birth', 'mobile', 'email', 'address',
  'postal_code', 'city', 'state', 'bank_id', 'bank_account_number',
  'bank_ifsc_code',
  // Optional dates and tax fields only block submission if supplied and invalid.
  'document_received_at', 'gst_number',
];
const fieldSection: Partial<Record<Field, number>> = {
  document_received_at: 0, associate_employee_id: 0, pos_first_name: 0,
  pan_number: 0, aadhaar_number: 0, date_of_birth: 0, mobile: 0, email: 0,
  address: 1, postal_code: 1, city: 1, state: 1,
  bank_id: 2, bank_account_number: 2, bank_ifsc_code: 2, gst_number: 2,
};
function validatePartnerField(key: Field, form: Record<Field, string>): string | null {
  const value = form[key].trim();
  const required: Partial<Record<Field, string>> = {
    associate_employee_id: 'RM', pos_first_name: 'First Name', pan_number: 'PAN',
    aadhaar_number: 'Aadhaar', date_of_birth: 'Date of Birth', mobile: 'Mobile',
    email: 'Email', address: 'Address', postal_code: 'PIN Code',
    city: 'City', state: 'State', bank_id: 'Bank',
    bank_account_number: 'Account Number', bank_ifsc_code: 'IFSC Code',
  };
  if (!value) return required[key] ? `${required[key]} is required.` : null;
  const upper = value.toUpperCase();
  if (key === 'pan_number' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(upper)) return 'PAN must use PAN format ABCDE1234F.';
  if (key === 'aadhaar_number' && !/^[0-9]{12}$/.test(value.replace(/\s/g, ''))) return 'Aadhaar must contain exactly 12 digits.';
  if (key === 'mobile' && !/^[6-9][0-9]{9}$/.test(value)) return 'Mobile must be a valid Indian mobile number.';
  if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email must be a valid email address.';
  if (key === 'postal_code' && !/^[0-9]{6}$/.test(value)) return 'PIN Code must contain exactly 6 digits.';
  if (key === 'bank_account_number' && !/^[0-9]{6,20}$/.test(value)) return 'Account Number must contain 6 to 20 digits.';
  if (key === 'bank_ifsc_code' && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)) return 'IFSC Code must use format ABCD0123456.';
  if (key === 'gst_number' && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(upper)) return 'GST Number must be a valid 15-character GSTIN.';
  if (key === 'date_of_birth' || key === 'document_received_at') {
    const date = isoDate(value);
    if (!date) return `${key === 'date_of_birth' ? 'Date of Birth' : 'Documents received'} must be a valid date.`;
    if (key === 'date_of_birth' && date > new Date().toISOString().slice(0, 10)) return 'Date of Birth cannot be in the future.';
  }
  return null;
}
function validatePartner(form: Record<Field, string>): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of validationOrder) {
    const message = validatePartnerField(key, form);
    if (message) errors[key] = message;
  }
  return errors;
}
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
  const safeAreaInsets = useSafeAreaInsets();
  const twoColumns = width >= 350 && fontScale <= 1.3;
  const cellStyle = twoColumns ? styles.halfField : styles.fullField;
  const { context } = usePartnerSession();
  const allowed = context?.identity.actor_kind === 'employee'
    && canPartnerAccess(context, 'create_intermediary_application', 'edit');
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [validationAlert, setValidationAlert] = useState<{field:Field;message:string}|null>(null);
  const [uploadSuccessToken, setUploadSuccessToken] = useState(0);
  const [showUploadBadge, setShowUploadBadge] = useState(false);
  useEffect(() => {
    if (!uploadSuccessToken) return;
    setShowUploadBadge(true);
    const timeout = setTimeout(() => setShowUploadBadge(false), 1000);
    return () => clearTimeout(timeout);
  }, [uploadSuccessToken]);
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<number, number>>({});
  const bodyPositions = useRef<Record<number, number>>({});
  const fieldPositions = useRef<Partial<Record<Field, number>>>({});
  const revealFirstError = (key: Field) => {
    const section = fieldSection[key];
    if (section === undefined) return;
    const y = (sectionPositions.current[section] || 0)
      + (bodyPositions.current[section] || 0) + (fieldPositions.current[key] || 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 65), animated: true });
  };
  const [partnerType,setPartnerType]=useState<"posp"|"misp">("posp");
  const [mispDirty,setMispDirty]=useState(false);
  const [oems,setOems]=useState<Option[]>([]);
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
  const [missingDocuments, setMissingDocuments] = useState<DocumentType[]>(uploadSlots.slice(0,5).map(slot => slot.type));
  const [finalizing, setFinalizing] = useState(false);
  const [issuedPartnerId, setIssuedPartnerId] = useState<string | null>(null);
  const [dateField, setDateField] = useState<'date_of_birth' | 'document_received_at' | null>(null);
  const set = (key: Field, value: string) => {
    setForm(old => ({ ...old, [key]: value }));
    setFieldErrors(previous => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      const message = validatePartnerField(key, { ...form, [key]: value });
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  };
  const hasUnsavedDetails = mispDirty || (!applicationId && (Object.keys(initial) as Field[]).some(key => form[key] !== initial[key]));
  const changePartnerType=(next:"posp"|"misp")=>{
    if(next===partnerType)return;
    if(partnerType==="misp"&&mispDirty){partnerAlert("Discard MISP details?","Switching to POSP will clear unsaved MISP details.",[{text:"Keep Editing",style:"cancel"},{text:"Discard & Switch",style:"destructive",onPress:()=>{setMispDirty(false);setPartnerType(next);}}]);return;}
    if(partnerType==="posp"&&(applicationId||hasUnsavedDetails)){partnerAlert("Keep POSP details?","Changing type will hide the current POSP form.",[{text:"Keep Editing",style:"cancel"},{text:"Switch to MISP",onPress:()=>setPartnerType(next)}]);return;}
    setPartnerType(next);
  };
  const leavePartnerForm = (destination?: PartnerTabDestination) => {
    if (saving || uploadingType) return;
    const leave = () => destination ? router.navigate(destination as never) : router.back();
    if (!hasUnsavedDetails) { leave(); return; }
    partnerAlert('Discard Partner details?', 'Your entered details have not been submitted.', [
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
        if (active) { setRms(result.rms || []); setBanks(result.banks || []); setOems(result.oems || []);}
      } catch (error) {
        if (active) partnerAlert('Master data unavailable', error instanceof Error ? error.message : 'Please retry.');
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
  const showSavedChoice = () => {
    partnerAlert('Partner Details Saved', 'Would you like to upload documents now?', [
      { text: 'Not Now', style: 'cancel', onPress: () => router.replace('/(tabs)/policies') },
      { text: 'Upload Documents', singleLineNormalLabel: true, onPress: () => setUploadOpen(true) },
    ]);
  };
  const savePartner = async ():Promise<string|null> => {
    if (saving || uploadingType || !allowed) return null;
    if (applicationId) {
      showSavedChoice();
      return applicationId;
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
    const errors = validatePartner(form);
    const firstInvalid = validationOrder.find(key => errors[key]);
    // Only the first invalid input is visible; the full validation still blocks saving.
    setFieldErrors(firstInvalid ? { [firstInvalid]: errors[firstInvalid] } : {});
    if (firstInvalid) {
      Keyboard.dismiss();
      setValidationAlert({field:firstInvalid,message:errors[firstInvalid]!});
      return null;
    }
    setSaving(true);
    try {
      const response = await authenticatedRequest('POST', normalized);
      const result = await response.json() as { ok?: boolean; error?: string; application_id?: string };
      if (!response.ok || !result.ok || !result.application_id) throw new Error(result.error || 'Partner application could not be submitted.');
      setApplicationId(result.application_id);
      setFieldErrors({});
      setMissingDocuments(uploadSlots.filter(slot => slot.type !== 'gst_copy' || Boolean(form.gst_number.trim())).map(slot => slot.type));
      showSavedChoice();
      return result.application_id;
    } catch (error) {
      partnerAlert('Unable to save Partner', error instanceof Error ? error.message : 'Please try again.');
      return null;
    } finally { setSaving(false); }
  };
  const uploadDocument = async (type: DocumentType) => {
    if (saving || uploadingType || !allowed) return;
    if (type === 'gst_copy' && !form.gst_number.trim()) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets.length) return;
      const file = result.assets[0];
      if (!file.size || file.size > 10 * 1024 * 1024) {
        partnerAlert('Unsupported document', 'Choose a PDF, JPG or PNG under 10 MB.');
        return;
      }
      const mime = file.mimeType || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf'
        : file.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mime)) {
        partnerAlert('Unsupported document', 'Choose a PDF, JPG or PNG file.');
        return;
      }
      // Documents are optional and available only after Partner details have been saved.
      const savedId = applicationId;
      if (!savedId) {
        partnerAlert('Save details first', 'Save Partner details before uploading documents.');
        return;
      }
      setUploadingType(type);
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error('Sign in again to upload documents.');
      const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
      const body = new FormData();
      body.append('application_id', savedId);
      body.append('document_type', type);
      body.append('file', { uri: file.uri, name: file.name, type: mime } as unknown as Blob);
      const response = await fetch(`${base}/api/partner/onboarding/partner-only/documents`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body,
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || 'Document upload failed.');
      setUploaded(previous => ({ ...previous, [type]: file.name }));
      await loadSavedDocuments(savedId);
      setUploadSuccessToken(previous => previous + 1);
    } catch (error) {
      partnerAlert('Upload failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setUploadingType(null);
    }
  };
  const loadSavedDocuments = async (savedId: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session?.access_token) throw new Error('Sign in again to load documents.');
    const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
    const response = await fetch(`${base}/api/partner/onboarding/partner-only/documents?applicationId=${encodeURIComponent(savedId)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json() as { ok?: boolean; error?: string; documents?: Array<{ type: DocumentType; name: string }>; missing?: DocumentType[]; partner_id?: string | null };
    if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to load saved documents.');
    setUploaded(Object.fromEntries((result.documents || []).map(item => [item.type, item.name])) as Partial<Record<DocumentType, string>>);
    setMissingDocuments(result.missing || []);
    setIssuedPartnerId(result.partner_id || null);
    return result;
  };
  const completePartnerDocuments = async () => {
    if (!applicationId || missingDocuments.length > 0 || finalizing || uploadingType || !allowed || issuedPartnerId) return;
    setFinalizing(true);
    try {
      // The server rechecks all required files (including GST when applicable) and
      // atomically issues the Partner ID. Never trust local upload state alone.
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error('Sign in again to complete the application.');
      const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
      const response = await fetch(`${base}/api/partner/onboarding/partner-only/documents`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; partner_id?: string };
      if (!response.ok || !result.ok || !result.partner_id) throw new Error(result.error || 'Partner ID could not be issued.');
      setIssuedPartnerId(result.partner_id);
      setUploadOpen(false);
      partnerAlert('Partner ID Created', `Partner ID: ${result.partner_id}`, [
        { text: 'Done', onPress: () => router.replace('/(tabs)/policies') },
      ]);
    } catch (error) {
      partnerAlert('Unable to issue Partner ID', error instanceof Error ? error.message : 'Please retry or contact Operations.');
    } finally {
      setFinalizing(false);
    }
  };
  const deleteDocument = (type: DocumentType) => {
    if (!applicationId || !uploaded[type] || saving || uploadingType) return;
    partnerAlert('Delete document?', 'Remove this document from the Partner application?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        void (async () => {
          setUploadingType(type);
          try {
            const session = (await supabase.auth.getSession()).data.session;
            if (!session?.access_token) throw new Error('Sign in again to delete documents.');
            const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
            const response = await fetch(`${base}/api/partner/onboarding/partner-only/documents`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ application_id: applicationId, document_type: type }),
            });
            const result = await response.json() as { ok?: boolean; error?: string };
            if (!response.ok || !result.ok) throw new Error(result.error || 'Document could not be deleted.');
            setUploaded(previous => { const next = { ...previous }; delete next[type]; return next; });
            await loadSavedDocuments(applicationId);
          } catch (error) {
            partnerAlert('Delete failed', error instanceof Error ? error.message : 'Try again.');
          } finally { setUploadingType(null); }
        })();
      } },
    ]);
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
          {showUploadBadge && !uploadOpen ? <View style={styles.uploadSuccessBadge} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={17} color="#16805C"/>
            <Text style={styles.uploadSuccessBadgeText}>Uploaded</Text>
          </View> : null}
        </View>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.typeSwitch} accessibilityLabel="Partner onboarding type">{(["posp","misp"] as const).map(type=><Pressable key={type} accessibilityRole="button" accessibilityLabel={type.toUpperCase()} accessibilityState={{selected:partnerType===type}} onPress={()=>changePartnerType(type)} style={[styles.typeOption,partnerType===type&&styles.typeSelected]}><Text style={[styles.typeText,partnerType===type&&styles.typeSelectedText]}>{type.toUpperCase()}</Text></Pressable>)}</View>
          {partnerType==="misp"?<MispPartnerForm rms={rms} banks={banks} oems={oems} loading={loading} onDirtyChange={setMispDirty} onCancel={() => leavePartnerForm()}/>:<>
          {sections.map((section, index) => (
            <View key={section.heading} style={styles.section} onLayout={event => { sectionPositions.current[index] = event.nativeEvent.layout.y; }}>
              <View style={styles.sectionHeader}>
                <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <Text style={styles.sectionTitle}>{section.heading}</Text>
              </View>
              <View style={styles.sectionBody} onLayout={event => { bodyPositions.current[index] = event.nativeEvent.layout.y; }}>
                {index === 2 ? (
                  <View style={[styles.field, cellStyle]} onLayout={event => { fieldPositions.current.bank_id = event.nativeEvent.layout.y; }}>
                    <Text style={styles.label}>Bank <Text style={styles.requiredStar}>*</Text></Text>
                    <Pressable disabled={loading || Boolean(applicationId)} accessibilityRole="button" onPress={() => openSelector('bank')} style={[styles.select, fieldErrors.bank_id && styles.invalidControl]}>
                      <Text style={styles.selectText} numberOfLines={1}>{banks.find(x => x.id === form.bank_id)?.name || (loading ? 'Loading banks…' : 'Select bank')}</Text>
                      <Ionicons name="chevron-down" size={17} color="#17365D" />
                    </Pressable>
                  </View>
                ) : null}
                {section.inputs.map(field => (
                  <Fragment key={field.key}>
                    <View style={[styles.field, cellStyle]} onLayout={event => { fieldPositions.current[field.key] = event.nativeEvent.layout.y; }}>
                      <Text style={styles.label}>{field.label}{!field.optional ? <Text style={styles.requiredStar}> *</Text> : null}</Text>
                      {field.key === 'document_received_at' || field.key === 'date_of_birth' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Select ${field.label}`}
                          disabled={Boolean(applicationId)} onPress={() => setDateField(field.key as 'date_of_birth' | 'document_received_at')} style={[styles.select, fieldErrors[field.key] && styles.invalidControl]}>
                          <Text style={styles.selectText} numberOfLines={1}>{form[field.key] || 'DD/MM/YYYY'}</Text>
                          <Ionicons name="calendar-outline" size={18} color="#17365D" />
                        </Pressable>
                      ) : (
                        <TextInput editable={!applicationId} value={form[field.key]} onChangeText={text => set(field.key, text)}
                          placeholder={field.hint} placeholderTextColor="#8997A8"
                          keyboardType={field.keyboard || 'default'} secureTextEntry={Boolean(field.secret)}
                          autoCapitalize={field.key === 'email' ? 'none' : field.key === 'pan_number' || field.key === 'bank_ifsc_code' || field.key === 'gst_number' ? 'characters' : 'sentences'}
                          autoCorrect={false} maxLength={field.key === 'address' ? 300 : field.key === 'aadhaar_number' ? 12 : 150}
                          style={[styles.input, fieldErrors[field.key] && styles.invalidControl]} />
                      )}
                    </View>
                    {field.key === 'document_received_at' ? (
                      <View style={[styles.field, cellStyle]} onLayout={event => { fieldPositions.current.associate_employee_id = event.nativeEvent.layout.y; }}>
                        <Text style={styles.label}>RM <Text style={styles.requiredStar}>*</Text></Text>
                        <Pressable disabled={loading || Boolean(applicationId)} accessibilityRole="button" onPress={() => openSelector('rm')} style={[styles.select, fieldErrors.associate_employee_id && styles.invalidControl]}>
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
          </>}

          {partnerType==="posp"&&<View style={styles.actionFooter}>
            <View style={styles.actionRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel Add Partner"
                disabled={saving||Boolean(uploadingType)}
                onPress={()=>leavePartnerForm()} style={[styles.actionButton,styles.saveExitButton]}>
                <Text style={styles.saveExitText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Save Partner details"
                disabled={saving||loading||Boolean(uploadingType)}
                onPress={()=>void savePartner()}
                style={[styles.actionButton,styles.uploadButton,(saving||loading||uploadingType)&&styles.disabled]}>
                <Text style={styles.submitText}>{saving?'Saving…':'Save Detail'}</Text>
              </Pressable>
            </View>
          </View>}
        </ScrollView>
        <PartnerPolicyCalendarDialog
          visible={Boolean(dateField)}
          value={dateField && isoDate(form[dateField]) ? new Date(`${isoDate(form[dateField])}T12:00:00`) : new Date()}
          maximumDate={new Date()}
          onCancel={() => setDateField(null)}
          onConfirm={date => setSelectedDate(date)}
        />
        <Modal visible={uploadOpen} transparent animationType="fade" onRequestClose={() => { /* Required document upload must be completed before leaving. */ }}>
          <View style={styles.modalBackdrop}>
            {showUploadBadge ? <View pointerEvents="none" style={[styles.uploadSuccessBadge,styles.uploadSuccessOverlay,{top:Math.max(12,safeAreaInsets.top+8)}]} accessibilityRole="alert">
              <Ionicons name="checkmark-circle" size={17} color="#16805C"/>
              <Text style={styles.uploadSuccessBadgeText}>Uploaded</Text>
            </View> : null}

            <View style={styles.documentModalCenter} pointerEvents="box-none">
              <View style={styles.documentModal}>
                <View style={styles.modalTitleRow}>
                  <Text style={styles.modalTitle}>Upload Documents</Text>

                </View>
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.documentModalScroll}>
          <View style={styles.documentModalBody}>
             <View style={styles.documentList}>
              {uploadSlots.filter(slot => slot.type !== 'gst_copy' || Boolean(form.gst_number.trim())).map(slot => (
                <View key={slot.type} style={styles.documentRow}>
                  <Ionicons name="document-text-outline" size={20} color="#315B85"/>
                  <View style={styles.documentLabel}>
                    <Text style={styles.documentName}>{slot.label}</Text>
                    {uploaded[slot.type]?<Text style={styles.uploadedName} numberOfLines={1}>{uploaded[slot.type]}</Text>:null}
                  </View>
                  {uploaded[slot.type]?<>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Replace ${slot.label}`}
                      disabled={saving||Boolean(uploadingType)} onPress={()=>void uploadDocument(slot.type)}
                      style={styles.documentIconButton}>
                      <Ionicons name="refresh-outline" size={19} color="#24517E"/>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${slot.label}`}
                      disabled={saving||Boolean(uploadingType)} onPress={()=>deleteDocument(slot.type)}
                      style={styles.documentIconButton}>
                      <Ionicons name="trash-outline" size={19} color="#C02D3A"/>
                    </Pressable>
                  </>:<Pressable accessibilityRole="button" accessibilityLabel={`Upload ${slot.label}`}
                    disabled={saving||Boolean(uploadingType)} onPress={()=>void uploadDocument(slot.type)}
                    style={styles.documentAddButton}>
                    {uploadingType===slot.type?<ActivityIndicator size="small" color="#24517E"/>:
                      <Ionicons name="cloud-upload-outline" size={17} color="#24517E"/>}
                    <Text style={styles.documentAddText}>Upload</Text>
                  </Pressable>}
                </View>
              ))}
            </View>
          </View>
                </ScrollView>
                <Text style={{ color: missingDocuments.length ? '#9B5B10' : '#16805C', fontSize: 11, fontWeight: '700' }}>
                  {issuedPartnerId ? `Partner ID: ${issuedPartnerId}` : missingDocuments.length ? `${missingDocuments.length} required document(s) remaining` : 'All required documents saved — ready to issue Partner ID'}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Done uploading documents and create Partner ID"
                  disabled={!applicationId || !allowed || Boolean(uploadingType) || finalizing || missingDocuments.length > 0 || Boolean(issuedPartnerId)}
                  onPress={() => void completePartnerDocuments()}
                  style={[styles.documentDoneButton, (!applicationId || !allowed || Boolean(uploadingType) || finalizing || missingDocuments.length > 0 || Boolean(issuedPartnerId)) && styles.disabled]}>
                  <Text style={styles.submitText}>{finalizing ? 'Creating Partner ID…' : 'Done'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <PartnerConfirmDialog
          visible={validationAlert!==null}
          title="Action required"
          message={validationAlert?.message??''}
          kind="error"
          actions={[{label:'OK',onPress:()=>{
            const invalidField=validationAlert?.field;
            setValidationAlert(null);
            if(invalidField)revealFirstError(invalidField);
          }}]}
          onCancel={()=>setValidationAlert(null)}
          dismissible={false}
        />
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
  uploadSuccessBadge: {marginLeft:'auto',flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#E7F8EE',borderRadius:999,paddingHorizontal:10,minHeight:30},
  uploadSuccessBadgeText: {color:'#16805C',fontSize:11,fontWeight:'700'},
  uploadSuccessOverlay: {position:'absolute',right:16,zIndex:15,elevation:15},
  content: { padding: 12, paddingBottom: 35, gap: 12 },
  typeSwitch:{flexDirection:'row',width:'100%',padding:4,backgroundColor:'#E4EAF5',borderRadius:12,borderWidth:1,borderColor:'#CED8E7'},
  typeOption:{flex:1,minHeight:42,alignItems:'center',justifyContent:'center',borderRadius:9},typeSelected:{backgroundColor:'#17365D'},typeText:{fontWeight:'800',fontSize:13,color:'#4D5F7B'},typeSelectedText:{color:'#FFFFFF'},
  section: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E7F1', borderRadius: 14, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#F9FBFD', borderBottomWidth: 1, borderBottomColor: '#E1E7F1' },
  index: { backgroundColor: '#17365D', borderRadius: 7, width: 33, height: 33, justifyContent: 'center', alignItems: 'center' },
  indexText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: '#000000', fontSize: 13, fontWeight: '800' },
  sectionBody: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  halfField: { width: '48.5%' }, fullField: { width: '100%' },
  field: { gap: 5 }, label: { fontSize: 11, fontWeight: '700', color: '#000000' }, requiredStar: { color: '#DC2626' },
  invalidControl: { borderColor: '#DC2626', backgroundColor: '#FFF7F7' },
  fieldError: { fontSize: 10.5, lineHeight: 15, color: '#B91C1C', fontWeight: '600' },
  input: { minHeight: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#152A49' },
  select: { minHeight: 44, borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#17365D', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  documentList:{paddingHorizontal:4,paddingVertical:5},
  documentModalCenter:{flex:1,justifyContent:'center',paddingHorizontal:16,paddingVertical:28},
  documentModal:{backgroundColor:'#FFFFFF',borderRadius:18,padding:16,maxHeight:'90%',gap:12},
  documentModalScroll:{flexGrow:0},
  documentModalBody:{width:'100%'},
  documentDoneButton:{backgroundColor:'#155EBA',borderRadius:10,minHeight:43,alignItems:'center',justifyContent:'center'},
  documentRow:{flexDirection:'row',alignItems:'center',minHeight:53,gap:9,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#E7EDF5'},
  documentLabel:{flex:1,minWidth:0,gap:3},
  documentName:{fontSize:12,fontWeight:'700',color:'#000000'},
  documentAddButton:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderWidth:1,borderColor:'#CBD8E8',borderRadius:9,paddingHorizontal:10,minHeight:36},
  documentAddText:{fontSize:11,fontWeight:'700',color:'#24517E'},
  documentIconButton:{width:36,height:36,borderRadius:9,borderWidth:1,borderColor:'#D9E3F1',alignItems:'center',justifyContent:'center'},
  actionFooter: { backgroundColor: '#E7EEFC', borderWidth: 1, borderColor: '#CBDCFB', borderRadius: 12, padding: 10, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
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
