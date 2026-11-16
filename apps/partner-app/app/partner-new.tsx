import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { supabase } from '@/lib/supabase';
import { usePartnerSession } from '@/providers/partner-session-provider';

type Field = 'document_received_at' | 'associate_employee_id' | 'pos_first_name' | 'pos_middle_name' | 'pos_last_name'
  | 'pan_number' | 'aadhaar_number' | 'date_of_birth' | 'mobile' | 'email'
  | 'address' | 'city' | 'state' | 'postal_code' | 'bank_id' | 'bank_account_number'
  | 'bank_ifsc_code' | 'gst_number';
type Option = { id: string; name: string };
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
    { key: 'city', label: 'City', hint: 'City' },
    { key: 'state', label: 'State', hint: 'State' },
    { key: 'postal_code', label: 'PIN Code', hint: '6-digit PIN', keyboard: 'number-pad' },
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
  const { context } = usePartnerSession();
  const allowed = context?.identity.actor_kind === 'employee'
    && canPartnerAccess(context, 'create_intermediary_application', 'edit');
  const [form, setForm] = useState(initial);
  const [rms, setRms] = useState<Option[]>([]);
  const [banks, setBanks] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [selector, setSelector] = useState<'rm' | 'bank' | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateField, setDateField] = useState<'date_of_birth' | 'document_received_at' | null>(null);
  const set = (key: Field, value: string) => setForm(old => ({ ...old, [key]: value }));
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
  const submit = async () => {
    if (saving || !allowed) return;
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
      Alert.alert('Partner application submitted', 'Submitted to Operations for review. No POSP or MISP registration was created.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/policies') },
      ]);
    } catch (error) {
      Alert.alert('Unable to submit Partner', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };
  if (!allowed) return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.heading}>Add Partner</Text><Text>Employee Partner-onboarding permission required.</Text></View></SafeAreaView>;
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={21} color="#17365D" /></Pressable>
          <Text style={styles.heading}>Add Partner</Text><View style={{ width: 21 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {sections.map((section, index) => (
            <View key={section.heading} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <Text style={styles.sectionTitle}>{section.heading}</Text>
              </View>
              <View style={styles.sectionBody}>
                {index === 2 ? <View style={styles.field}><Text style={styles.label}>Bank *</Text>
                  <Pressable disabled={loading} accessibilityRole="button" onPress={() => setSelector('bank')} style={styles.select}>
                    <Text style={styles.selectText}>{banks.find(x => x.id === form.bank_id)?.name || (loading ? 'Loading banks…' : 'Select bank')}</Text>
                    <Ionicons name="chevron-down" size={17} color="#17365D" />
                  </Pressable></View> : null}
                {section.inputs.map(field => (
                  <View key={field.key}>
                    <View style={styles.field}>
                      <Text style={styles.label}>{field.label}{field.optional ? '' : ' *'}</Text>
                      {field.key === 'document_received_at' || field.key === 'date_of_birth' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Select ${field.label}`}
                          onPress={() => setDateField(field.key as 'date_of_birth' | 'document_received_at')} style={styles.select}>
                          <Text style={styles.selectText}>{form[field.key] || 'DD/MM/YYYY'}</Text>
                          <Ionicons name="calendar-outline" size={18} color="#17365D" />
                        </Pressable>
                      ) : (
                        <TextInput value={form[field.key]} onChangeText={text => set(field.key, text)}
                          placeholder={field.hint} placeholderTextColor="#8997A8"
                          keyboardType={field.keyboard || 'default'} secureTextEntry={Boolean(field.secret)}
                          autoCapitalize={field.key === 'email' ? 'none' : field.key === 'pan_number' || field.key === 'bank_ifsc_code' || field.key === 'gst_number' ? 'characters' : 'sentences'}
                          autoCorrect={false} maxLength={field.key === 'address' ? 300 : field.key === 'aadhaar_number' ? 12 : 150}
                          style={styles.input} />
                      )}
                    </View>
                    {field.key === 'document_received_at' ? <View style={[styles.field, { marginTop: 11 }]}>
                      <Text style={styles.label}>RM *</Text>
                      <Pressable disabled={loading} accessibilityRole="button" onPress={() => setSelector('rm')} style={styles.select}>
                        <Text style={styles.selectText}>{rms.find(x => x.id === form.associate_employee_id)?.name || (loading ? 'Loading RMs…' : 'Select RM')}</Text>
                        <Ionicons name="chevron-down" size={17} color="#17365D" />
                      </Pressable>
                    </View> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void submit()} style={[styles.submit, (saving || loading) && styles.disabled]}>
            <Text style={styles.submitText}>{saving ? 'Submitting…' : 'Submit Partner application'}</Text>
          </Pressable>
        </ScrollView>
        {dateField ? <DateTimePicker
          value={isoDate(form[dateField]) ? new Date(`${isoDate(form[dateField])}T12:00:00`) : new Date()}
          mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()} onChange={(_event, selectedDate) => setSelectedDate(selectedDate)}
        /> : null}
        <Modal visible={selector !== null} transparent animationType="slide" onRequestClose={() => setSelector(null)}>
          <View style={styles.modalBackdrop}><View style={styles.modal}>
            <Text style={styles.sectionTitle}>{selector === 'rm' ? 'Select RM' : 'Select Bank'}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {selectOptions.map(option => <Pressable key={option.id} accessibilityRole="button"
                onPress={() => { set(selector === 'rm' ? 'associate_employee_id' : 'bank_id', option.id); setSelector(null); }}
                style={[styles.option, option.id === selectedValue && styles.selectedOption]}>
                <Text style={styles.selectText}>{option.name}</Text>
              </Pressable>)}
            </ScrollView>
            <Pressable onPress={() => setSelector(null)} style={styles.cancel}><Text style={styles.selectText}>Cancel</Text></Pressable>
          </View></View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#F2F5FB' },
  header: { height: 54, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E0E6F0', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 17, color: '#152A49', fontWeight: '800' },
  content: { padding: 12, paddingBottom: 35, gap: 12 },
  section: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E1E7F1', borderRadius: 14, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#F9FBFD', borderBottomWidth: 1, borderBottomColor: '#E1E7F1' },
  index: { backgroundColor: '#17365D', borderRadius: 7, width: 33, height: 33, justifyContent: 'center', alignItems: 'center' },
  indexText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: '#172846', fontSize: 13, fontWeight: '800' },
  sectionBody: { padding: 12, gap: 11 },
  field: { gap: 5 }, label: { fontSize: 11, fontWeight: '700', color: '#33465D' },
  input: { minHeight: 44, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: '#152A49' },
  select: { minHeight: 44, borderWidth: 1, borderColor: '#CED8E7', borderRadius: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#17365D', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  submit: { backgroundColor: '#17365D', minHeight: 47, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFF', fontWeight: '800', fontSize: 13 }, disabled: { opacity: .55 },
  modalBackdrop: { flex: 1, backgroundColor: '#14233B88', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 12 },
  option: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#E7EDF5' },
  selectedOption: { backgroundColor: '#EAF3FF' }, cancel: { alignItems: 'center', padding: 12 },
});
