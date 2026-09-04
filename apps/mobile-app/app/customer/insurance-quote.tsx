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

type QuoteNeed = 'renewal' | 'new_policy' | 'change_insurer' | 'other';

const needs: Array<{ key: QuoteNeed; label: string }> = [
  { key: 'renewal', label: 'Renewal' },
  { key: 'new_policy', label: 'New policy' },
  { key: 'change_insurer', label: 'Change insurer' },
  { key: 'other', label: 'Other' },
];

export default function InsuranceQuoteScreen() {
  const router = useRouter();
  const { source: routeSource } = useLocalSearchParams<{ source?: ServiceEnquirySource }>();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [isNewVehicle, setIsNewVehicle] = useState(false);
  const [newVehicleDetails, setNewVehicleDetails] = useState('');
  const [need, setNeed] = useState<QuoteNeed>('renewal');
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
    setIsNewVehicle(false);
  }

  async function submit() {
    if (busy || reference) return;

    if (!consentAccepted) {
      setConsentAttention(true);
      return setMessage({ type: 'error', text: 'Please accept the terms to continue.' });
    }

    const cleanVehicle = normalizeVehicle(vehicleNo);
    if (isNewVehicle && newVehicleDetails.trim().length < 3) return setMessage({ type: 'error', text: 'Enter the vehicle make or model.' });
    if (!isNewVehicle && cleanVehicle.length < 6) return setMessage({ type: 'error', text: 'Enter a valid vehicle number.' });
    if (!isSignedIn) {
      if (fullName.trim().length < 2) return setMessage({ type: 'error', text: 'Enter your full name.' });
      if (!verificationToken) return setMessage({ type: 'error', text: 'Verify your mobile number first.' });
    }
    if (isSignedIn && (!customer || !profile)) return setMessage({ type: 'error', text: 'Customer details are still loading. Please try again.' });

    const needLabel = needs.find((item) => item.key === need)?.label ?? 'Quote';
    const description = [
      `Requirement: ${needLabel}.`,
      isNewVehicle ? `New vehicle: ${newVehicleDetails.trim()}.` : `Vehicle: ${cleanVehicle}.`,
      note.trim() ? `Note: ${note.trim()}` : '',
    ].filter(Boolean).join(' ');

    setBusy(true); setMessage({ type: 'info', text: 'Sending your request…' });
    try {
      const consent = { consentAccepted: true as const, whatsappOptIn };
      const result = isSignedIn
        ? await submitCustomerServiceEnquiry({
            serviceType: 'insurance_quote',
            customerId: customer!.id,
            profileId: profile!.id,
            vehicleId: selectedVehicle?.id ?? null,
            vehicleNo: isNewVehicle ? null : cleanVehicle,
            subject: `Insurance quote - ${isNewVehicle ? 'new vehicle' : cleanVehicle}`,
            description,
            details: { quoteNeed: need, newVehicle: isNewVehicle, vehicleDetails: newVehicleDetails.trim() || null, note: note.trim() || null },
            consent,
          })
        : await submitGuestServiceEnquiry({
            challengeId,
            verificationToken,
            serviceType: 'insurance_quote',
            source: source as 'guest_login' | 'guest_signup',
            guestName: fullName.trim(),
            guestEmail: email.trim() || undefined,
            vehicleNo: isNewVehicle ? '' : cleanVehicle,
            subject: `Insurance quote - ${isNewVehicle ? 'new vehicle' : cleanVehicle}`,
            description,
            details: { quoteNeed: need, newVehicle: isNewVehicle, vehicleDetails: newVehicleDetails.trim() || null, note: note.trim() || null },
            consent,
          });

      setReference(result.enquiry_no);
      setMessage({ type: 'success', text: 'Quote request received. Our team will contact you shortly.' });
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
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><MaterialCommunityIcons name="shield-check-outline" size={27} color="#D6E5F8" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>Get Insurance Quote</Text>
              <Text style={styles.subtitle}>Share your vehicle details and we’ll help you with suitable options.</Text>
            </View>
          </View>
          <View style={styles.benefits}>
            <Benefit icon="truck-outline" label="Commercial vehicle cover" />
            <Benefit icon="calendar-refresh-outline" label="Renewal assistance" />
            <Benefit icon="headset" label="Expert callback" />
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
          <View style={styles.customerStrip}><MaterialCommunityIcons name="account-check-outline" size={19} color={palette.navy} /><Text style={styles.customerStripText}>We’ll use your registered contact details for this request.</Text></View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vehicle</Text>
          <View style={styles.segment}>
            <Pressable onPress={() => setIsNewVehicle(false)} style={({ pressed }) => [styles.segmentItem, !isNewVehicle && styles.segmentActive, pressed && styles.pressed]}><Text style={[styles.segmentText, !isNewVehicle && styles.segmentTextActive]}>Registered</Text></Pressable>
            <Pressable onPress={() => { setIsNewVehicle(true); setSelectedVehicleId(''); setVehicleNo(''); }} style={({ pressed }) => [styles.segmentItem, isNewVehicle && styles.segmentActive, pressed && styles.pressed]}><Text style={[styles.segmentText, isNewVehicle && styles.segmentTextActive]}>Brand new</Text></Pressable>
          </View>

          {isNewVehicle ? (
            <TextInput value={newVehicleDetails} onChangeText={setNewVehicleDetails} placeholder="Vehicle make / model" placeholderTextColor="#8A94A6" style={styles.input} />
          ) : (
            <>
              <TextInput value={vehicleNo} onChangeText={(v) => { setVehicleNo(formatVehicleNo(v)); setSelectedVehicleId(''); }} autoCapitalize="characters" placeholder="Vehicle registration number" placeholderTextColor="#8A94A6" style={styles.input} />
              {isSignedIn && vehicles.length ? <View style={styles.chips}>{vehicles.slice(0, 5).map((vehicle) => <Pressable key={vehicle.id} onPress={() => chooseVehicle(vehicle)} style={({ pressed }) => [styles.chip, selectedVehicleId === vehicle.id && styles.chipActive, pressed && styles.pressed]}><Text style={styles.chipText}>{vehicle.vehicle_no}</Text></Pressable>)}</View> : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quote requirement</Text>
          <View style={styles.chips}>{needs.map((item) => <Pressable key={item.key} onPress={() => setNeed(item.key)} style={({ pressed }) => [styles.needChip, need === item.key && styles.needChipActive, pressed && styles.pressed]}><Text style={[styles.needText, need === item.key && styles.needTextActive]}>{item.label}</Text></Pressable>)}</View>
          <TextInput value={note} onChangeText={setNote} multiline textAlignVertical="top" placeholder="Add a note (optional)" placeholderTextColor="#8A94A6" style={[styles.input, styles.note]} />
        </View>

        <View style={[styles.consentCard, consentAttention && !consentAccepted && styles.consentCardAttention]}>
          <ConsentRow checked={consentAccepted} onPress={() => { setConsentAccepted((v) => !v); setConsentAttention(false); }} label="I agree to the Terms of Use, Privacy Policy and authorize INSUREIT to contact me about this insurance request." />
          <View style={styles.linkRow}><Text onPress={() => router.push(isSignedIn ? '/customer/legal/terms-of-use' : '/legal/terms-of-use')} style={styles.link}>Terms of Use</Text><Text style={styles.dot}>•</Text><Text onPress={() => router.push(isSignedIn ? '/customer/legal/privacy-policy' : '/legal/privacy-policy')} style={styles.link}>Privacy Policy</Text></View>
          <View style={styles.divider} />
          <ConsentRow checked={whatsappOptIn} onPress={() => setWhatsappOptIn((v) => !v)} label="Send updates about this request on WhatsApp." optional />
          <Text style={styles.disclaimer}>Final premium, coverage and policy issuance are subject to insurer underwriting, submitted information and applicable policy terms.</Text>
        </View>

        {message ? <View style={[styles.message, message.type === 'error' ? styles.error : message.type === 'success' ? styles.success : styles.info]}><Text style={styles.messageText}>{message.text}</Text></View> : null}

        {reference ? (
          <View style={styles.doneCard}><MaterialCommunityIcons name="check-circle" size={28} color="#0F9F6E" /><Text style={styles.doneTitle}>Quote request received</Text><Text style={styles.reference}>{reference}</Text><Text style={styles.doneText}>We’ll contact you shortly.</Text><Pressable onPress={() => router.replace(isSignedIn ? '/customer/support' : source === 'guest_signup' ? '/signup' : '/login')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{isSignedIn ? 'View in Support' : 'Done'}</Text></Pressable></View>
        ) : (
          <Pressable disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed, busy && styles.disabled]}><Text style={styles.primaryButtonText}>{busy ? 'Sending request…' : 'Get Quote'}</Text></Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ icon, label }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  return <View style={styles.benefit}><MaterialCommunityIcons name={icon} size={17} color="#A9C8FF" /><Text style={styles.benefitText}>{label}</Text></View>;
}
function ConsentRow({ checked, onPress, label, optional }: { checked: boolean; onPress: () => void; label: string; optional?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}><MaterialCommunityIcons name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={23} color={checked ? palette.navy : '#7B8798'} /><Text style={styles.consentText}>{label}{optional ? <Text style={styles.optional}> Optional</Text> : null}</Text></Pressable>;
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
  hero: { borderRadius: 22, backgroundColor: palette.navy, borderWidth: 1, borderColor: palette.navy, padding: 15, overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -65, top: -85, backgroundColor: '#163F79' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' }, subtitle: { color: '#D6E5F8', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  benefits: { flexDirection: 'row', gap: 6, marginTop: 14 }, benefit: { flex: 1, minHeight: 58, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 7, alignItems: 'center', justifyContent: 'center', gap: 4 }, benefitText: { color: '#FFFFFF', fontSize: 8.8, lineHeight: 12, textAlign: 'center', fontWeight: '800' },
  card: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 12, gap: 9 },
  customerStrip: { borderRadius: 15, backgroundColor: '#F3F6FA', borderWidth: 1, borderColor: '#CBD7E6', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }, customerStripText: { flex: 1, color: '#516477', fontSize: 10.5, fontWeight: '700' },
  sectionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D8E4F0', backgroundColor: '#FAFCFF', paddingHorizontal: 11, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 },
  smallButton: { minWidth: 92, borderRadius: 13, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, greenButton: { backgroundColor: palette.navy }, smallButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: '#F1F5F9' }, segmentItem: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: '#FFFFFF' }, segmentText: { color: '#77859A', fontSize: 11, fontWeight: '900' }, segmentTextActive: { color: palette.navy },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: '#D8E4F0', backgroundColor: '#FFFFFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: '#8FAAD0', backgroundColor: '#EAF2FF' }, chipText: { color: palette.navy, fontSize: 10, fontWeight: '900' },
  needChip: { minHeight: 35, borderRadius: 11, borderWidth: 1, borderColor: '#D8E4F0', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFCFF' }, needChipActive: { backgroundColor: palette.navy, borderColor: palette.navy }, needText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, needTextActive: { color: '#FFFFFF' }, note: { minHeight: 72, paddingTop: 10 },
  consentCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 12, gap: 8 }, consentCardAttention: { borderColor: '#E26A5C', backgroundColor: '#FFF9F8' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, consentText: { flex: 1, color: '#4F5F73', fontSize: 10.5, lineHeight: 15, fontWeight: '700' }, optional: { color: '#8A94A6', fontWeight: '800' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 31 }, link: { color: palette.navy, fontSize: 10, fontWeight: '900', textDecorationLine: 'underline' }, dot: { color: '#98A3B3', fontSize: 10 }, divider: { height: 1, backgroundColor: '#EEF2F6', marginVertical: 2 }, disclaimer: { color: '#7B8798', fontSize: 9.2, lineHeight: 13, fontWeight: '700', marginLeft: 31 },
  message: { borderRadius: 13, padding: 10, borderWidth: 1 }, error: { backgroundColor: '#FFF4F2', borderColor: '#FFD1CB' }, success: { backgroundColor: '#F1FBF6', borderColor: '#BFE8D4' }, info: { backgroundColor: '#F2F7FF', borderColor: '#CFE0FF' }, messageText: { color: '#536477', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' }, primaryPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  doneCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDE7D9', padding: 16, alignItems: 'center', gap: 5 }, doneTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' }, reference: { color: '#0F7A54', fontSize: 13, fontWeight: '900' }, doneText: { color: '#66758A', fontSize: 10.5, fontWeight: '700' },
  secondaryButton: { marginTop: 7, minHeight: 40, borderRadius: 12, paddingHorizontal: 18, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: palette.navy, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
});