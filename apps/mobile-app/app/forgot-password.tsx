import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthExperience, authExperienceStyles } from '@/components/auth-experience';
import { AuthGlassPanel, AuthStatusMessage, BrandLogo, PremiumLoginField, SecureActionButton } from '@/components/first-look';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (loading) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const redirectTo = Linking.createURL('/reset-password');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage('Password reset link sent. Please check your email inbox.');
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
            <MaterialCommunityIcons name="lock-reset" size={18} color="#0F9F6E" />
            <Text style={authExperienceStyles.secureText}>Reset secure access</Text>
          </View>
        </View>
        <Text style={authExperienceStyles.copyText}>Enter your registered email and we?ll send a secure password reset link.</Text>
        {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
        {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}
        <PremiumLoginField
          label="Email"
          icon="email-outline"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="name@company.com"
          editable={!loading}
          disabled={loading}
        />
        <SecureActionButton label={loading ? 'Sending reset link' : 'Send reset link'} icon="email-fast-outline" loading={loading} disabled={!email.trim()} onPress={submit} />
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
        <Text style={authExperienceStyles.ctaTitle}>Remembered it?</Text>
        <Text style={authExperienceStyles.ctaBody}>Return to secure login</Text>
      </View>
      <Link href="/login" asChild>
        <Pressable accessibilityRole="button" style={authExperienceStyles.ctaButton}>
          <Text style={authExperienceStyles.ctaButtonText}>Login</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function resetErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.toLowerCase().includes('email')) return message;
  if (message) return message;
  return 'Could not send the reset link. Please try again.';
}

