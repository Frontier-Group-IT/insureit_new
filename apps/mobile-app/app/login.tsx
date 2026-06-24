import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthExperience, authExperienceStyles } from '@/components/auth-experience';
import { AuthGlassPanel, AuthStatusMessage, PremiumLoginField, SecureActionButton } from '@/components/first-look';
import { routeSignedInUser, signIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

const biometricUserKey = 'insureit.biometric.user-id';
const biometricRefreshTokenKey = 'insureit.biometric.refresh-token';
const legacyBiometricSessionKey = 'insureit.biometric.session';
const supportsSecureBiometric = Platform.OS !== 'web';
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [canEnrollBiometric, setCanEnrollBiometric] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingSession, setPendingSession] = useState<Session | null>(null);
  const [error, setError] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 4 }),
    ]).start();
  }, [opacity, translateY]);

  useEffect(() => {
    let active = true;
    async function checkBiometric() {
      try {
        if (!supportsSecureBiometric) {
          if (active) {
            setCanEnrollBiometric(false);
            setBiometricReady(false);
          }
          return;
        }
        const [compatible, enrolled, savedUserId, savedRefreshToken] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem(biometricUserKey),
          SecureStore.getItemAsync(biometricRefreshTokenKey),
        ]);
        if (active) {
          setCanEnrollBiometric(Boolean(compatible && enrolled));
          setBiometricReady(Boolean(compatible && enrolled && savedUserId && savedRefreshToken));
        }
      } catch {
        if (active) setBiometricReady(false);
      }
    }
    void checkBiometric();
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await signIn(email.trim(), password);
      if (data.user) {
        if (!supportsSecureBiometric) {
          await routeSignedInUser(data.user, router);
          return;
        }
        const [compatible, enrolled, savedUserId, savedRefreshToken] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          AsyncStorage.getItem(biometricUserKey),
          SecureStore.getItemAsync(biometricRefreshTokenKey),
        ]);
        setCanEnrollBiometric(Boolean(compatible && enrolled));
        if (compatible && enrolled && (savedUserId !== data.user.id || !savedRefreshToken)) {
          setPendingUser(data.user);
          setPendingSession(data.session);
          return;
        }
        await routeSignedInUser(data.user, router);
      }
    } catch (nextError) {
      console.error('Login failed', nextError);
      setError(authErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  async function enableBiometricForPendingUser() {
    if (!pendingUser || biometricLoading) return;
    setBiometricLoading(true);
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable InsureIT biometric login',
        cancelLabel: 'Skip',
        disableDeviceFallback: false,
      });
      if (result.success) {
        await AsyncStorage.setItem(biometricUserKey, pendingUser.id);
        await saveSessionForBiometric(pendingSession);
        setBiometricReady(true);
      }
      await routeSignedInUser(pendingUser, router);
    } catch {
      setError('Biometric setup failed.');
    } finally {
      setBiometricLoading(false);
    }
  }

  async function skipBiometricForPendingUser() {
    if (!pendingUser) return;
    await routeSignedInUser(pendingUser, router);
  }

  async function unlockWithBiometric() {
    if (biometricLoading || loading) return;
    setBiometricLoading(true);
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'InsureIT',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (!result.success) return;
      const restoredUser = await restoreBiometricSession();
      if (!restoredUser) {
        setBiometricReady(false);
        setError('No saved biometric login found.');
        return;
      }
      await routeSignedInUser(restoredUser, router);
    } catch {
      setError('Biometric unlock failed.');
    } finally {
      setBiometricLoading(false);
    }
  }

  return (
    <>
      <AuthExperience
        footer={(
          <View style={authExperienceStyles.ctaCard}>
            <View style={authExperienceStyles.ctaIcon}>
              <MaterialCommunityIcons name="account-plus-outline" size={25} color="#0B63CE" />
            </View>
            <View style={authExperienceStyles.ctaCopy}>
              <Text style={authExperienceStyles.ctaTitle}>New to InsureIT?</Text>
              <Text style={authExperienceStyles.ctaBody}>Create an account to get started</Text>
            </View>
            <Link href="/signup" asChild>
              <Pressable accessibilityRole="button" style={authExperienceStyles.ctaButton}>
                <Text style={authExperienceStyles.ctaButtonText}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        )}
      >
        <Animated.View style={[styles.body, { opacity, transform: [{ translateY }] }]}>
          <AuthGlassPanel>
            <View style={authExperienceStyles.secureRow}>
              <View style={authExperienceStyles.secureCopy}>
                <MaterialCommunityIcons name="lock" size={16} color="#0F9F6E" />
                <Text style={authExperienceStyles.secureText}>Secure access</Text>
              </View>
            </View>

            {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}

            <PremiumLoginField
              label="Email"
              icon="email-outline"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              editable={!loading && !biometricLoading && !pendingUser}
              disabled={loading || biometricLoading || Boolean(pendingUser)}
            />
            <PremiumLoginField
              label="Password"
              icon="lock-outline"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              editable={!loading && !biometricLoading && !pendingUser}
              disabled={loading || biometricLoading || Boolean(pendingUser)}
            />

            <Link href="/forgot-password" asChild>
              <Pressable accessibilityRole="button" disabled={loading || biometricLoading || Boolean(pendingUser)} style={authExperienceStyles.helperLink}>
                <Text style={authExperienceStyles.helperLinkText}>Forgot Password?</Text>
              </Pressable>
            </Link>

            <View style={styles.authActions}>
              {!pendingUser ? (
                <SecureActionButton label={loading ? 'Opening secure session' : 'Login'} loading={loading} disabled={biometricLoading} onPress={submit} />
              ) : null}

              {biometricReady ? (
                <SecureActionButton label={biometricLoading ? 'Unlocking' : 'Login using biometrics'} icon="fingerprint" loading={biometricLoading} disabled={loading} variant="secondary" onPress={unlockWithBiometric} />
              ) : null}
            </View>
          </AuthGlassPanel>
        </Animated.View>
      </AuthExperience>
      <BiometricEnrollmentModal
        visible={Boolean(pendingUser)}
        loading={biometricLoading}
        supported={canEnrollBiometric}
        onEnable={enableBiometricForPendingUser}
        onSkip={skipBiometricForPendingUser}
      />
    </>
  );

}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network')) return 'Could not reach the InsureIT server from this browser. Check internet access, then try again.';
  if (lowerMessage.includes('email not confirmed')) return 'Please confirm your email address before logging in.';
  if (lowerMessage.includes('invalid login credentials')) return 'Invalid email or password. If you just signed up, confirm your email first.';
  if (message) return message;
  if (lowerMessage.includes('email')) return message;
  return 'Login could not be completed. Please check the details and try again.';
}

async function saveSessionForBiometric(session: Session | null) {
  if (!supportsSecureBiometric) throw new Error('Biometric login is not available on web.');
  if (!session?.refresh_token) throw new Error('Missing refresh token.');
  await SecureStore.setItemAsync(biometricRefreshTokenKey, session.refresh_token);
  await SecureStore.deleteItemAsync(legacyBiometricSessionKey).catch(() => undefined);
}

async function restoreBiometricSession() {
  if (!supportsSecureBiometric) return null;
  const refreshToken = await SecureStore.getItemAsync(biometricRefreshTokenKey);
  if (!refreshToken) return null;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session?.user) return null;
  await saveSessionForBiometric(data.session);
  return data.session.user;
}

function BiometricEnrollmentModal({ visible, loading, supported, onEnable, onSkip }: { visible: boolean; loading: boolean; supported: boolean; onEnable: () => void; onSkip: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={loading ? undefined : onSkip}>
      <View style={styles.enrollBackdrop}>
        <View style={styles.enrollCard}>
          <View style={styles.enrollIconRing}>
            <View style={styles.enrollIcon}>
              <MaterialCommunityIcons name={supported ? 'fingerprint' : 'lock-check-outline'} size={34} color={supported ? '#075EEA' : '#8290A3'} />
            </View>
          </View>
          <View style={styles.enrollCopy}>
            <Text style={styles.enrollTitle}>{supported ? 'Enable biometric command access' : 'Device lock unavailable'}</Text>
            <Text style={styles.enrollText}>
              {supported
                ? 'Use this device lock to open your InsureIT account faster after this login.'
                : 'This device does not have an active biometric lock. You can continue without enabling it.'}
            </Text>
          </View>
          <View style={styles.enrollActions}>
            {supported ? <SecureActionButton label={loading ? 'Opening device lock' : 'Enable biometrics'} icon="fingerprint" loading={loading} onPress={onEnable} /> : null}
            <SecureActionButton label="Continue without it" icon="arrow-right" disabled={loading} variant="secondary" onPress={onSkip} />
          </View>
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboard: { flex: 1 },
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 120 },
  body: { gap: 12 },
  panelLogo: { alignSelf: 'center', marginBottom: 8 },
  panelHeader: { alignItems: 'center', justifyContent: 'center', marginBottom: 26 },
  panelCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  panelEyebrow: { color: '#0F9F6E', fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  authActions: { gap: 8, marginTop: 2 },
  enrollBackdrop: { flex: 1, backgroundColor: 'rgba(12, 21, 34, 0.48)', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  enrollCard: { width: '100%', maxWidth: 390, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E8F0', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, alignItems: 'center', shadowColor: '#17202F', shadowOpacity: 0.18, shadowRadius: 28, elevation: 12 },
  enrollIconRing: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EEF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  enrollIcon: { width: 62, height: 62, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE2FF', alignItems: 'center', justifyContent: 'center' },
  enrollCopy: { gap: 8, alignItems: 'center', marginBottom: 8 },
  enrollTitle: { color: '#17202F', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  enrollText: { color: '#59687A', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  enrollActions: { alignSelf: 'stretch', gap: 2, marginTop: 6 },
  signupRow: { minHeight: 58, borderRadius: 22, borderWidth: 1, borderColor: '#E1E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 0, shadowColor: '#17202F', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  signupText: { flex: 1, color: '#59687A', fontSize: 15, fontWeight: '800' },
  signupButton: { minHeight: 44, borderRadius: 17, paddingHorizontal: 18, backgroundColor: '#EAF3FF', flexDirection: 'row', alignItems: 'center' },
  signupButtonText: { color: '#1F6FEB', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
});
