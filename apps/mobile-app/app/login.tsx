import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthExperience, SignupPromptCard } from '@/components/auth-experience';
import { AuthGlassPanel, AuthStatusMessage, SecureActionButton } from '@/components/first-look';
import { OtpDotsInput } from '@/components/otp-dots-input';
import { routeSignedInUser, sendPhoneOtp, verifyPhoneOtp } from '@/lib/auth';

const countryCode = '+91';
const termsHref = '/legal/terms-of-use' as Href;
const privacyHref = '/legal/privacy-policy' as Href;

export default function LoginScreen() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(1)).current;
  const inputPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(inputPulse, { toValue: 1, duration: 1600, useNativeDriver: false }),
        Animated.timing(inputPulse, { toValue: 0, duration: 1600, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [inputPulse]);

  const normalizedMobile = normalizeMobile(mobile);
  const fullPhone = `${countryCode}${normalizedMobile}`;
  const mobileValid = normalizedMobile.length === 10;
  const otpValid = otp.length === 6;
  const phoneBorderColor = inputPulse.interpolate({ inputRange: [0, 1], outputRange: ['#CFE2FF', '#8BBDF8'] });
  const phoneShadowOpacity = inputPulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] });

  async function requestOtp() {
    if (loading) return;
    setError('');
    setMessage('');
    if (!mobileValid) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp(fullPhone);
      setOtpSent(true);
      setMessage(`OTP sent to ${countryCode} ${formatMobile(normalizedMobile)}.`);
    } catch (nextError) {
      setError(phoneAuthErrorMessage(nextError, 'send'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (loading) return;
    setError('');
    setMessage('');
    if (!mobileValid) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }
    if (!otpValid) {
      setError('Enter the OTP sent to your mobile number.');
      return;
    }
    setLoading(true);
    try {
      const data = await verifyPhoneOtp(fullPhone, otp);
      if (!data.user) {
        setError('OTP verification did not return an active account.');
        return;
      }
      await routeSignedInUser(data.user, router);
    } catch (nextError) {
      setError(phoneAuthErrorMessage(nextError, 'verify'));
    } finally {
      setLoading(false);
    }
  }

  function editMobile() {
    if (loading) return;
    setOtpSent(false);
    setOtp('');
    setMessage('');
    setError('');
  }

  return (
    <AuthExperience
      showLegal={false}
      footer={(
        <Link href="/signup" asChild>
          <Pressable accessibilityRole="button">
            <SignupPromptCard />
          </Pressable>
        </Link>
      )}
    >
      <Animated.View style={[styles.body, { opacity }]}>
        <AuthGlassPanel>
          <View style={styles.secureRow}>
            <View style={styles.secureIcon}>
              <MaterialCommunityIcons name="cellphone-lock" size={19} color="#0F9F6E" />
            </View>
            <Text style={styles.secureTitle}>Login with mobile OTP</Text>
          </View>

          {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
          {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Mobile number</Text>
            <Animated.View style={[styles.phoneShell, { borderColor: phoneBorderColor, shadowOpacity: phoneShadowOpacity }, otpSent && styles.fieldDisabled]}>
              <View style={styles.countryPill}>
                <Text style={styles.countryText}>{countryCode}</Text>
              </View>
              <TextInput
                value={mobile}
                onChangeText={(value) => setMobile(normalizeMobile(value))}
                editable={!otpSent && !loading}
                keyboardType="number-pad"
                maxLength={10}
                placeholder="98765 43210"
                placeholderTextColor="#B7C1CF"
                style={styles.phoneInput}
              />
              {otpSent ? (
                <Pressable accessibilityRole="button" onPress={editMobile} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          </View>

          {otpSent ? (
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Enter OTP</Text>
              <OtpDotsInput value={otp} onChangeText={setOtp} disabled={loading} />
              <Pressable accessibilityRole="button" disabled={loading} onPress={requestOtp} style={styles.resendButton}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.authActions}>
            <SecureActionButton
              label={otpSent ? (loading ? 'Verifying OTP' : 'Verify OTP') : (loading ? 'Sending OTP' : 'Get OTP')}
              icon={otpSent ? 'shield-check-outline' : 'message-text-lock-outline'}
              loading={loading}
              disabled={otpSent ? !otpValid : !mobileValid}
              onPress={otpSent ? verifyOtp : requestOtp}
            />
          </View>

          <Text style={styles.legalText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => router.push(termsHref)}>Terms & Conditions</Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => router.push(privacyHref)}>Privacy Policy</Text>
          </Text>
        </AuthGlassPanel>
      </Animated.View>
    </AuthExperience>
  );
}

function normalizeMobile(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function formatMobile(value: string) {
  if (value.length <= 5) return value;
  return `${value.slice(0, 5)} ${value.slice(5)}`;
}

function phoneAuthErrorMessage(error: unknown, action: 'send' | 'verify') {
  const message = error instanceof Error ? error.message : '';
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('unsupported phone provider')) return 'Phone OTP is not fully enabled in Supabase. Please check the SMS provider settings and try again.';
  if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) return 'Too many OTP attempts. Please wait a moment and try again.';
  if (lowerMessage.includes('invalid') || lowerMessage.includes('expired')) return 'The OTP is invalid or expired. Please request a new code.';
  if (lowerMessage.includes('not found') || lowerMessage.includes('signup')) return 'This mobile number is not registered with InsureIT.';
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) return 'Could not reach the InsureIT server. Check internet access and try again.';
  if (message) return message;
  return action === 'send' ? 'Could not send OTP. Please try again.' : 'Could not verify OTP. Please try again.';
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  secureRow: { minHeight: 58, marginHorizontal: -22, marginTop: -20, marginBottom: 18, borderTopLeftRadius: 27, borderTopRightRadius: 27, borderBottomWidth: 1, borderBottomColor: '#E1E8F0', backgroundColor: '#F3F6FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 16 },
  secureIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CDEEDC' },
  secureTitle: { color: '#071D49', fontSize: 15.2, fontWeight: '700', textAlign: 'center' },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: '#17202F', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  phoneShell: { minHeight: 66, borderRadius: 17, borderWidth: 1.4, backgroundColor: '#F8FBFF', paddingLeft: 10, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#0B63CE', shadowRadius: 13, elevation: 2 },
  fieldDisabled: { opacity: 0.72 },
  countryPill: { minWidth: 62, height: 48, borderRadius: 14, backgroundColor: '#F1F6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8E7FF' },
  countryText: { color: '#071D49', fontSize: 15, fontWeight: '700' },
  phoneInput: { flex: 1, minHeight: 56, color: '#17202F', fontSize: 18, fontWeight: '400' },
  editButton: { minHeight: 36, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F9FF' },
  editButtonText: { color: '#1F6FEB', fontSize: 12, fontWeight: '700' },
  resendButton: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', marginTop: 4 },
  resendText: { color: '#0B63CE', fontSize: 13, fontWeight: '700' },
  authActions: { gap: 8, marginTop: 6 },
  legalText: { color: '#59687A', fontSize: 9.8, lineHeight: 13, fontWeight: '500', textAlign: 'center', marginTop: 12 },
  legalLink: { color: '#0B63CE', fontWeight: '700' },
});
