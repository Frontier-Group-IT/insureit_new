import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthGlassPanel, AuthStatusMessage, BrandLogo, PremiumLoginField, SecureActionButton, SignalScene } from '@/components/first-look';
import { ensureCustomerForUser, routeSignedInUser, signUp } from '@/lib/auth';

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
        await routeSignedInUser(data.user, router);
      } else {
        setMessage('Account created. Please confirm the email address before signing in.');
      }
    } catch (nextError) {
      setError(signupErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={authStyles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={authStyles.keyboard}>
        <ScrollView
          style={authStyles.screen}
          contentContainerStyle={authStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <SignalScene active={loading} showLogo={false} />
          <AuthGlassPanel>
            <BrandLogo width={172} style={authStyles.logo} />
            <View style={authStyles.secureRow}>
              <Text style={authStyles.secureText}>Create secure access</Text>
            </View>
            {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
            {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}
            <PremiumLoginField label="Full name" icon="account-outline" value={fullName} onChangeText={setFullName} editable={!loading} disabled={loading} />
            <PremiumLoginField label="Phone" icon="phone-outline" keyboardType="phone-pad" value={phone} onChangeText={setPhone} editable={!loading} disabled={loading} />
            <PremiumLoginField label="Email" icon="email-outline" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!loading} disabled={loading} />
            <PremiumLoginField label="Password" icon="lock-outline" secureTextEntry value={password} onChangeText={setPassword} editable={!loading} disabled={loading} />
            <View style={authStyles.actions}>
              <SecureActionButton label={loading ? 'Creating account' : 'Sign up'} loading={loading} disabled={loading} variant="success" onPress={submit} />
            </View>
            <View style={authStyles.loginRow}>
              <Text style={authStyles.loginText}>Already have an account?</Text>
              <Link href="/login" asChild>
                <Pressable accessibilityRole="button" style={authStyles.loginButton}>
                  <Text style={authStyles.loginButtonText}>Login</Text>
                </Pressable>
              </Link>
            </View>
          </AuthGlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

const authStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7FAF8' },
  keyboard: { flex: 1 },
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 120 },
  logo: { alignSelf: 'center', marginBottom: 8 },
  secureRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  secureText: { color: '#0F9F6E', fontSize: 15, fontWeight: '800' },
  actions: { marginTop: 2 },
  loginRow: { alignItems: 'center', gap: 6, marginTop: 18 },
  loginText: { color: '#8290A3', fontSize: 13, fontWeight: '600' },
  loginButton: { minHeight: 34, justifyContent: 'center' },
  loginButtonText: { color: '#075EEA', fontSize: 14, fontWeight: '800' },
});
