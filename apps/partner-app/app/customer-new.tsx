import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPartnerCustomer, type NewPartnerCustomer, type PartnerCustomerDocument } from '@/lib/customers';

const INITIAL: NewPartnerCustomer = {
  customer_name: '', mobile: '', email: '', street: '', locality: '', city: '', state: '', pin_code: '',
  pan_number: '', aadhaar_number: '', legal_trade_name: '', gst_registered: false,
};
type TextKey = Exclude<keyof NewPartnerCustomer, 'gst_registered'>;
const DOCUMENTS = [
  { key: 'pan_copy', label: 'PAN Copy' },
  { key: 'aadhaar_front', label: 'Aadhaar Front' },
  { key: 'aadhaar_back', label: 'Aadhaar Back' },
] as const;

export default function NewPartnerCustomerScreen() {
  const router = useRouter();
  const [form, setForm] = useState<NewPartnerCustomer>(INITIAL);
  const [documents, setDocuments] = useState<Partial<Record<PartnerCustomerDocument['type'], PartnerCustomerDocument>>>({});
  const [busy, setBusy] = useState(false);
  const set = (key: TextKey, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  async function selectDocument(type: PartnerCustomerDocument['type']) {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'application/pdf'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const file = picked.assets[0];
      if ((file.size ?? 0) > 5 * 1024 * 1024) { Alert.alert('File too large', 'Choose a file under 5 MB.'); return; }
      setDocuments(previous => ({ ...previous, [type]: { type, uri: file.uri, name: file.name, mimeType: file.mimeType ?? 'application/octet-stream', size: file.size ?? 0 } }));
    } catch { Alert.alert('File selection failed', 'Please try again.'); }
  }
  async function save() {
    if (busy) return;
    if (!form.customer_name.trim() || !/^[6-9]\\d{9}$/.test(form.mobile.trim())) {
      Alert.alert('Action required', 'Enter a customer name and valid 10-digit Indian mobile number.'); return;
    }
    if (form.email.trim() && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(form.email.trim())) {
      Alert.alert('Invalid email', 'Enter a valid email address or leave the field blank.'); return;
    }
    if (form.pin_code && !/^\\d{6}$/.test(form.pin_code.trim())) { Alert.alert('Invalid PIN', 'Enter a 6-digit PIN code.'); return; }
    if (form.pan_number && !/^[A-Z]{5}\\d{4}[A-Z]$/.test(form.pan_number.trim().toUpperCase())) { Alert.alert('Invalid PAN', 'Enter a valid PAN number.'); return; }
    if (form.aadhaar_number && !/^\\d{12}$/.test(form.aadhaar_number.replace(/\\s/g, ''))) { Alert.alert('Invalid Aadhaar', 'Enter a valid 12-digit Aadhaar number.'); return; }
    setBusy(true);
    try {
      const customerId = await createPartnerCustomer(form, Object.values(documents).filter((file): file is PartnerCustomerDocument => Boolean(file)));
      Alert.alert('Customer saved', 'The new customer has been added to your partner network.', [
        { text: 'View customer', onPress: () => router.replace({ pathname: '/customer/[id]', params: { id: customerId } } as never) },
      ]);
    } catch (error) {
      Alert.alert('Unable to save customer', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  }
  function field(label: string, key: TextKey, placeholder: string, options?: { keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric'; autoCapitalize?: 'none' | 'characters' }) {
    return <View style={styles.field} key={key}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={form[key]} onChangeText={value => set(key, value)} placeholder={placeholder} placeholderTextColor="#95A2B5" keyboardType={options?.keyboardType ?? 'default'} autoCapitalize={options?.autoCapitalize ?? 'sentences'} editable={!busy} /></View>;
  }
  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={24} color="#FFF" /></Pressable><View><Text style={styles.title}>New Customer</Text><Text style={styles.subtitle}>Add a customer to your partner network</Text></View></View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.card}><Text style={styles.section}>Personal Information</Text>
          {field('Customer / Proprietor Name *', 'customer_name', 'Enter customer name')}
          {field('Mobile Number *', 'mobile', '10-digit mobile number', { keyboardType: 'phone-pad' })}
          {field('Email ID', 'email', 'Optional email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
        </View>
        <View style={styles.card}><Text style={styles.section}>Address Details</Text>
          {field('Street', 'street', 'House, building or street')}
          {field('Locality', 'locality', 'Area or locality')}
          <View style={styles.two}>{field('City', 'city', 'City')}{field('State', 'state', 'State')}</View>
          {field('PIN Code', 'pin_code', '6-digit PIN', { keyboardType: 'numeric' })}
        </View>
        <View style={styles.card}>
          <View style={styles.sectionRow}><Text style={styles.section}>KYC and GST Details</Text><View style={styles.gst}><Text style={styles.gstLabel}>GST Registered</Text><Switch value={form.gst_registered} onValueChange={value => setForm(previous => ({ ...previous, gst_registered: value }))} disabled={busy} /></View></View>
          {field('PAN Number', 'pan_number', 'ABCDE1234F', { autoCapitalize: 'characters' })}
          {field('Aadhaar Number', 'aadhaar_number', '12-digit Aadhaar number', { keyboardType: 'numeric' })}
          {field('Legal Trade Name', 'legal_trade_name', 'Optional')}
        </View>
        <View style={styles.card}><Text style={styles.section}>Documents</Text>
          {DOCUMENTS.map(doc => <Pressable key={doc.key} accessibilityRole="button" onPress={() => void selectDocument(doc.key)} disabled={busy} style={styles.document}><Ionicons name="document-attach-outline" size={21} color="#245FB0"/><View style={styles.documentText}><Text style={styles.documentTitle}>{doc.label}</Text><Text numberOfLines={1} style={styles.documentHint}>{documents[doc.key]?.name ?? 'Choose file • Optional • PDF / JPG / PNG'}</Text></View><Ionicons name={documents[doc.key] ? 'checkmark-circle' : 'cloud-upload-outline'} size={20} color={documents[doc.key] ? '#16865B' : '#245FB0'} /></Pressable>)}
        </View>
      </ScrollView>
      <View style={styles.footer}><Pressable onPress={() => router.back()} disabled={busy} style={[styles.button, styles.cancel]}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={() => void save()} disabled={busy} style={[styles.button, styles.save]}>{busy ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="checkmark" size={18} color="#FFF"/><Text style={styles.saveText}>Save Customer</Text></>}</Pressable></View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F6FC' }, flex: { flex: 1 },
  header: { backgroundColor: '#092755', paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { padding: 5 }, title: { color: '#FFF', fontSize: 19, fontWeight: '800' }, subtitle: { color: '#D7E7FC', fontSize: 11, marginTop: 3 },
  content: { padding: 13, paddingBottom: 28, gap: 12 }, card: { backgroundColor: '#FFF', borderRadius: 16, padding: 15, gap: 11, borderWidth: 1, borderColor: '#E1E8F3' },
  section: { fontSize: 14, fontWeight: '800', color: '#102C5B' }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  field: { flex: 1, gap: 5, minWidth: 110 }, label: { fontSize: 11, fontWeight: '600', color: '#34445F' },
  input: { minHeight: 45, borderWidth: 1, borderColor: '#CBD7E7', borderRadius: 9, paddingHorizontal: 12, fontSize: 13, color: '#14294D', backgroundColor: '#FFF' },
  two: { flexDirection: 'row', gap: 9 }, gst: { flexDirection: 'row', alignItems: 'center', gap: 4 }, gstLabel: { fontSize: 10, color: '#41516A' },
  document: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D9E5F4', backgroundColor: '#F8FAFE' },
  documentText: { flex: 1 }, documentTitle: { fontSize: 12, fontWeight: '700', color: '#14294D' }, documentHint: { fontSize: 10, color: '#7B8BA4', marginTop: 3 },
  footer: { backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#DEE6F1' },
  button: { flex: 1, minHeight: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  cancel: { borderWidth: 1, borderColor: '#BAC8DB' }, cancelText: { fontWeight: '700', color: '#33455D' },
  save: { backgroundColor: '#315FEE' }, saveText: { fontWeight: '700', color: '#FFF' },
});
