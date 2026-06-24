import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthExperience, authExperienceStyles } from '@/components/auth-experience';
import { AuthGlassPanel, AuthStatusMessage, BrandLogo, PremiumLoginField, SecureActionButton } from '@/components/first-look';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function prepareRecoverySession(url?: string | null) {
      if (!url) {
        if (active) setReady(true);
        return;
      }
      try {
        const params = paramsFromUrl(url);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
        }
      } catch (nextError) {
        if (active) setError(resetErrorMessage(nextError));
      } finally {
        if (active) setReady(true);
      }
    }

    void Linking.getInitialURL().then((url) => prepareRecoverySession(url));
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void prepareRecoverySession(url);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function submit() {
    if (loading) return;
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
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage('Password updated successfully. You can now login securely.');
      setTimeout(() => router.replace('/login'), 900);
    } catch (nextError) {
      setError(resetErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthExperience compact footer={<BackToLoginCard />}>
      <AuthGlassPanel>
        <BrandLogo width={184} style={authExperienceStyles.panelLogo} />
        <View style={authExperienceStyles.secureRow}>
          <View style={authExperienceStyles.secureCopy}>
            <MaterialCommunityIcons name="shield-key-outline" size={18} color="#0F9F6E" />
            <Text style={authExperienceStyles.secureText}>Create new password</Text>
          </View>
        </View>
        <Text style={authExperienceStyles.copyText}>Choose a strong password to restore access to your InsureIT account.</Text>
        {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
        {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}
        <PremiumLoginField label="New password" icon="lock-outline" secureTextEntry value={password} onChangeText={setPassword} placeholder="New password" editable={ready && !loading} disabled={!ready || loading} />
        <PremiumLoginField label="Confirm password" icon="lock-check-outline" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" editable={ready && !loading} disabled={!ready || loading} />
        <SecureActionButton label={loading ? 'Updating password' : 'Update password'} icon="shield-check-outline" loading={loading} disabled={!ready || !password || !confirmPassword} onPress={submit} />
      </AuthGlassPanel>
    </AuthExperience>
  );
}

function BackToLoginCard() {
  return (
    <View style={authExperienceStyles.ctaCard}>
      <View style={authExperienceStyles.ctaIcon}>
        <MaterialCommunityIcons name="login" size={24} color="#0B63CE" />
      </View>
      <View style={authExperienceStyles.ctaCopy}>
        <Text style={authExperienceStyles.ctaTitle}>Back to login</Text>
        <Text style={authExperienceStyles.ctaBody}>Open your account securely</Text>
      </View>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="button" style={authExperienceStyles.ctaButton}>
          <Text style={authExperienceStyles.ctaButtonText}>Login</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function paramsFromUrl(url: string) {
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  const hash = url.includes('#') ? url.split('#')[1] ?? '' : '';
  return new URLSearchParams([query, hash].filter(Boolean).join('&'));
}

function resetErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message) return message;
  return 'Password could not be updated. Please request a new reset link.';
}

