import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
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

type QuoteNeed = 'new_policy' | 'renewal' | 'change_insurer' | 'other';

const quoteNeeds: Array<{ key: QuoteNeed; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'new_policy', label: 'New insurance', icon: 'shield-plus-outline' },
  { key: 'renewal', label: 'Renewal', icon: 'calendar-refresh-outline' },
  { key: 'change_insurer', label: 'Change insurer', icon: 'swap-horizontal' },
  { key: 'other', label: 'Other', icon: 'message-question-outline' },
];

export default function InsuranceQuoteScreen() {
  const router = useRouter();
  const { vehicleNo: prefilledVehicleNo, source: routeSource } = useLocalSearchParams<{ vehicleNo?: string; source?: ServiceEnquirySource }>();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [newVehicle, setNewVehicle] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [quoteNeed, setQuoteNeed] = useState<QuoteNeed>('renewal');
  const [note, setNote] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [reference, setReference] = useState('');

  const source: ServiceEnquirySource = isSignedIn ? 'customer_dashboard' : routeSource === 'guest_signup' ? 'guest_signup' : 'guest_login';

  useEffect(() => {
    let active = true;
    async function load() {
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
      const nextVehicles = data ?? [];
      setVehicles(nextVehicles);
      const routed = typeof prefilledVehicleNo === 'string'
        ? nextVehicles.find((item) => normalizeVehicle(item.vehicle_no) === normalizeVehicle(prefilledVehicleNo))
        : null;
      const first = routed ?? nextVehicles[0] ?? null;
      if (first) {
        setSelectedVehicleId(first.id);
        setVehicleNo(formatVehicleNo(first.vehicle_no));
      }
    }
    void load();
    return () => { active = false; };
  }, [prefilledVehicleNo]);

  useEffect(() => {
    if (!isSignedIn && typeof prefilledVehicleNo === 'string' && prefilledVehicleNo.trim()) {
      setVehicleNo(formatVehicleNo(prefilledVehicleNo));
    }
  }, [isSignedIn, prefilledVehicleNo]);

  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const guestVerified = Boolean(challengeId && verificationToken);

  function selectVehicle(vehicle: Vehicle) {
    setSelectedVehicleId(vehicle.id);
    setVehicleNo(formatVehicleNo(vehicle.vehicle_no));
    setNewVehicle(false);
  }

  function toggleNewVehicle() {
    const next = !newVehicle;
    setNewVehicle(next);
    if (next) {
      setSelectedVehicleId('');
      setVehicleNo('');
    }
  }

  async function sendOtp() {
    const normalized = normalizeMobile(mobile);
    if (normalized.length !== 10) return setMessage({ tone: 'error', text: 'Enter a valid 10 digit mobile number.' });
    setBusy(true); setMessage(null); setVerificationToken(''); setOtp('');
    try {
      const result = await requestGuestEnquiryOtp(normalized);
      setChallengeId(result.challengeId);
      setMaskedPhone(result.maskedPhone);
      setMessage({ tone: 'info', text: 'OTP sent. Enter the 6 digit code to verify your mobile number.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not send OTP.' });
    } finally { setBusy(false); }
  }

  async function verifyOtp() {
    if (!challengeId || otp.length !== 6) return setMessage({ tone: 'error', text: 'Enter the 6 digit OTP.' });
    setBusy(true); setMessage(null);
    try {
      const token = await verifyGuestEnquiryOtp(challengeId, otp);
      setVerificationToken(token);
      setMessage({ tone: 'success', text: 'Mobile number verified.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not verify OTP.' });
    } finally { setBusy(false); }
  }

  async function submit() {
    if (busy || reference) return;
    const normalizedVehicle = normalizeVehicle(vehicleNo);
    if (!newVehicle && normalizedVehicle.length < 6) return setMessage({ tone: 'error', text: 'Enter a valid vehicle number or choose Brand new vehicle.' });
    if (newVehicle && vehicleDetails.trim().length < 3) return setMessage({ tone: 'error', text: 'Add a short description of the new vehicle.' });
    if (!isSignedIn) {
      if (fullName.trim().length < 2) return setMessage({ tone: 'error', text: 'Enter your full name.' });
      if (!guestVerified) return setMessage({ tone: 'error', text: 'Verify your mobile number before requesting a quote.' });
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage({ tone: 'error', text: 'Enter a valid email address or leave it blank.' });
    }
    if (isSignedIn && (!customer || !profile)) return setMessage({ tone: 'error', text: 'Your customer profile is not ready for quote requests yet.' });

    const needLabel = quoteNeeds.find((item) => item.key === quoteNeed)?.label ?? 'Insurance quote';
    const description = [`Quote requirement: ${needLabel}.`, newVehicle ? `New vehicle: ${vehicleDetails.trim()}.` : `Vehicle: ${normalizedVehicle}.`, note.trim() ? `Customer note: ${note.trim()}` : ''].filter(Boolean).join(' ');
    const subject = `Insurance quote - ${newVehicle ? 'new vehicle' : normalizedVehicle}`;

    setBusy(true); setMessage(null);
    try {
      const result = isSignedIn
        ? await submitCustomerServiceEnquiry({
            serviceType: 'insurance_quote',
            customerId: customer!.id,
            profileId: profile!.id,
            vehicleId: selectedVehicle?.id ?? null,
            vehicleNo: newVehicle ? null : normalizedVehicle,
            subject,
            description,
            details: { quoteNeed, newVehicle, vehicleDetails: vehicleDetails.trim() || null, note: note.trim() || null },
          })
        : await submitGuestServiceEnquiry({
            challengeId,
            verificationToken,
            serviceType: 'insurance_quote',
            source: source as 'guest_login' | 'guest_signup',
            guestName: fullName.trim(),
            guestEmail: email.trim() || undefined,
            vehicleNo: newVehicle ? '' : normalizedVehicle,
            subject,
            description,
            details: { quoteNeed, newVehicle, vehicleDetails: vehicleDetails.trim() || null, note: note.trim() || null },
          });

      setReference(result.enquiry_no);
      setMessage({ tone: 'success', text: 'Quote request received. Our insurance team will contact you using the details linked to this request.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not submit the quote request.' });
    } finally { setBusy(false); }
  }

  function goBack() {
    router.replace(isSignedIn ? '/customer/home' : source === 'guest_signup' ? '/signup' : '/login');
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}><MaterialCommunityIcons name="chevron-left" size={25} color={palette.ink} /></Pressable>
        <Pressable onPress={goBack} style={styles.brand}><BrandLogo width={158} /></Pressable>
        {isSignedIn ? <><NotificationBell /><Pressable onPress={() => router.push('/customer/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initialFor(customer?.contact_name ?? profile?.full_name ?? 'I')}</Text></Pressable></> : null}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.glow} />
          <View style={styles.badge}><Text style={styles.badgeText}>COMMERCIAL VEHICLE INSURANCE</Text></View>
          <Text style={styles.title}>Find the right cover for your vehicle</Text>
          <Text style={styles.priceLine}>Request expert-assisted quotes from trusted insurers.</Text>

          {!isSignedIn ? (
            <View style={styles.contactCard}>
              <Text style={styles.cardTitle}>Your contact details</Text>
              <Text style={styles.cardSub}>No account required. Verify your mobile so our team can reach you.</Text>
              <TextInput value={fullName} onChangeText={setFullName} editable={!reference} placeholder="Full name" placeholderTextColor="#8A94A6" style={styles.compactInput} />
              <View style={styles.phoneRow}>
                <TextInput value={mobile} onChangeText={(value) => { setMobile(normalizeMobile(value)); setChallengeId(''); setVerificationToken(''); }} editable={!reference} keyboardType="number-pad" maxLength={10} placeholder="Mobile number" placeholderTextColor="#8A94A6" style={[styles.compactInput, styles.phoneInput]} />
                <Pressable disabled={busy || Boolean(reference)} onPress={() => void sendOtp()} style={styles.verifyButton}><Text style={styles.verifyButtonText}>{challengeId ? 'Resend' : 'Send OTP'}</Text></Pressable>
              </View>
              {challengeId && !verificationToken ? <View style={styles.phoneRow}><TextInput value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="6 digit OTP" placeholderTextColor="#8A94A6" style={[styles.compactInput, styles.phoneInput]} /><Pressable disabled={busy} onPress={() => void verifyOtp()} style={[styles.verifyButton, styles.verifyButtonSuccess]}><Text style={styles.verifyButtonText}>Verify</Text></Pressable></View> : null}
              {verificationToken ? <View style={styles.verifiedRow}><MaterialCommunityIcons name="check-circle" size={17} color="#0F9F6E" /><Text style={styles.verifiedText}>Verified {maskedPhone}</Text></View> : null}
              <TextInput value={email} onChangeText={setEmail} editable={!reference} autoCapitalize="none" keyboardType="email-address" placeholder="Email (optional)" placeholderTextColor="#8A94A6" style={styles.compactInput} />
            </View>
          ) : (
            <View style={styles.customerStrip}><MaterialCommunityIcons name="account-check-outline" size={20} color="#0F9F6E" /><View style={{ flex: 1 }}><Text style={styles.customerStripTitle}>{customer?.contact_name ?? profile?.full_name ?? 'Customer'}</Text><Text style={styles.customerStripText}>We’ll use your registered customer contact details for this request.</Text></View></View>
          )}

          <View style={styles.inputWrap}>
            <Text style={styles.label}>{newVehicle ? 'NEW VEHICLE DETAILS' : 'VEHICLE NUMBER'}</Text>
            {newVehicle ? <TextInput value={vehicleDetails} onChangeText={setVehicleDetails} placeholder="Example: Ashok Leyland 1920, new purchase" placeholderTextColor="#8A94A6" style={styles.input} /> : <TextInput value={vehicleNo} onChangeText={(text) => { setVehicleNo(formatVehicleNo(text)); setSelectedVehicleId(''); }} autoCapitalize="characters" placeholder="MP-20-CB-1234" placeholderTextColor="#8A94A6" style={styles.input} />}
            {isSignedIn && vehicles.length && !newVehicle ? <View style={styles.vehicleChips}>{vehicles.slice(0, 4).map((vehicle) => <Pressable key={vehicle.id} onPress={() => selectVehicle(vehicle)} style={[styles.vehicleChip, selectedVehicleId === vehicle.id && styles.vehicleChipActive]}><MaterialCommunityIcons name="truck-outline" size={14} color="#0B63CE" /><Text style={styles.vehicleChipText}>{vehicle.vehicle_no}</Text></Pressable>)}</View> : null}
          </View>

          <Pressable onPress={toggleNewVehicle} style={styles.newVehicleCard}>
            <View style={styles.newVehicleIcon}><MaterialCommunityIcons name="truck-plus-outline" size={20} color="#0B63CE" /></View>
            <Text style={styles.newVehicleText}>Brand new vehicle?</Text>
            <Text style={styles.newVehicleAction}>{newVehicle ? 'Use registration' : 'Click here'}</Text>
            <MaterialCommunityIcons name="chevron-right" size={21} color={palette.navy} />
          </Pressable>
        </View>

        <View style={styles.optionsCard}>
          <Text style={styles.sectionTitle}>What do you need?</Text>
          <View style={styles.optionGrid}>{quoteNeeds.map((item) => <Pressable key={item.key} onPress={() => setQuoteNeed(item.key)} style={[styles.option, quoteNeed === item.key && styles.optionActive]}><MaterialCommunityIcons name={item.icon} size={19} color={quoteNeed === item.key ? '#FFFFFF' : '#0B63CE'} /><Text style={[styles.optionText, quoteNeed === item.key && styles.optionTextActive]}>{item.label}</Text></Pressable>)}</View>
          <TextInput value={note} onChangeText={setNote} editable={!reference} multiline textAlignVertical="top" placeholder="Anything else our insurance team should know? (optional)" placeholderTextColor="#8A94A6" style={[styles.compactInput, styles.noteInput]} />
        </View>

        {message ? <View style={[styles.messageBox, message.tone === 'error' ? styles.messageError : message.tone === 'success' ? styles.messageSuccess : styles.messageInfo]}><MaterialCommunityIcons name={message.tone === 'error' ? 'alert-circle-outline' : message.tone === 'success' ? 'check-circle-outline' : 'information-outline'} size={18} color={message.tone === 'error' ? '#B42318' : message.tone === 'success' ? '#0F7A54' : '#0B63CE'} /><Text style={styles.messageText}>{message.text}</Text></View> : null}

        {reference ? <View style={styles.referenceCard}><Text style={styles.referenceEyebrow}>REQUEST RECEIVED</Text><Text style={styles.referenceNo}>{reference}</Text><Text style={styles.referenceText}>Keep this reference for follow-up with the InsureIT team.</Text></View> : <Pressable disabled={busy} onPress={() => void submit()} style={[styles.button, busy && styles.disabled]}><Text style={styles.buttonText}>{busy ? 'Submitting…' : 'Request Quote'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>}

        <Text style={styles.consentText}>By requesting a quote, you agree to our <Text onPress={() => router.push(isSignedIn ? '/customer/legal/privacy-policy' : '/legal/privacy-policy')} style={styles.consentLink}>Privacy Policy</Text> and <Text onPress={() => router.push(isSignedIn ? '/customer/legal/terms-of-use' : '/legal/terms-of-use')} style={styles.consentLink}>Terms of Use</Text>.</Text>

        <View style={styles.expert}><MaterialCommunityIcons name="headset" size={34} color="#FFFFFF" /><View style={styles.expertCopy}><Text style={styles.expertTitle}>Need expert help?</Text><Text style={styles.expertBody}>Submit the request above and our team will follow up with the right commercial vehicle insurance assistance.</Text></View></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function normalizeMobile(value: string) { return value.replace(/\D/g, '').slice(0, 10); }
function normalizeVehicle(value: string) { return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); }
function formatVehicleNo(value: string) {
  const raw = normalizeVehicle(value);
  const state = raw.slice(0, 2).replace(/[^A-Z]/g, '');
  const district = raw.slice(2, 4).replace(/[^0-9]/g, '');
  const series = raw.slice(4, 6).replace(/[^A-Z]/g, '');
  const number = raw.slice(6, 10).replace(/[^0-9]/g, '');
  return [state, district, series, number].filter(Boolean).join('-');
}
function initialFor(name: string) { return name.trim().charAt(0).toUpperCase() || 'I'; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4FAFF' },
  header: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  backButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(191,216,255,0.78)' },
  brand: { flex: 1 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900' },
  scroll: { flex: 1 }, body: { padding: 14, gap: 11, paddingBottom: 28 },
  hero: { borderRadius: 22, padding: 15, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#DDEBFA', elevation: 3 },
  glow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -78, top: -74, backgroundColor: '#E3F1FF' },
  badge: { alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#E6F2FF', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 }, badgeText: { color: '#174777', fontSize: 10.5, fontWeight: '900' },
  title: { color: palette.navy, fontSize: 25, lineHeight: 30, fontWeight: '900' }, priceLine: { color: '#536477', fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 5 },
  contactCard: { marginTop: 14, borderRadius: 17, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0F2', padding: 12, gap: 8 }, cardTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, cardSub: { color: '#607086', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  compactInput: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D7E6F5', backgroundColor: '#FFFFFF', paddingHorizontal: 11, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  phoneRow: { flexDirection: 'row', gap: 8 }, phoneInput: { flex: 1 }, verifyButton: { minWidth: 90, borderRadius: 13, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, verifyButtonSuccess: { backgroundColor: '#0F9F6E' }, verifyButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, verifiedText: { color: '#0F7A54', fontSize: 10.5, fontWeight: '900' },
  customerStrip: { marginTop: 14, borderRadius: 15, backgroundColor: '#F3FBF7', borderWidth: 1, borderColor: '#BFE8D4', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, customerStripTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' }, customerStripText: { color: '#607086', fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  inputWrap: { marginTop: 11, borderRadius: 16, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0F2', padding: 11 }, label: { color: '#5F6C7A', fontSize: 10.5, fontWeight: '900' }, input: { minHeight: 39, color: palette.navy, fontSize: 17, fontWeight: '900' },
  vehicleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 }, vehicleChip: { minHeight: 30, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E6F5', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }, vehicleChipActive: { backgroundColor: '#EEF5FF', borderColor: '#8AB8F0' }, vehicleChipText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  newVehicleCard: { minHeight: 48, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E7FA', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 }, newVehicleIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, newVehicleText: { color: palette.navy, fontSize: 13, fontWeight: '900', flex: 1 }, newVehicleAction: { color: '#0B63CE', fontSize: 11, fontWeight: '900' },
  optionsCard: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDEBFA', padding: 13, elevation: 2 }, sectionTitle: { color: palette.navy, fontSize: 15.5, fontWeight: '900' }, optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, option: { width: '48.7%', minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#D7E6F5', backgroundColor: '#F8FBFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 }, optionActive: { backgroundColor: '#0B63CE', borderColor: '#0B63CE' }, optionText: { color: palette.navy, fontSize: 10.5, fontWeight: '900', flex: 1 }, optionTextActive: { color: '#FFFFFF' }, noteInput: { minHeight: 88, marginTop: 10, paddingTop: 10 },
  messageBox: { borderRadius: 15, padding: 11, flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1 }, messageError: { backgroundColor: '#FFF4F2', borderColor: '#FFD1CB' }, messageSuccess: { backgroundColor: '#F3FBF7', borderColor: '#BFE8D4' }, messageInfo: { backgroundColor: '#F3F8FF', borderColor: '#CFE0FF' }, messageText: { flex: 1, color: '#536477', fontSize: 10.8, lineHeight: 15, fontWeight: '700' },
  button: { minHeight: 52, borderRadius: 16, backgroundColor: '#0969F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, disabled: { opacity: 0.6 },
  referenceCard: { borderRadius: 18, backgroundColor: '#F3FBF7', borderWidth: 1, borderColor: '#BFE8D4', padding: 14, alignItems: 'center' }, referenceEyebrow: { color: '#0F7A54', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 }, referenceNo: { color: palette.navy, fontSize: 20, fontWeight: '900', marginTop: 3 }, referenceText: { color: '#607086', fontSize: 10.5, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  consentText: { color: '#607086', fontSize: 8.8, lineHeight: 13, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4 }, consentLink: { color: '#0B63CE', fontWeight: '900', textDecorationLine: 'underline' },
  expert: { minHeight: 102, borderRadius: 20, backgroundColor: palette.navy, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 }, expertCopy: { flex: 1 }, expertTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, expertBody: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 4 },
});
