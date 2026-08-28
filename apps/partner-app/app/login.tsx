import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { resolvePartnerSession, signIn } from '@/lib/partner-session';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    if (!email.trim() || !password) {
      setMessage('Enter your registered email and password.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await signIn(email, password);
      await resolvePartnerSession();
      router.replace('/home');
    } catch {
      setMessage('We could not open your Partner account. Check your credentials or contact INSUREIT support.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.brandBlock}>
        <View style={styles.mark}><Text style={styles.markText}>I</Text></View>
        <Text style={styles.brand}>INSUREIT</Text>
        <Text style={styles.partner}>PARTNER</Text>
        <Text style={styles.tagline}>Your insurance business workspace</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in with your registered Partner or employee account.</Text>

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="name@example.com"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          placeholder="Enter password"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          onSubmitEditing={submit}
        />

        {message ? <Text style={styles.error}>{message}</Text> : null}

        <Pressable disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#F4F6FB' },
  brandBlock: { alignItems: 'center', marginBottom: 28 },
  mark: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#1D2A55', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  markText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  brand: { color: '#17203A', fontSize: 22, fontWeight: '800', letterSpacing: 1.2 },
  partner: { marginTop: 2, color: '#6254E7', fontSize: 10, fontWeight: '800', letterSpacing: 2.4 },
  tagline: { marginTop: 8, color: '#64748B', fontSize: 12 },
  card: { borderRadius: 22, backgroundColor: '#FFFFFF', padding: 22, borderWidth: 1, borderColor: '#E1E6EF' },
  title: { color: '#17203A', fontSize: 22, fontWeight: '700' },
  subtitle: { marginTop: 6, marginBottom: 22, color: '#64748B', fontSize: 12, lineHeight: 18 },
  label: { marginBottom: 7, marginTop: 12, color: '#667085', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D8DFEA', paddingHorizontal: 14, color: '#17203A', backgroundColor: '#FBFCFE' },
  error: { marginTop: 14, color: '#B42318', fontSize: 11, lineHeight: 16 },
  button: { height: 50, marginTop: 20, borderRadius: 13, backgroundColor: '#5548D9', alignItems: 'center', justifyContent: 'center' },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
