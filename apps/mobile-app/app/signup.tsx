import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthExperience, authExperienceStyles } from '@/components/auth-experience';
import { AuthGlassPanel, AuthStatusMessage, PremiumLoginField, SecureActionButton } from '@/components/first-look';
import { ensureCustomerForUser, signUp } from '@/lib/auth';

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await signUp(email.trim(), password, fullName.trim(), phone.trim());
      if (data.user && data.session) {
        await ensureCustomerForUser(data.user);
        router.replace({ pathname: '/login', params: { email: email.trim(), signup: 'complete' } });
      } else {
        router.replace({ pathname: '/login', params: { email: email.trim(), signup: 'confirm' } });
      }
    } catch (nextError) {
      setError(signupErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthExperience
      footer={(
        <View style={authExperienceStyles.ctaCard}>
          <View style={authExperienceStyles.ctaIcon}>
            <MaterialCommunityIcons name="login" size={24} color="#0B63CE" />
          </View>
          <View style={authExperienceStyles.ctaCopy}>
            <Text style={authExperienceStyles.ctaTitle}>Already protected?</Text>
            <Text style={authExperienceStyles.ctaBody}>Login to your InsureIT account</Text>
          </View>
          <Link href="/login" asChild>
            <Pressable accessibilityRole="button" style={authExperienceStyles.ctaButton}>
              <Text style={authExperienceStyles.ctaButtonText}>Login</Text>
            </Pressable>
          </Link>
        </View>
      )}
    >
      <AuthGlassPanel>
        <View style={authExperienceStyles.secureRow}>
          <View style={authExperienceStyles.secureCopy}>
            <MaterialCommunityIcons name="account-lock-outline" size={17} color="#0F9F6E" />
            <Text style={authExperienceStyles.secureText}>Create secure access</Text>
          </View>
        </View>
        {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
        {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}
        <PremiumLoginField label="Full name" icon="account-outline" value={fullName} onChangeText={setFullName} placeholder="Your full name" editable={!loading} disabled={loading} />
        <PremiumLoginField label="Phone" icon="phone-outline" keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="Mobile number" editable={!loading} disabled={loading} />
        <PremiumLoginField label="Email" icon="email-outline" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="name@company.com" editable={!loading} disabled={loading} />
        <PremiumLoginField label="Password" icon="lock-outline" secureTextEntry value={password} onChangeText={setPassword} placeholder="Create password" editable={!loading} disabled={loading} />
        <View style={styles.actions}>
          <SecureActionButton label={loading ? 'Creating account' : 'Sign up'} loading={loading} disabled={loading} variant="success" onPress={submit} />
        </View>
      </AuthGlassPanel>
    </AuthExperience>
  );
}

function signupErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('email address') || lowerMessage.includes('email')) return message;
  if (lowerMessage.includes('password')) return message;
  if (lowerMessage.includes('already registered')) return 'This email is already registered. Please sign in instead.';
  return 'Account setup could not be completed. Review the details and try again.';
}

const styles = StyleSheet.create({
  actions: { marginTop: 2 },
});
