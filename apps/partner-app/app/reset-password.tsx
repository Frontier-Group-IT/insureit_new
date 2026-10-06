import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function prepareRecovery(url?: string | null) {
      if (!url) {
        if (active) setReady(true);
        return;
      }

      try {
        const params = paramsFromUrl(url);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'The reset link is invalid or expired.');
      } finally {
        if (active) setReady(true);
      }
    }

    void Linking.getInitialURL().then((url) => prepareRecovery(url));
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void prepareRecovery(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function submit() {
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated successfully.');
      setTimeout(() => router.replace('/login'), 900);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password could not be updated. Please request a new reset link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Image source={require('../assets/partner-app-icon.jpg')} style={styles.logo} resizeMode="contain" />
        <Text accessibilityRole="header" style={styles.title}>Create new password</Text>
        <Text style={styles.subtitle}>Choose a new password for your INSUREIT Partner account.</Text>

        <View style={styles.card}>
          <PartnerField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Enter new password"
            editable={ready && !busy}
            rightAccessory={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                onPress={() => setPasswordVisible((current) => !current)}
                style={styles.eyeButton}
              >
                <MaterialCommunityIcons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={partnerTheme.colors.inkMuted} />
              </Pressable>
            }
          />

          <View style={styles.field}>
            <PartnerField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!confirmVisible}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="Confirm new password"
              editable={ready && !busy}
              rightAccessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirmVisible ? 'Hide password' : 'Show password'}
                  onPress={() => setConfirmVisible((current) => !current)}
                  style={styles.eyeButton}
                >
                  <MaterialCommunityIcons name={confirmVisible ? 'eye-off-outline' : 'eye-outline'} size={21} color={partnerTheme.colors.inkMuted} />
                </Pressable>
              }
            />
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}

          <View style={styles.button}>
            <PartnerButton label="Update password" loading={busy} disabled={!ready || busy} onPress={() => void submit()} />
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

function paramsFromUrl(url: string) {
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  const hash = url.includes('#') ? url.split('#')[1] ?? '' : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
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
  field: { marginTop: partnerTheme.spacing.md },
  eyeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
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
