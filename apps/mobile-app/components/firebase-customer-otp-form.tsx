import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthExperience, LoginPromptCard, SignupPromptCard } from './auth-experience';
import { AuthGlassPanel, AuthStatusMessage, SecureActionButton } from './first-look';
import { OtpDotsInput } from './otp-dots-input';
import {
  checkFirebaseCustomerRegistration,
  confirmFirebaseCustomerOtp,
  confirmFirebaseCustomerSignup,
  sendFirebaseCustomerOtp,
  startFirebaseCustomerOtp,
  type FirebaseCustomerRegistration,
} from '@/lib/firebase-customer-auth';
import { selectCustomerAuthProvider } from '@/lib/customer-identity';

const normalizeMobile = (value: string) => value.replace(/\D/g, '').slice(0, 10);

function readableFirebaseError(error: unknown, stage: 'send' | 'verify'): string {
  const message = error instanceof Error ? error.message : '';
  const lowered = message.toLowerCase();
  if (lowered.includes('not_registered')) return 'This mobile number is not registered with INSUREIT. Please sign up first.';
  if (lowered.includes('signup_incomplete')) return 'This customer account has not finished mobile verification. Use Sign up to complete it.';
  if (lowered.includes('already_registered')) return 'An INSUREIT account already exists for this number. Please log in.';
  if (lowered.includes('account_requires_review')) return 'We found an older account that requires verification. Please contact INSUREIT support; your existing records are safe.';
  if (lowered.includes('identity_conflict') || lowered.includes('customer_requires_review')) {
    return 'Your verified number could not be matched safely to a single customer account. Please contact INSUREIT support.';
  }
  if (lowered.includes('invalid-verification-code') || lowered.includes('invalid otp') || lowered.includes('invalid code')) {
    return 'The OTP is incorrect. Check the code and try again.';
  }
  if (lowered.includes('session-expired') || lowered.includes('code-expired') || lowered.includes('expired')) {
    return 'This OTP has expired. Request a fresh code.';
  }
  if (lowered.includes('too-many-requests') || lowered.includes('quota') || lowered.includes('rate')) {
    return 'Too many attempts. Wait a few minutes before requesting another OTP.';
  }
  if (lowered.includes('invalid-phone-number')) return 'Enter a valid Indian mobile number.';
  if (lowered.includes('network') || lowered.includes('fetch')) return 'Connection failed. Check the internet and try again.';
  if (lowered.includes('registration_check_unavailable') || lowered.includes('registration_lookup_unavailable')) {
    return 'We could not check your registration right now. Please try again shortly.';
  }
  if (lowered.includes('bind_') || lowered.includes('profile_') || lowered.includes('authorization')) {
    return 'The OTP was verified, but your customer account could not be opened. Please contact INSUREIT support.';
  }
  return stage === 'send'
    ? 'The OTP could not be sent. Please try again shortly.'
    : 'Verification could not be completed. Please try again or contact support.';
}

/**
 * Reuses the EXISTING INSUREIT branded login/signup experience.
 * Registration eligibility is checked before requesting an SMS; the client
 * never queries private profile/auth tables or contains service credentials.
 */
export function FirebaseCustomerOtpForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [registration, setRegistration] = useState<FirebaseCustomerRegistration | null>(null);
  const validMobile = /^[6-9]\d{9}$/.test(mobile);
  const validName = fullName.trim().length >= 2;
  const validEmail = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function requestOtp() {
    if (busy) return;
    setError('');
    setMessage('');
    if (!validMobile) return setError('Enter a valid 10-digit mobile number.');
    if (mode === 'signup' && !validName) return setError('Enter your full name.');
    if (mode === 'signup' && !validEmail) return setError('Enter a valid email address or leave it blank.');
    setBusy(true);
    try {
      // Fail closed: unknown and ambiguous legacy identities never receive
      // a Firebase login OTP or get silently re-created on signup.
      const result = await checkFirebaseCustomerRegistration('+91' + mobile);
      setRegistration(result);
      if (mode === 'login' && result.status === 'not_registered') {
        setError('This mobile number is not registered with INSUREIT. Please sign up first.');
        return;
      }
      if (mode === 'login' && result.status === 'signup_incomplete') {
        setError('This number has an unfinished Customer App registration. Please select Sign up to finish verification.');
        return;
      }
      if (result.status === 'account_requires_review') {
        setError('An older account was found, but its ownership needs verification before OTP login. Please contact INSUREIT support.');
        return;
      }
      if (mode === 'signup' && result.status === 'registered') {
        setError('This number is already registered with INSUREIT. Please log in instead.');
        return;
      }
      if (mode === 'login' && result.status !== 'registered') throw new Error('registration_check_unavailable');
      if (mode === 'signup' && result.status !== 'not_registered' && result.status !== 'signup_incomplete') throw new Error('registration_check_unavailable');

      startFirebaseCustomerOtp();
      await sendFirebaseCustomerOtp('+91' + mobile);
      setSent(true);
      setOtp('');
      setMessage('Verification code requested. Enter the SMS OTP when it arrives.');
    } catch (nextError) {
      setError(readableFirebaseError(nextError, 'send'));
      // Keep screen in the request stage if SMS dispatch did not succeed.
      setSent(false);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (busy) return;
    setError('');
    setMessage('');
    if (!/^\d{6}$/.test(otp)) return setError('Enter the six-digit verification code.');
    if ((mode === 'login' && registration?.status !== 'registered') ||
        (mode === 'signup' && registration?.status !== 'not_registered' && registration?.status !== 'signup_incomplete')) {
      return setError('Please recheck your mobile number.');
    }
    setBusy(true);
    try {
      const verified = mode === 'signup'
        ? await confirmFirebaseCustomerSignup(otp, { fullName: fullName.trim(), ...(email.trim() ? { email: email.trim() } : {}) })
        : await confirmFirebaseCustomerOtp(otp);
      if (!verified.profileId) throw new Error('profile_not_resolved');
      await selectCustomerAuthProvider('firebase');
      router.replace('/customer/home');
    } catch (nextError) {
      setError(readableFirebaseError(nextError, 'verify'));
      // A truly expired verification session must request another OTP;
      // never present the old confirmation as a still usable handle.
      const code = nextError instanceof Error ? nextError.message.toLowerCase() : '';
      if (code.includes('session-expired') || code.includes('code-expired')) {
        setSent(false);
        setOtp('');
        setRegistration(null);
      }
    } finally {
      setBusy(false);
    }
  }

  function editDetails() {
    if (busy) return;
    setSent(false);
    setOtp('');
    setMessage('');
    setError('');
    setRegistration(null);
    startFirebaseCustomerOtp();
  }

  return (
    <AuthExperience showLegal={false} footer={mode === 'login'
      ? <Pressable accessibilityRole="button" onPress={() => router.replace('/signup')}><SignupPromptCard /></Pressable>
      : <Pressable accessibilityRole="button" onPress={() => router.replace('/login')}><LoginPromptCard /></Pressable>
    }>
      <AuthGlassPanel>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name={mode === 'login' ? 'cellphone-lock' : 'account-lock-outline'} size={20} color="#0F9F6E" />
          </View>
          <Text style={styles.heading}>{mode === 'login' ? 'Login with mobile OTP' : 'Create customer account'}</Text>
        </View>
        {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
        {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}
        {mode === 'signup' ? (
          <>
            <Text style={styles.label}>Full name</Text>
            <View style={styles.field}>
              <MaterialCommunityIcons name="account-outline" size={19} color="#1F6FEB" />
              <TextInput accessibilityLabel="Full name" value={fullName} onChangeText={setFullName}
                editable={!sent && !busy} maxLength={120} autoCapitalize="words" placeholder="Your full name"
                placeholderTextColor="#94A3B8" style={styles.fieldInput} />
            </View>
            <Text style={styles.label}>Email (optional)</Text>
            <View style={styles.field}>
              <MaterialCommunityIcons name="email-outline" size={19} color="#1F6FEB" />
              <TextInput accessibilityLabel="Email address" value={email} onChangeText={setEmail}
                editable={!sent && !busy} maxLength={254} keyboardType="email-address" autoCapitalize="none"
                placeholder="name@example.com" placeholderTextColor="#94A3B8" style={styles.fieldInput} />
            </View>
          </>
        ) : null}
        <Text style={styles.label}>Mobile number</Text>
        <View style={styles.field}>
          <View style={styles.countryCode}><Text style={styles.countryText}>+91</Text></View>
          <TextInput accessibilityLabel="Mobile number" value={mobile}
            onChangeText={(v) => { setMobile(normalizeMobile(v)); setRegistration(null); setError(''); }}
            editable={!sent && !busy} keyboardType="number-pad" maxLength={10} placeholder="98765 43210"
            placeholderTextColor="#94A3B8" style={styles.fieldInput} />
          {sent ? <Pressable accessibilityRole="button" disabled={busy} onPress={editDetails}>
            <Text style={styles.edit}>Edit</Text>
          </Pressable> : null}
        </View>
        {sent ? (
          <>
            <Text style={styles.label}>Enter OTP</Text>
            <OtpDotsInput value={otp} onChangeText={setOtp} disabled={busy} autoFocus={sent} highlighted />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void requestOtp()}>
              <Text style={styles.resend}>Resend OTP</Text>
            </Pressable>
          </>
        ) : null}
        <View style={styles.action}>
          <SecureActionButton
            label={sent ? 'Verify OTP' : 'Get OTP'}
            icon={sent ? 'shield-check-outline' : 'message-text-lock-outline'}
            loading={busy}
            disabled={sent ? otp.length !== 6 : (!validMobile || (mode === 'signup' && (!validName || !validEmail)))}
            variant={mode === 'signup' ? 'success' : 'primary'}
            onPress={() => void (sent ? verifyOtp() : requestOtp())}
          />
        </View>
        <Text style={styles.legal}>
          By continuing, you agree to our Terms & Conditions and Privacy Policy.
        </Text>
        <Pressable accessibilityRole="button"
          onPress={() => router.replace({ pathname: mode === 'signup' ? '/signup' : '/login', params: { legacyOtp: '1' } })}>
          <Text style={styles.fallback}>Having trouble? Use the previous OTP method</Text>
        </Pressable>
      </AuthGlassPanel>
    </AuthExperience>
  );
}

const styles = StyleSheet.create({
  header: { marginHorizontal: -22, marginTop: -20, marginBottom: 18, borderTopLeftRadius: 27, borderTopRightRadius: 27,
    backgroundColor: '#F3F6FA', minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  headerIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F8F0' },
  heading: { color: '#071D49', fontSize: 15.5, fontWeight: '700' },
  label: { color: '#17202F', fontSize: 15, fontWeight: '600', marginBottom: 9 },
  field: { minHeight: 61, borderRadius: 16, borderWidth: 1.3, borderColor: '#CFE2FF', backgroundColor: '#F8FBFF',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 17, gap: 10 },
  fieldInput: { flex: 1, fontSize: 17, minHeight: 52, color: '#17202F' },
  countryCode: { minWidth: 52, minHeight: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: 11, backgroundColor: '#ECF3FF' },
  countryText: { color: '#071D49', fontWeight: '700', fontSize: 15 },
  edit: { color: '#0B63CE', fontWeight: '700', fontSize: 12 },
  resend: { textAlign: 'right', color: '#0B63CE', paddingVertical: 10, fontWeight: '700' },
  action: { marginTop: 8 },
  legal: { fontSize: 11, lineHeight: 16, color: '#64748B', marginTop: 14, textAlign: 'center' },
  fallback: { color: '#0B63CE', fontSize: 12, textAlign: 'center', marginTop: 18, fontWeight: '600' },
});
