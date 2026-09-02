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
      setMessage({ type: 'info', text: 'OTP sent. Enter the code below.' });
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
    const cleanVehicle = normalizeVehicle(vehicleNo);
    if (isNewVehicle && newVehicleDetails.trim().length < 3) return setMessage({ type: 'error', text: 'Add a short description of the new vehicle.' });
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
          });

      setReference(result.enquiry_no);
      setMessage({ type: 'success', text: 'Request sent. Our team will contact you shortly.' });
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
        <View style={styles.introCard}>
          <View style={styles.iconCircle}><MaterialCommunityIcons name="shield-check-outline" size={25} color="#0B63CE" /></View>
          <View style={styles.introCopy}>
            <Text style={styles.title}>Get Quote</Text>
            <Text style={styles.subtitle}>Share a few details. We’ll call you with the right options.</Text>
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
        ) : null}

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
              <TextInput value={vehicleNo} onChangeText={(v) => { setVehicleNo(formatVehicleNo(v)); setSelectedVehicleId(''); }} autoCapitalize="characters" placeholder="Vehicle number" placeholderTextColor="#8A94A6" style={styles.input} />
              {isSignedIn && vehicles.length ? <View style={styles.chips}>{vehicles.slice(0, 5).map((vehicle) => <Pressable key={vehicle.id} onPress={() => chooseVehicle(vehicle)} style={({ pressed }) => [styles.chip, selectedVehicleId === vehicle.id && styles.chipActive, pressed && styles.pressed]}><Text style={styles.chipText}>{vehicle.vehicle_no}</Text></Pressable>)}</View> : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What do you need?</Text>
          <View style={styles.chips}>{needs.map((item) => <Pressable key={item.key} onPress={() => setNeed(item.key)} style={({ pressed }) => [styles.needChip, need === item.key && styles.needChipActive, pressed && styles.pressed]}><Text style={[styles.needText, need === item.key && styles.needTextActive]}>{item.label}</Text></Pressable>)}</View>
          <TextInput value={note} onChangeText={setNote} multiline textAlignVertical="top" placeholder="Add a note (optional)" placeholderTextColor="#8A94A6" style={[styles.input, styles.note]} />
        </View>

        {message ? <View style={[styles.message, message.type === 'error' ? styles.error : message.type === 'success' ? styles.success : styles.info]}><Text style={styles.messageText}>{message.text}</Text></View> : null}

        {reference ? (
          <View style={styles.doneCard}><MaterialCommunityIcons name="check-circle" size={26} color="#0F9F6E" /><Text style={styles.doneTitle}>Request received</Text><Text style={styles.reference}>{reference}</Text><Pressable onPress={() => router.replace(isSignedIn ? '/customer/support' : source === 'guest_signup' ? '/signup' : '/login')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{isSignedIn ? 'View in Support' : 'Done'}</Text></Pressable></View>
        ) : (
          <Pressable disabled={busy} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed, busy && styles.disabled]}><Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : 'Request Quote'}</Text></Pressable>
        )}

        {!isSignedIn ? <Text style={styles.legal}>Your verified mobile is used only to respond to this request. <Text onPress={() => router.push('/legal/privacy-policy')} style={styles.link}>Privacy Policy</Text></Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
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
  body: { padding: 14, gap: 10, paddingBottom: 28 },
  introCard: { borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1 }, title: { color: palette.navy, fontSize: 22, fontWeight: '900' }, subtitle: { color: '#66758A', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  card: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE9F6', padding: 12, gap: 9 },
  sectionTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D8E4F0', backgroundColor: '#FAFCFF', paddingHorizontal: 11, color: palette.navy, fontSize: 12.5, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 }, flex: { flex: 1 },
  smallButton: { minWidth: 92, borderRadius: 13, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, greenButton: { backgroundColor: '#0F9F6E' }, smallButtonText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 13, backgroundColor: '#F1F5F9' }, segmentItem: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: '#FFFFFF' }, segmentText: { color: '#77859A', fontSize: 11, fontWeight: '900' }, segmentTextActive: { color: '#0B63CE' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: '#D8E4F0', backgroundColor: '#FFFFFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, chipActive: { borderColor: '#91BDF1', backgroundColor: '#EEF5FF' }, chipText: { color: palette.navy, fontSize: 10, fontWeight: '900' },
  needChip: { minHeight: 35, borderRadius: 11, borderWidth: 1, borderColor: '#D8E4F0', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFCFF' }, needChipActive: { backgroundColor: '#0B63CE', borderColor: '#0B63CE' }, needText: { color: palette.navy, fontSize: 10.5, fontWeight: '900' }, needTextActive: { color: '#FFFFFF' },
  note: { minHeight: 78, paddingTop: 10 },
  message: { borderRadius: 13, padding: 10, borderWidth: 1 }, error: { backgroundColor: '#FFF4F2', borderColor: '#FFD1CB' }, success: { backgroundColor: '#F1FBF6', borderColor: '#BFE8D4' }, info: { backgroundColor: '#F2F7FF', borderColor: '#CFE0FF' }, messageText: { color: '#536477', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  primaryButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#0B63CE', alignItems: 'center', justifyContent: 'center' }, primaryPressed: { transform: [{ scale: 0.985 }], opacity: 0.9 }, primaryButtonText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '900' },
  doneCard: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CDE7D9', padding: 16, alignItems: 'center', gap: 5 }, doneTitle: { color: palette.navy, fontSize: 16, fontWeight: '900' }, reference: { color: '#0F7A54', fontSize: 13, fontWeight: '900' },
  secondaryButton: { marginTop: 7, minHeight: 40, borderRadius: 12, paddingHorizontal: 18, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: '#0B63CE', fontSize: 11, fontWeight: '900' },
  legal: { color: '#7B8798', fontSize: 9.5, lineHeight: 14, textAlign: 'center', paddingHorizontal: 12 }, link: { color: '#0B63CE', fontWeight: '900' },
  pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
});
