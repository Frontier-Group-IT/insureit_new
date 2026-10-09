import { useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { createCustomerFirebaseDataClient } from '@/lib/firebase-data-client';
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { confirmFirebaseCustomerOtp, confirmFirebaseCustomerSignup, sendFirebaseCustomerOtp } from '@/lib/firebase-customer-auth';

/**
 * Isolated native authentication validation route.
 * Does not alter active login/signup or customer Supabase sessions.
 * Test with an authorized existing customer phone on a new native build.
 */
export default function FirebaseOtpTestScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [profileId, setProfileId] = useState('');

  async function run(action: 'send' | 'verify') {
    if (busy) return;
    setBusy(true);
    setStatus('');
    setProfileId('');
    try {
      if (action === 'send') {
        if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10 digit mobile number.');
        await sendFirebaseCustomerOtp('+91' + phone);
        setSent(true);
        setStatus('Firebase verification code requested.');
      } else {
        if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit verification code.');
        if (mode === 'signup' && fullName.trim().length < 2) throw new Error('Enter your full name before registering.');
        const verified = mode === 'signup'
          ? await confirmFirebaseCustomerSignup(code, { fullName: fullName.trim(), ...(email.trim() ? { email: email.trim() } : {}) })
          : await confirmFirebaseCustomerOtp(code);
        // Do not render the full profile UUID or Firebase ID token.
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error('Data API configuration unavailable.');
        const reader = createCustomerFirebaseDataClient(url, key, async () => {
          const current = getAuth().currentUser;
          return current?.uid === verified.uid ? current.getIdToken() : null;
        });
        // The resolver succeeding does not prove ordinary customer RLS.
        const [ownProfile, membership] = await Promise.all([
          reader.from('profiles').select('id,role,is_active').eq('id', verified.profileId).maybeSingle(),
          reader.from('customer_memberships').select('customer_id').eq('profile_id', verified.profileId).eq('status', 'active').limit(5),
        ]);
        if (ownProfile.error || !ownProfile.data || ownProfile.data.role !== 'customer' ||
            ownProfile.data.is_active !== true || membership.error) {
          throw new Error('Firebase identity passed, but customer data authorization is not ready.');
        }
        setProfileId(verified.profileId.slice(0, 8));
        setStatus(mode === 'signup'
          ? 'Firebase OTP, profile authorization and membership query verified.'
          : 'Firebase OTP, profile authorization and membership query verified.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Firebase validation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: '#F6F9FD' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#09235A' }}>Firebase OTP Device Check</Text>
      <Text style={{ marginVertical: 12, color: '#48556B' }}>
        Protected test: verifies Firebase phone sign-in and your existing INSUREIT identity without changing the working login.
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 14, gap: 8 }}>
        {(['login', 'signup'] as const).map((nextMode) => (
          <Pressable key={nextMode} disabled={busy || sent}
            accessibilityRole="button"
            onPress={() => { setMode(nextMode); setStatus(''); setProfileId(''); }}
            style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: mode === nextMode ? '#09235A' : '#E4EAF3', alignItems: 'center' }}>
            <Text style={{ color: mode === nextMode ? '#FFF' : '#09235A', fontWeight: '600' }}>
              {nextMode === 'login' ? 'Existing customer' : 'New customer signup'}
            </Text>
          </Pressable>
        ))}
      </View>
      {mode === 'signup' ? (
        <>
          <TextInput accessibilityLabel="Customer full name"
            placeholder="Full name" value={fullName} onChangeText={setFullName}
            editable={!busy && !sent} maxLength={120}
            style={{ borderWidth: 1, borderColor: '#C7D4E7', padding: 12, borderRadius: 10, marginBottom: 10 }} />
          <TextInput accessibilityLabel="Optional contact email"
            placeholder="Email (optional)" value={email} onChangeText={setEmail}
            editable={!busy && !sent} keyboardType="email-address"
            autoCapitalize="none" maxLength={254}
            style={{ borderWidth: 1, borderColor: '#C7D4E7', padding: 12, borderRadius: 10, marginBottom: 10 }} />
        </>
      ) : null}
      <TextInput
        accessibilityLabel="Mobile number"
        keyboardType="phone-pad" placeholder="10 digit mobile number"
        autoComplete="tel"
        value={phone} onChangeText={setPhone} editable={!busy && !sent}
        maxLength={10}
        style={{ borderWidth: 1, borderColor: '#C7D4E7', padding: 12, borderRadius: 10, marginBottom: 14 }}
      />
      {sent ? (
        <TextInput accessibilityLabel="Firebase OTP" keyboardType="number-pad" placeholder="Six digit OTP"
          value={code} onChangeText={setCode} maxLength={6} editable={!busy}
          style={{ borderWidth: 1, borderColor: '#C7D4E7', padding: 12, borderRadius: 10, marginBottom: 14 }} />
      ) : null}
      <Pressable disabled={busy} onPress={() => run(sent ? 'verify' : 'send')}
        style={{ backgroundColor: '#09235A', padding: 16, borderRadius: 12, alignItems: 'center' }}>
        {busy ? <ActivityIndicator color="#FFF"/> : <Text style={{ color: '#FFF', fontWeight: '700' }}>{sent ? 'Verify with Firebase' : 'Get Firebase OTP'}</Text>}
      </Pressable>
      {status ? <Text accessibilityRole="alert" style={{ marginTop: 18, color: '#263B60' }}>{status}</Text> : null}
      {profileId ? <Text style={{ marginTop: 8 }}>Existing profile match: {profileId}…</Text> : null}
    </SafeAreaView>
  );
}
