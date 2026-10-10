import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  confirmFirebaseCustomerOtp,
  confirmFirebaseCustomerSignup,
  sendFirebaseCustomerOtp,
  startFirebaseCustomerOtp,
} from '@/lib/firebase-customer-auth';
import { selectCustomerAuthProvider } from '@/lib/customer-identity';

/**
 * Explicitly gated Android-only Firebase OTP entry screen.
 * Existing Supabase OTP screens remain the default and are not removed.
 * No simulated or fabricated Supabase sessions are created.
 */
export function FirebaseCustomerOtpForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function send() {
    if (busy) return;
    setError('');
    setMessage('');
    if (!/^[6-9][0-9]{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (mode === 'signup' && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address or leave it blank.');
      return;
    }
    setBusy(true);
    try {
      startFirebaseCustomerOtp();
      await sendFirebaseCustomerOtp('+91' + mobile);
      setSent(true);
      setMessage('A verification code has been sent to your mobile number.');
    } catch {
      setError('Could not send the verification code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (busy) return;
    setError('');
    if (!/^[0-9]{6}$/.test(otp)) {
      setError('Enter the six-digit verification code.');
      return;
    }
    setBusy(true);
    try {
      const verified = mode === 'signup'
        ? await confirmFirebaseCustomerSignup(otp, {
            fullName: name.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
          })
        : await confirmFirebaseCustomerOtp(otp);
      if (!verified.profileId) throw new Error('Customer profile not verified.');
      // Persist the selected identity only after Firebase Admin binding and
      // the canonical customer profile resolver both succeed.
      await selectCustomerAuthProvider('firebase');
      router.replace('/customer/home');
    } catch {
      setError('The code could not be verified or your account is not ready. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function editNumber() {
    if (busy) return;
    setSent(false);
    setOtp('');
    setMessage('');
    setError('');
    startFirebaseCustomerOtp();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{mode === 'signup' ? 'Create customer account' : 'Customer login'}</Text>
      <Text style={styles.helper}>Verify your mobile number securely with Firebase OTP.</Text>
      {mode === 'signup' ? (
        <>
          <TextInput accessibilityLabel="Full name" placeholder="Full name"
            value={name} onChangeText={setName} editable={!busy && !sent}
            maxLength={120} style={styles.input} />
          <TextInput accessibilityLabel="Email address (optional)" placeholder="Email address (optional)"
            value={email} onChangeText={setEmail} editable={!busy && !sent}
            keyboardType="email-address" autoCapitalize="none"
            maxLength={254} style={styles.input} />
        </>
      ) : null}
      <View style={styles.phoneRow}>
        <Text>+91</Text>
        <TextInput accessibilityLabel="Mobile number" placeholder="10-digit mobile number"
          keyboardType="phone-pad" maxLength={10} value={mobile}
          onChangeText={(next) => setMobile(next.replace(/\D/g, '').slice(0, 10))}
          editable={!busy && !sent} style={[styles.input, styles.phoneInput]} />
      </View>
      {sent ? (
        <>
          <TextInput accessibilityLabel="Firebase OTP" placeholder="Six-digit code"
            keyboardType="number-pad" value={otp}
            onChangeText={(next) => setOtp(next.replace(/\D/g, '').slice(0, 6))}
            maxLength={6} editable={!busy} style={styles.input} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={editNumber}>
            <Text style={styles.link}>Change mobile number</Text>
          </Pressable>
        </>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.helper}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void (sent ? verify() : send())}
        style={styles.action}>
        {busy ? <ActivityIndicator color="#fff" /> :
          <Text style={styles.actionText}>{sent ? 'Verify OTP' : 'Send OTP'}</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy}
        onPress={() => router.replace(mode === 'signup' ? '/login' : '/signup')}>
        <Text style={styles.link}>{mode === 'signup' ? 'Already have an account? Log in' : 'New customer? Sign up'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy}
        onPress={() => router.replace({ pathname: mode === 'signup' ? '/signup' : '/login', params: { legacyOtp: '1' } })}>
        <Text style={styles.link}>Use existing Supabase OTP instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F4F8FC' },
  heading: { fontSize: 24, fontWeight: '700', color: '#09235A', marginBottom: 8 },
  helper: { fontSize: 14, color: '#475569', marginBottom: 14 },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', padding: 13, marginBottom: 12 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  phoneInput: { flex: 1 },
  action: { backgroundColor: '#09235A', borderRadius: 10, padding: 15, alignItems: 'center', marginVertical: 12 },
  actionText: { color: '#fff', fontWeight: '700' },
  link: { color: '#0B63CE', fontWeight: '600', paddingVertical: 10 },
  error: { color: '#B91C1C', marginTop: 8 },
});
