import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { supabase } from '@/lib/supabase';
import { usePartnerSession } from '@/providers/partner-session-provider';

type Kind = 'individual' | 'business';
type Field = 'name' | 'mobile' | 'email' | 'pan_number' | 'gst_number' | 'address' | 'city' | 'state' | 'postal_code';
const initial = { name: '', mobile: '', email: '', pan_number: '', gst_number: '', address: '', city: '', state: '', postal_code: '' };
const fields: Array<{ key: Field; label: string; hint: string; keyboard?: 'default' | 'phone-pad' | 'email-address' | 'number-pad'; optional?: boolean }> = [
  { key: 'name', label: 'Partner name', hint: 'Full name or business name' },
  { key: 'mobile', label: 'Mobile number', hint: '10-digit mobile', keyboard: 'phone-pad' },
  { key: 'email', label: 'Email address', hint: 'Partner email', keyboard: 'email-address' },
  { key: 'pan_number', label: 'PAN number', hint: 'ABCDE1234F' },
  { key: 'gst_number', label: 'GST number', hint: 'Optional GSTIN', optional: true },
  { key: 'address', label: 'Address', hint: 'Complete address' },
  { key: 'city', label: 'City', hint: 'City' },
  { key: 'state', label: 'State', hint: 'State' },
  { key: 'postal_code', label: 'PIN code', hint: '6-digit PIN', keyboard: 'number-pad' },
];

export default function AddPartnerScreen() {
  const router = useRouter();
  const { context } = usePartnerSession();
  const allowed = context?.identity.actor_kind === 'employee'
    && canPartnerAccess(context, 'create_intermediary_application', 'edit');
  const [kind, setKind] = useState<Kind>('individual');
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (key: Field, value: string) => setForm(old => ({ ...old, [key]: value }));
  const submit = async () => {
    if (saving || !allowed) return;
    const normalized = {
      ...form, partner_kind: kind,
      name: form.name.trim(), mobile: form.mobile.trim(), email: form.email.trim().toLowerCase(),
      pan_number: form.pan_number.trim().toUpperCase(), gst_number: form.gst_number.trim().toUpperCase(),
      postal_code: form.postal_code.trim(),
    };
    if (normalized.name.length < 2 || !/^[6-9][0-9]{9}$/.test(normalized.mobile)
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
      || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized.pan_number)
      || !normalized.address.trim() || !normalized.city.trim() || !normalized.state.trim()
      || !/^[0-9]{6}$/.test(normalized.postal_code)
      || (normalized.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized.gst_number))) {
      Alert.alert('Check Partner details', 'Enter all required information with a valid mobile, email, PAN and PIN.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error('Sign in again to continue.');
      const base = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
      const response = await fetch(`${base}/api/partner/onboarding/partner-only`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      });
      const result = await response.json() as { ok?: boolean; error?: string; application_id?: string };
      if (!response.ok || !result.ok || !result.application_id) {
        throw new Error(result.error || 'Partner application could not be submitted.');
      }
      Alert.alert('Partner application submitted', 'The Partner details were sent to Operations for review. No POSP or MISP account was created.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/policies') },
      ]);
    } catch (error) {
      Alert.alert('Unable to submit Partner', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };
  if (!allowed) return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.access}>
        <Text style={styles.heading}>Add Partner</Text>
        <Text style={styles.helper}>This action requires employee Partner-onboarding permission.</Text>
        <Pressable onPress={() => router.back()} style={styles.submit}><Text style={styles.submitText}>Go back</Text></Pressable>
      </View>
    </SafeAreaView>
  );
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={21} color="#17365D" />
          </Pressable>
          <Text style={styles.heading}>Add Partner</Text>
          <View style={{ width: 21 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.helper}>Create a Partner application for Operations review. This does not register a POSP or MISP.</Text>
          <Text style={styles.label}>Partner category</Text>
          <View style={styles.options}>
            {(['individual', 'business'] as const).map(value => (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: kind === value }}
                onPress={() => setKind(value)} style={[styles.choice, kind === value && styles.choiceActive]}>
                <Ionicons name={kind === value ? 'radio-button-on' : 'radio-button-off'} size={17} color={kind === value ? '#1757A7' : '#64748B'} />
                <Text style={styles.choiceText}>{value === 'individual' ? 'Individual Partner' : 'Business Partner'}</Text>
              </Pressable>
            ))}
          </View>
          {fields.map(field => (
            <View key={field.key} style={styles.field}>
              <Text style={styles.label}>{field.label}{field.optional ? ' (optional)' : ' *'}</Text>
              <TextInput
                value={form[field.key]} onChangeText={text => set(field.key, text)}
                placeholder={field.hint} placeholderTextColor="#8A9AAF"
                keyboardType={field.keyboard ?? 'default'} autoCapitalize={field.key === 'email' ? 'none' : field.key === 'pan_number' || field.key === 'gst_number' ? 'characters' : 'sentences'}
                autoCorrect={false} maxLength={field.key === 'address' ? 300 : field.key === 'name' ? 120 : 150}
                style={styles.input} />
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Submit Partner application" disabled={saving}
            onPress={() => void submit()} style={[styles.submit, saving && styles.disabled]}>
            <Text style={styles.submitText}>{saving ? 'Submitting…' : 'Submit Partner application'}</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9FD' },
  flex: { flex: 1 },
  header: { height: 54, paddingHorizontal: 18, backgroundColor: '#FFFFFF', borderBottomColor: '#DFE7F2', borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 17, fontWeight: '800', color: '#102846' },
  content: { padding: 18, paddingBottom: 32, gap: 9 },
  helper: { fontSize: 12, lineHeight: 19, color: '#536B88', marginBottom: 5 },
  options: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  choice: { flex: 1, borderColor: '#D8E3F1', borderWidth: 1, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  choiceActive: { backgroundColor: '#EAF3FF', borderColor: '#3271C5' },
  choiceText: { flexShrink: 1, color: '#183B66', fontSize: 11, fontWeight: '700' },
  field: { marginBottom: 5, gap: 5 },
  label: { fontSize: 11, fontWeight: '700', color: '#29415E' },
  input: { backgroundColor: '#FFFFFF', borderColor: '#D8E3F1', borderWidth: 1, borderRadius: 10, minHeight: 43, paddingHorizontal: 12, fontSize: 13, color: '#102846' },
  submit: { minHeight: 46, marginTop: 11, borderRadius: 10, backgroundColor: '#12396D', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  submitText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.5 },
  access: { flex: 1, padding: 22, justifyContent: 'center', gap: 15 },
});
