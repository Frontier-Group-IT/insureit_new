import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerField } from '@/components/ui/partner-field';
import { partnerTheme } from '@/lib/theme';
import { signIn } from '@/lib/partner-session';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { refresh } = usePartnerSession();
  const passwordRef = useRef<TextInput>(null);
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
      const context = await refresh();
      if (!context) throw new Error('Partner access unavailable.');
      router.replace('/(tabs)');
    } catch {
      setMessage('We could not open your Partner account. Check your credentials or contact INSUREIT support.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      accessibilityLabel="INSUREIT Partner sign in"
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.brandBlock}>
        <View accessible={false} style={styles.mark}><Text style={styles.markText}>I</Text></View>
        <Text accessibilityRole="header" style={styles.brand}>INSUREIT</Text>
        <Text style={styles.partner}>PARTNER</Text>
        <Text style={styles.tagline}>Your insurance business workspace</Text>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in with your registered Partner or employee account.</Text>

        <View style={styles.field}>
          <PartnerField
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (message) setMessage('');
            }}
            editable={!busy}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            placeholder="name@example.com"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <PartnerField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (message) setMessage('');
            }}
            editable={!busy}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="Enter password"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!busy) void submit();
            }}
          />
        </View>

        {message ? (
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
            {message}
          </Text>
        ) : null}

        <View style={styles.button}>
          <PartnerButton
            label="Sign in"
            loading={busy}
            disabled={busy}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: partnerTheme.spacing.xl,
    backgroundColor: partnerTheme.colors.canvas,
  },
  brandBlock: { alignItems: 'center', marginBottom: 28 },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#1D2A55',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  markText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  brand: { color: '#17203A', fontSize: 22, fontWeight: '800', letterSpacing: 1.2 },
  partner: { marginTop: 2, color: '#6254E7', fontSize: 10, fontWeight: '800', letterSpacing: 2.4 },
  tagline: { marginTop: 8, color: '#64748B', ...partnerTheme.typography.caption },
  card: {
    borderRadius: partnerTheme.radius.xl,
    backgroundColor: partnerTheme.colors.surface,
    padding: 22,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.pageTitle },
  subtitle: {
    marginTop: 6,
    marginBottom: partnerTheme.spacing.md,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.body,
  },
  field: { marginTop: partnerTheme.spacing.md },
  error: {
    marginTop: partnerTheme.spacing.md,
    color: partnerTheme.colors.danger,
    ...partnerTheme.typography.caption,
  },
  button: { marginTop: partnerTheme.spacing.lg },
});
