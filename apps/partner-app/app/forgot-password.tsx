import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerField } from '@/components/ui/partner-field';
import { partnerTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your registered email address.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const redirectTo = 'insureit-partner://reset-password';
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (resetError) throw resetError;
      setMessage('Password reset link sent. Please check your email inbox.');
    } catch (cause) {
      const next = cause instanceof Error ? cause.message : '';
      setError(next || 'Could not send the reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Image source={require('../assets/partner-app-icon.jpg')} style={styles.logo} resizeMode="contain" />
        <Text accessibilityRole="header" style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>Enter your registered email and we’ll send a secure password reset link.</Text>

        <View style={styles.card}>
          <PartnerField
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError('');
              if (message) setMessage('');
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="name@example.com"
            editable={!busy}
          />

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}

          <View style={styles.button}>
            <PartnerButton label="Send reset link" loading={busy} disabled={busy} onPress={() => void submit()} />
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.back}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={partnerTheme.colors.primary} />
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: partnerTheme.spacing.xl,
    paddingVertical: 32,
  },
  logo: { width: 62, height: 62, borderRadius: 15, alignSelf: 'center', marginBottom: 20 },
  title: { textAlign: 'center', color: partnerTheme.colors.ink, fontSize: 28, fontWeight: '800' },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    textAlign: 'center',
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.body,
  },
  card: {
    borderRadius: partnerTheme.radius.xl,
    backgroundColor: partnerTheme.colors.surface,
    padding: 22,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  button: { marginTop: partnerTheme.spacing.lg },
  error: { marginTop: 12, color: partnerTheme.colors.danger, ...partnerTheme.typography.caption },
  success: { marginTop: 12, color: '#18794E', ...partnerTheme.typography.caption },
  back: {
    marginTop: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  backText: { color: partnerTheme.colors.primary, fontSize: 12, fontWeight: '700' },
});
