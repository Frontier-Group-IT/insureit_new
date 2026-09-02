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
      const first = nextVehicles[0] ?? null;
      if (first) {
        setSelectedVehicleId(first.id);
        setVehicleNo(formatVehicleNo(first.vehicle_no));
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === selectedVehicleId) ?? null, [selectedVehicleId, vehicles]);
  const guestVerified = Boolean(challengeId && verificationToken);

  function updateVehicleNo(text: string) {
    setVehicleNo(formatVehicleNo(text));
    setSelectedVehicleId('');
    setReference('');
    setMessage(null);
  }

  function selectVehicle(vehicle: Vehicle) {
    setSelectedVehicleId(vehicle.id);
    setVehicleNo(formatVehicleNo(vehicle.vehicle_no));
    setReference('');
    setMessage(null);
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
    if (normalizedVehicle.length < 6) return setMessage({ tone: 'error', text: 'Enter a valid vehicle number.' });
    if (!isSignedIn) {
      if (fullName.trim().length < 2) return setMessage({ tone: 'error', text: 'Enter your full name.' });
      if (!guestVerified) return setMessage({ tone: 'error', text: 'Verify your mobile number before requesting challan assistance.' });
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage({ tone: 'error', text: 'Enter a valid email address or leave it blank.' });
    }
    if (isSignedIn && (!customer || !profile)) return setMessage({ tone: 'error', text: 'Your customer profile is not ready for challan assistance yet.' });

    const subject = `Challan assistance - ${normalizedVehicle}`;
    const description = [
      `Vehicle: ${normalizedVehicle}.`,
      challanNo.trim() ? `Challan/reference: ${challanNo.trim()}.` : '',
      note.trim() ? `Customer note: ${note.trim()}` : 'Customer requested assisted challan verification and resolution guidance.',
    ].filter(Boolean).join(' ');

    setBusy(true); setMessage(null);
    try {
      const result = isSignedIn
        ? await submitCustomerServiceEnquiry({
            serviceType: 'challan_assistance',
            customerId: customer!.id,
            profileId: profile!.id,
            vehicleId: selectedVehicle?.id ?? null,
            vehicleNo: normalizedVehicle,
            subject,
            description,
            details: { challanNo: challanNo.trim() || null, note: note.trim() || null },
          })
        : await submitGuestServiceEnquiry({
            challengeId,
            verificationToken,
            serviceType: 'challan_assistance',
            source: source as 'guest_login' | 'guest_signup',
            guestName: fullName.trim(),
            guestEmail: email.trim() || undefined,
            vehicleNo: normalizedVehicle,
            subject,
            description,
            details: { challanNo: challanNo.trim() || null, note: note.trim() || null },
          });

      setReference(result.enquiry_no);
      setMessage({ tone: 'success', text: 'Challan assistance request received. Our team can now reach you and guide the next step.' });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Could not submit the challan assistance request.' });
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
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><MaterialCommunityIcons name="ticket-confirmation-outline" size={30} color="#0F9F9A" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>TRAFFIC CHALLAN ASSISTANCE</Text>
              <Text style={styles.title}>E Challan</Text>
              <Text style={styles.subtitle}>Request help to verify a vehicle challan and continue safely on the appropriate official payment or resolution channel.</Text>
            </View>
          </View>

          {!isSignedIn ? (
            <View style={styles.contactCard}>
              <Text style={styles.cardTitle}>Your contact details</Text>
              <Text style={styles.cardSub}>No account required. Verify your mobile so our team can contact you about this request.</Text>
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
            <View style={styles.customerStrip}><MaterialCommunityIcons name="account-check-outline" size={20} color="#0F9F6E" /><View style={{ flex: 1 }}><Text style={styles.customerStripTitle}>{customer?.contact_name ?? profile?.full_name ?? 'Customer'}</Text><Text style={styles.customerStripText}>Your registered contact details will be attached automatically.</Text></View></View>
          )}

          <View style={styles.inputCard}>
            <Text style={styles.label}>Vehicle number</Text>
            <TextInput value={vehicleNo} onChangeText={updateVehicleNo} autoCapitalize="characters" placeholder="MP-20-CB-1234" placeholderTextColor="#8A94A6" style={styles.input} />
            {isSignedIn && vehicles.length ? <View style={styles.vehicleChips}>{vehicles.slice(0, 4).map((vehicle) => <Pressable key={vehicle.id} onPress={() => selectVehicle(vehicle)} style={[styles.vehicleChip, selectedVehicleId === vehicle.id && styles.vehicleChipActive]}><MaterialCommunityIcons name="truck-outline" size={14} color="#0B63CE" /><Text style={styles.vehicleChipText}>{vehicle.vehicle_no}</Text></Pressable>)}</View> : null}
          </View>
        </View>

        <View style={styles.stats}>
          <Stat icon="shield-check-outline" label="Secure" value="Verified request" />
          <Stat icon="file-search-outline" label="Status" value="Assisted review" />
          <Stat icon="receipt-text-outline" label="Payment" value="Official channel" />
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Request details</Text>
          <TextInput value={challanNo} onChangeText={setChallanNo} editable={!reference} placeholder="Challan / reference number (optional)" placeholderTextColor="#8A94A6" style={styles.compactInput} />
          <TextInput value={note} onChangeText={setNote} editable={!reference} multiline textAlignVertical="top" placeholder="Describe what help you need (optional)" placeholderTextColor="#8A94A6" style={[styles.compactInput, styles.noteInput]} />
        </View>

        {message ? <View style={[styles.messageBox, message.tone === 'error' ? styles.messageError : message.tone === 'success' ? styles.messageSuccess : styles.messageInfo]}><MaterialCommunityIcons name={message.tone === 'error' ? 'alert-circle-outline' : message.tone === 'success' ? 'check-circle-outline' : 'information-outline'} size={18} color={message.tone === 'error' ? '#B42318' : message.tone === 'success' ? '#0F7A54' : '#0B63CE'} /><Text style={styles.messageText}>{message.text}</Text></View> : null}

        {reference ? <View style={styles.referenceCard}><Text style={styles.referenceEyebrow}>REQUEST RECEIVED</Text><Text style={styles.referenceNo}>{reference}</Text><Text style={styles.referenceText}>Keep this reference for follow-up with the InsureIT team.</Text></View> : <Pressable disabled={busy} onPress={() => void submit()} style={[styles.primaryButton, busy && styles.disabled]}><Text style={styles.primaryButtonText}>{busy ? 'Submitting…' : 'Request Challan Assistance'}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>}

        <View style={styles.stepsCard}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Step index="1" title="Share the vehicle" body="Use your registration number or choose a saved vehicle." />
          <Step index="2" title="Our team reviews the request" body="The request reaches the InsureIT operations queue with your verified contact details." />
          <Step index="3" title="Resolve on the right channel" body="We guide you to verify, pay, or contest the challan through the appropriate official authority flow." />
        </View>

        <View style={styles.disclaimer}><MaterialCommunityIcons name="shield-alert-outline" size={18} color="#607086" /><Text style={styles.disclaimerText}>INSUREIT does not issue traffic challans and is not the government payment authority. Challan records and payments remain subject to the relevant government or traffic authority system.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return <View style={styles.statItem}><MaterialCommunityIcons name={icon} size={19} color="#0F9F9A" /><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}
function Step({ index, title, body }: { index: string; title: string; body: string }) {
  return <View style={styles.step}><View style={styles.stepNo}><Text style={styles.stepNoText}>{index}</Text></View><View style={styles.stepCopy}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepBody}>{body}</Text></View></View>;
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
  scroll: { flex: 1 }, body: { padding: 14, gap: 12, paddingBottom: 28 },
  hero: { borderRadius: 22, padding: 14, backgroundColor: '#FFFFFF', overflow: 'hidden', borderWidth: 1, borderColor: '#DDEBFA', elevation: 3 },
  heroGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -80, top: -76, backgroundColor: '#DFF8F4' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#E9FAF8', alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0F9F9A', fontSize: 10.5, fontWeight: '900' }, title: { color: palette.navy, fontSize: 26, lineHeight: 30, fontWeight: '900', marginTop: 1 }, subtitle: { color: '#536477', fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  contactCard: { marginTop: 13, borderRadius: 17, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0F2', padding: 12, gap: 8 }, cardTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' }, cardSub: { color: '#607086', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  compactInput: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D7E6F5', backgroundColor: '#FFFFFF', paddingHorizontal: 11, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  phoneRow: { flexDirection: 'row', gap: 8 }, phoneInput: { flex: 1 }, verifyButton: { minWidth: 90, borderRadius: 13, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, verifyButtonSuccess: { backgroundColor: '#0F9F6E' }, verifyButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, verifiedText: { color: '#0F7A54', fontSize: 10.5, fontWeight: '900' },
  customerStrip: { marginTop: 13, borderRadius: 15, backgroundColor: '#F3FBF7', borderWidth: 1, borderColor: '#BFE8D4', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9 }, customerStripTitle: { color: palette.navy, fontSize: 12, fontWeight: '900' }, customerStripText: { color: '#607086', fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  inputCard: { marginTop: 12, borderRadius: 17, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#CFE0F2', padding: 12 }, label: { color: '#5F6C7A', fontSize: 11, fontWeight: '900' }, input: { minHeight: 39, color: palette.navy, fontSize: 18, fontWeight: '900' },
  vehicleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 }, vehicleChip: { minHeight: 30, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E6F5', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }, vehicleChipActive: { backgroundColor: '#EEF5FF', borderColor: '#8AB8F0' }, vehicleChipText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' },
  stats: { minHeight: 78, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', flexDirection: 'row', paddingVertical: 10, elevation: 2 }, statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, statLabel: { color: '#607086', fontSize: 10, fontWeight: '900', marginTop: 4 }, statValue: { color: palette.navy, fontSize: 10.5, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  detailsCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', padding: 13, gap: 9 }, sectionTitle: { color: palette.navy, fontSize: 17, fontWeight: '900' }, noteInput: { minHeight: 88, paddingTop: 10 },
  messageBox: { borderRadius: 15, padding: 11, flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1 }, messageError: { backgroundColor: '#FFF4F2', borderColor: '#FFD1CB' }, messageSuccess: { backgroundColor: '#F3FBF7', borderColor: '#BFE8D4' }, messageInfo: { backgroundColor: '#F3F8FF', borderColor: '#CFE0FF' }, messageText: { flex: 1, color: '#536477', fontSize: 10.8, lineHeight: 15, fontWeight: '700' },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#0F9F9A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.6 },
  referenceCard: { borderRadius: 18, backgroundColor: '#F3FBF7', borderWidth: 1, borderColor: '#BFE8D4', padding: 14, alignItems: 'center' }, referenceEyebrow: { color: '#0F7A54', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 }, referenceNo: { color: palette.navy, fontSize: 20, fontWeight: '900', marginTop: 3 }, referenceText: { color: '#607086', fontSize: 10.5, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  stepsCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', padding: 14, gap: 12 }, step: { flexDirection: 'row', gap: 10 }, stepNo: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#E9FAF8', alignItems: 'center', justifyContent: 'center' }, stepNoText: { color: '#0F9F9A', fontSize: 13, fontWeight: '900' }, stepCopy: { flex: 1 }, stepTitle: { color: palette.navy, fontSize: 13, fontWeight: '900' }, stepBody: { color: '#607086', fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 2 },
  disclaimer: { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: '#DCE8F4', padding: 11, flexDirection: 'row', gap: 9 }, disclaimerText: { flex: 1, color: '#607086', fontSize: 10.8, lineHeight: 15, fontWeight: '700' },
});
