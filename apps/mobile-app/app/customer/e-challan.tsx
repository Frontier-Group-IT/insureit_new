import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { getCurrentSession, getCustomerForUser, getProfile } from '@/lib/auth';
import {
  requestGuestEnquiryOtp,
  submitCustomerServiceEnquiry,
  submitGuestServiceEnquiry,
  verifyGuestEnquiryOtp,
  type ServiceEnquirySource,
} from '@/lib/service-enquiries';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Customer, Profile, Vehicle } from '@/lib/types';

export default function EChallanScreen() {
  const router = useRouter();
  const { source: routeSource } = useLocalSearchParams<{ source?: ServiceEnquirySource }>();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [note, setNote] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [consentAttention, setConsentAttention] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [reference, setReference] = useState('');

  const source: ServiceEnquirySource = isSignedIn ? 'customer_dashboard' : routeSource === 'guest_signup' ? 'guest_signup' : 'guest_login';
  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const session = await getCurrentSession();
      if (!active) return;
      setIsSignedIn(Boolean(session?.user));
      if (!session?.user) return;

      const [nextProfile, nextCustomer] = await Promise.all([getProfile(session.user.id), getCustomerForUser(session.user.id)]);
      if (!active) return;
      setProfile(nextProfile);
      setCustomer(nextCustomer);
      if (!nextCustomer) return;

      const { data } = await supabase.from('vehicles').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false });
      if (!active) return;
      const list = data ?? [];
      setVehicles(list);
      if (list[0]) {
        setSelectedVehicleId(list[0].id);
        setVehicleNo(formatVehicleNo(list[0].vehicle_no));
      }
    })();
    return () => { active = false; };
  }, []);

  function resetVerification(nextMobile: string) {
    setMobile(normalizeMobile(nextMobile));
    setChallengeId('');
    setVerificationToken('');
    setOtp('');
  }

  async function sendOtp() {
    if (normalizeMobile(mobile).length !== 10) return setMessage({ type: 'error', text: 'Enter a valid 10 digit mobile number.' });
    setBusy(true); setMessage(null);
    try {
      const result = await requestGuestEnquiryOtp(mobile);
      setChallengeId(result.challengeId);
      setMessage({ type: 'info', text: 'OTP sent. Enter the 6 digit code.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not send OTP.' });
    } finally { setBusy(false); }
  }

  async function verifyOtp() {
    if (otp.length !== 6 || !challengeId) return setMessage({ type: 'error', text: 'Enter the 6 digit OTP.' });
    setBusy(true); setMessage(null);
    try {
      const token = await verifyGuestEnquiryOtp(challengeId, otp);
      setVerificationToken(token);
      setMessage({ type: 'success', text: 'Mobile verified.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not verify OTP.' });
    } finally { setBusy(false); }
  }

  function chooseVehicle(vehicle: Vehicle) {
    setSelectedVehicleId(vehicle.id);
    setVehicleNo(formatVehicleNo(vehicle.vehicle_no));
  }

  async function submit() {
    if (busy || reference) return;

    if (!consentAccepted) {
      setConsentAttention(true);
      return setMessage({ type: 'error', text: 'Please accept the terms to continue.' });
    }

    const cleanVehicle = normalizeVehicle(vehicleNo);
    if (cleanVehicle.length < 6) return setMessage({ type: 'error', text: 'Enter a valid vehicle number.' });
    if (!isSignedIn) {
      if (fullName.trim().length < 2) return setMessage({ type: 'error', text: 'Enter your full name.' });
      if (!verificationToken) return setMessage({ type: 'error', text: 'Verify your mobile number first.' });
    }
    if (isSignedIn && (!customer || !profile)) return setMessage({ type: 'error', text: 'Customer details are still loading. Please try again.' });

    const description = [
      `Vehicle: ${cleanVehicle}.`,
      challanNo.trim() ? `Challan/reference: ${challanNo.trim()}.` : '',
      note.trim() ? `Note: ${note.trim()}` : 'Customer requested challan assistance.',
    ].filter(Boolean).join(' ');

    setBusy(true); setMessage({ type: 'info', text: 'Sending your request…' });
    try {
      const consent = { consentAccepted: true as const, whatsappOptIn };
      const result = isSignedIn
        ? await submitCustomerServiceEnquiry({
            serviceType: 'challan_assistance',
            customerId: customer!.id,
            profileId: profile!.id,
            vehicleId: selectedVehicle?.id ?? null,
            vehicleNo: cleanVehicle,
            subject: `Challan assistance - ${cleanVehicle}`,
            description,
            details: { challanNo: challanNo.trim() || null, note: note.trim() || null },
            consent,
          })
        : await submitGuestServiceEnquiry({
            challengeId,
            verificationToken,
            serviceType: 'challan_assistance',
            source: source as 'guest_login' | 'guest_signup',
            guestName: fullName.trim(),
            guestEmail: email.trim() || undefined,
            vehicleNo: cleanVehicle,
            subject: `Challan assistance - ${cleanVehicle}`,
            description,
            details: { challanNo: challanNo.trim() || null, note: note.trim() || null },
            consent,
          });

      setReference(result.enquiry_no);
      setMessage({ type: 'success', text: 'Challan request received. Our team will contact you shortly.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not send your request.' });
    } finally { setBusy(false); }
  }

  function goBack() {
    router.replace(isSignedIn ? '/customer/home' : source === 'guest_signup' ? '/signup' : '/login');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={goBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialCommunityIcons name="chevron-left" size={24} color={palette.navy} /></Pressable>
        <View style={styles.brand}><BrandLogo width={142} /></View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEyebrow}>CHALLAN ASSISTANCE</Text>
          <Text style={styles.heroTitle}>Pay Challan</Text>
          <Text style={styles.heroSubtitle}>Share your vehicle details and we’ll help you with the right next step.</Text>
          <View style={styles.heroActionRow}>
            <View style={styles.heroPill}><MaterialCommunityIcons name="shield-check-outline" size={15} color="#A9C8FF" /><Text style={styles.heroPillText}>Secure request</Text></View>
            <View style={styles.heroPill}><MaterialCommunityIcons name="headset" size={15} color="#A9C8FF" /><Text style={styles.heroPillText}>Assisted support</Text></View>
          </View>
        </View>

        {!isSignedIn ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your details</Text>
            <TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor="#8A94A6" style={styles.input} />
            <View style={styles.row}>
              <TextInput value={mobile} onChangeText={resetVerification} keyboardType="number-pad" maxLength={10} placeholder="Mobile number" placeholderTextColor="#8A94A6" style={[styles.input, styles.flex]} />
              <Pressable disabled={busy} onPress={() => void sendOtp()} style={({ pressed }) => [styles.smallButton, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.smallButtonText}>{challengeId ? 'Resend' : 'Send OTP'}</Text></Pressable>
            </View>
            {challengeId && !verificationToken ? <View style={styles.row}><TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="6 digit OTP" placeholderTextColor="#8A94A6" style={[styles.input, styles.flex]} /><Pressable disabled={busy} onPress={() => void verifyOtp()} style={({ pressed }) => [styles.smallButton, styles.greenButton, pressed && styles.pressed, busy && styles.disabled]}><Text style={styles.smallButtonText}>Verify</Text></Pressable></View> : null}
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email (optional)" placeholderTextColor="#8A94A6" style={styles.input} />
          </View>
        ) : (
          <View style={styles.customerStrip}><MaterialCommunityIcons name="account-check-outline" size={19} color="#0F9F6E" /><Text style={styles.customerStripText}>We’ll use your registered contact details for this request.</Text></View>
        )}

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Vehicle registration number</Text>
          <View style={styles.registrationInput}>
            <View style={styles.indBadge}><MaterialCommunityIcons name="circle-slice-8" size={14} color="#0B63CE" /><Text style={styles.indText}>IND</Text></View>
            <TextInput value={vehicleNo} onChangeText={(v) => { setVehicleNo(formatVehicleNo(v)); setSelectedVehicleId(''); }} autoCapitalize="characters" placeholder="MP-20-CB-1234" placeholderTextColor="#8A94A6" style={styles.registrationTextInput} />
          </View>
          {isSignedIn && vehicles.length ? <View style={styles.chips}>{vehicles.slice(0, 5).map((vehicle) => <Pressable key={vehicle.id} onPress={() => chooseVehicle(vehicle)} style={({ pressed }) => [styles.chip, selectedVehicleId === vehicle.id && styles.chipActive, pressed && styles.pressed]}><Text style={styles.chipText}>{vehicle.vehicle_no}</Text></Pressable>)}</View> : null}

          <TextInput value={challanNo} onChangeText={setChallanNo} placeholder="Challan / reference number (optional)" placeholderTextColor="#8A94A6" style={styles.input} />
          <TextInput value={note} onChangeText={setNote} multiline textAlignVertical="top" placeholder="Add a note (optional)" placeholderTextColor="#8A94A6" style={[styles.input, styles.note]} />
        </View>

        <View style={[styles.consentCard, consentAttention && !consentAccepted && styles.consentCardAttention]}>
          <ConsentRow checked={consentAccepted} onPress={() => { setConsentAccepted((v) => !v); setConsentAttention(false); }} label="I agree to the Terms of Use, Privacy Policy and authorize INSUREIT to contact me about this challan request." />
          <View style={styles.linkRow}><Text onPress={() => router.push(isSignedIn ? '/customer/legal/terms-of-use' : '/legal/terms-of-use')} style={styles.link}>Terms of Use</Text><Text style={styles.dot}>•</Text><Text onPress={() => router.push(isSignedIn ? '/customer/legal/privacy-policy' : '/legal/privacy-policy')} style={styles.link}>Privacy Policy</Text></View>
          <View style={styles.divider} />
          <ConsentRow checked={whatsappOptIn} onPress={() => setWhatsappOptIn((v) => !v)} label="Send updates about this request on WhatsApp." optional />
          <Text style={styles.disclaimer}>Challan details, penalties and payment status are governed by the relevant traffic or government authority. INSUREIT provides assistance and coordination only.</Text>
        </View>

        {message ? <View style={[styles.message, message.type === 'error' ? styles.error : message.type === 'success' ? styles.success : styles.info]}><Text style={styles.messageText}>{message.text}</Text></View> : null}

        {reference ? (
          <View style={styles.doneCard}><MaterialCommunityIcons name="check-circle" size={28} color="#0F9F6E" /><Text style={styles.doneTitle}>Request received</Text><Text style={styles.reference}>{reference}</Text><Text style={styles.doneText}>Our team will contact you with the next step.</Text><Pressable onPress={() => router.replace(isSignedIn ? '/customer/support' : source === 'guest_signup' ? '/signup' : '/login')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{isSignedIn ? 'View in Support' : 'Done'}</Text></Pressable></View>
        ) : (
          <Pressable disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed, busy && styles.disabled]}><Text style={styles.primaryButtonText}>{busy ? 'Sending request…' : 'Get Challan Assistance'}</Text></Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ConsentRow({ checked, onPress, label, optional }: { checked: boolean; onPress: () => void; label: string; optional?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}><MaterialCommunityIcons name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={23} color={checked ? '#0F9F9A' : '#7B8798'} /><Text style={styles.consentText}>{label}{optional ? <Text style={styles.optional}> Optional</Text> : null}</Text></Pressable>;
}
function normalizeMobile(value: string) { return value.replace(/\D/g, '').slice(0, 10); }
function normalizeVehicle(value: string) { return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
function formatVehicleNo(value: string) {
  const raw = normalizeVehicle(value);
  const state = raw.slice(0, 2).replace(/[^A-Z]/g, '');
  const district = raw.slice(2, 4).replace(/[^0-9]/g, '');
  const series = raw.slice(4, 6).replace(/[^A-Z]/g, '');
  const number = raw.slice(6, 10).replace(/[^0-9]/g, '');
  return [state, district, series, number].filter(Boolean).join('-');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4FAFF' },
  header: { height: 62, paddingHorizontal: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E4EBF3', flexDirection: 'row', alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFD' },
  brand: { flex: 1, alignItems: 'center' }, headerSpacer: { width: 40 },
  body: { padding: 14, gap: 10, paddingBottom: 30 },
  hero: { minHeight: 176, borderRadius: 22, backgroundColor: palette.navy, padding: 18, overflow: 'hidden', justifyContent: 'center' },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -55, top: -65, backgroundColor: '#163F79', opacity: 0.9 },
  heroEyebrow: { color: '#AFCBFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }, heroTitle: { color: '#FFFFFF', fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 5 }, heroSubtitle: { color: '#D6E5F8', fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 6, maxWidth: 280 },
  heroActionRow: { flexDirection: 'row', gap: 7, marginTop: 15 }, heroPill: { minHeight: 30, borderRadius: 999, paddingHorizontal: 9, backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 5 }, heroPillText: { color: '#EAF2FF', fontSize: 9.5, fontWeight: '800' },
  card: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 12, gap: 9 },
  customerStrip: { borderRadius: 15, backgroundColor: '#F2FBF6', borderWidth: 1, borderColor: '#C7EAD7', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }, customerStripText: { flex: 1, color: '#516477', fontSize: 10.5, fontWeight: '700' },
  sectionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D8E4F0', backgroundColor: '#FAFCFF', paddingHorizontal: 11, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 },
  smallButton: { minWidth: 92, borderRadius: 13, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, greenButton: { backgroundColor: '#0F9F6E' }, smallButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  formCard: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 13, gap: 10 },
  formLabel: { color: palette.navy, fontSize: 12, fontWeight: '900' },
  registrationInput: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#C9D8E8', backgroundColor: '#FAFCFF', flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' },
  indBadge: { width: 58, backgroundColor: '#F1F5F9', borderRightWidth: 1, borderRightColor: '#D8E4F0', alignItems: 'center', justifyContent: 'center', gap: 2 }, indText: { color: '#536477', fontSize: 10, fontWeight: '900' },
  registrationTextInput: { flex: 1, paddingHorizontal: 12, color: palette.navy, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: '#D8E4F0', backgroundColor: '#FFFFFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: '#86D7D1', backgroundColor: '#ECFAF8' }, chipText: { color: palette.navy, fontSize: 10, fontWeight: '900' },
  note: { minHeight: 72, paddingTop: 10 },
  consentCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 12, gap: 8 }, consentCardAttention: { borderColor: '#E26A5C', backgroundColor: '#FFF9F8' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, consentText: { flex: 1, color: '#4F5F73', fontSize: 10.5, lineHeight: 15, fontWeight: '700' }, optional: { color: '#8A94A6', fontWeight: '800' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 31 }, link: { color: '#0B63CE', fontSize: 10, fontWeight: '900', textDecorationLine: 'underline' }, dot: { color: '#98A3B3', fontSize: 10 }, divider: { height: 1, backgroundColor: '#EEF2F6', marginVertical: 2 }, disclaimer: { color: '#7B8798', fontSize: 9.2, lineHeight: 13, fontWeight: '700', marginLeft: 31 },
  message: { borderRadius: 13, padding: 10, borderWidth: 1 }, error: { backgroundColor: '#FFF4F2', borderColor: '#FFD1CB' }, success: { backgroundColor: '#F1FBF6', borderColor: '#BFE8D4' }, info: { backgroundColor: '#F2F7FF', borderColor: '#CFE0FF' }, messageText: { color: '#536477', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: '#0F9F9A', alignItems: 'center', justifyContent: 'center' }, primaryPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  doneCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDE7D9', padding: 16, alignItems: 'center', gap: 5 }, doneTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' }, reference: { color: '#0F7A54', fontSize: 13, fontWeight: '900' }, doneText: { color: '#66758A', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { marginTop: 7, minHeight: 40, borderRadius: 12, paddingHorizontal: 18, backgroundColor: '#ECFAF8', alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: '#0F8F8A', fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
});
