import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import type { User } from '@supabase/supabase-js';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthExperience, LoginPromptCard } from '@/components/auth-experience';
import { AuthGlassPanel, AuthStatusMessage, SecureActionButton } from '@/components/first-look';
import { OtpDotsInput } from '@/components/otp-dots-input';
import { routeSignedInUser, sendPhoneSignupOtp, syncCustomerSignupDetails, verifyPhoneOtp } from '@/lib/auth';
import {
  findExistingCustomerSignupAccounts,
  linkExistingCustomerSignupAccount,
  type ExistingCustomerSignupAccount,
} from '@/lib/customer-signup-account';

const countryCode = '+91';
const termsHref = '/legal/terms-of-use' as Href;
const privacyHref = '/legal/privacy-policy' as Href;

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [existingAccounts, setExistingAccounts] = useState<ExistingCustomerSignupAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim();
  const normalizedMobile = normalizeMobile(mobile);
  const fullPhone = `${countryCode}${normalizedMobile}`;
  const mobileValid = normalizedMobile.length === 10;
  const nameValid = trimmedName.length >= 2;
  const emailValid = !trimmedEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const otpValid = otp.length === 6;
  const choosingExistingAccount = Boolean(verifiedUser && existingAccounts.length);

  async function requestOtp() {
    if (loading) return;
    setError('');
    setMessage('');

    if (!nameValid) {
      setError('Enter your full name.');
      return;
    }
    if (!mobileValid) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }
    if (!emailValid) {
      setError('Enter a valid email address, or leave it blank.');
      return;
    }

    setLoading(true);
    try {
      await sendPhoneSignupOtp({
        phone: fullPhone,
        fullName: trimmedName,
        email: trimmedEmail || undefined,
      });
      Keyboard.dismiss();
      setOtpSent(true);
      setMessage(`OTP sent to ${countryCode} ${formatMobile(normalizedMobile)}.`);
    } catch (nextError) {
      setError(signupErrorMessage(nextError, 'send'));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (loading) return;
    setError('');
    setMessage('');

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

      const matches = await findExistingCustomerSignupAccounts();
      if (matches.length > 0) {
        setVerifiedUser(data.user);
        setExistingAccounts(matches);
        setSelectedAccountId(matches.length === 1 ? matches[0].customer_id : null);
        setMessage(matches.length === 1
          ? 'We found your existing InsureIT customer account.'
          : 'We found customer accounts registered with this mobile number. Select the account you want to continue with.');
        return;
      }

      const profile = await syncCustomerSignupDetails(data.user, {
        fullName: trimmedName,
        phone: fullPhone,
        email: trimmedEmail || undefined,
      });
      await routeSignedInUser(data.user, router, profile);
    } catch (nextError) {
      setError(signupErrorMessage(nextError, 'verify'));
    } finally {
      setLoading(false);
    }
  }

  async function continueWithExistingAccount(account: ExistingCustomerSignupAccount) {
    if (loading || !verifiedUser) return;
    setSelectedAccountId(account.customer_id);
    setError('');
    setLoading(true);
    try {
      await linkExistingCustomerSignupAccount(account.customer_id);
      const profile = await syncCustomerSignupDetails(verifiedUser, {
        fullName: trimmedName,
        phone: fullPhone,
        email: trimmedEmail || undefined,
      });
      await routeSignedInUser(verifiedUser, router, profile);
    } catch (nextError) {
      setError(signupErrorMessage(nextError, 'verify'));
    } finally {
      setLoading(false);
    }
  }

  function editDetails() {
    if (loading) return;
    setOtpSent(false);
    setOtp('');
    setMessage('');
    setError('');
  }

  return (
    <AuthExperience
      showLegal={false}
      footer={choosingExistingAccount ? undefined : (
        <Link href="/login" asChild>
          <Pressable accessibilityRole="button">
            <LoginPromptCard />
          </Pressable>
        </Link>
      )}
    >
      <AuthGlassPanel>
        <View style={styles.secureRow}>
          <View style={styles.secureIcon}>
            <MaterialCommunityIcons name={choosingExistingAccount ? 'account-check-outline' : 'account-lock-outline'} size={19} color="#0F9F6E" />
          </View>
          <View style={styles.secureCopy}>
            <Text style={styles.secureTitle}>{choosingExistingAccount ? 'Existing account found' : 'Create customer account'}</Text>
            {choosingExistingAccount ? <Text style={styles.secureSub}>Continue with your existing customer profile</Text> : null}
          </View>
        </View>

        {error ? <AuthStatusMessage type="error">{error}</AuthStatusMessage> : null}
        {message ? <AuthStatusMessage type="success">{message}</AuthStatusMessage> : null}

        {choosingExistingAccount ? (
          <View style={styles.accountList}>
            {existingAccounts.map((account) => {
              const selected = selectedAccountId === account.customer_id;
              return (
                <Pressable
                  key={account.customer_id}
                  accessibilityRole="button"
                  onPress={() => setSelectedAccountId(account.customer_id)}
                  style={[styles.accountCard, selected && styles.accountCardSelected]}
                >
                  <View style={styles.accountTopRow}>
                    <View style={styles.accountIcon}>
                      <MaterialCommunityIcons name="office-building-outline" size={20} color="#0B63CE" />
                    </View>
                    <View style={styles.accountCopy}>
                      <Text style={styles.accountName} numberOfLines={2}>{account.account_name}</Text>
                      <Text style={styles.accountCode}>{account.customer_code}</Text>
                    </View>
                    <MaterialCommunityIcons
                      name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={22}
                      color={selected ? '#0B63CE' : '#94A3B8'}
                    />
                  </View>

                  <View style={styles.accountMetaRow}>
                    <View style={styles.accountStat}>
                      <Text style={styles.accountStatValue}>{account.vehicle_count}</Text>
                      <Text style={styles.accountStatLabel}>Vehicles</Text>
                    </View>
                    <View style={styles.accountDivider} />
                    <View style={styles.accountStat}>
                      <Text style={styles.accountStatValue}>{account.policy_count}</Text>
                      <Text style={styles.accountStatLabel}>Policies</Text>
                    </View>
                    <View style={styles.accountDivider} />
                    <View style={styles.accountStat}>
                      <Text style={styles.accountStatValue}>{account.claim_count}</Text>
                      <Text style={styles.accountStatLabel}>Claims</Text>
                    </View>
                  </View>

                  {account.city || account.state ? (
                    <View style={styles.locationRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                      <Text style={styles.locationText}>{[account.city, account.state].filter(Boolean).join(', ')}</Text>
                    </View>
                  ) : null}

                  {selected ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={loading}
                      onPress={() => void continueWithExistingAccount(account)}
                      style={({ pressed }) => [styles.continueButton, pressed && styles.continueButtonPressed, loading && styles.continueButtonDisabled]}
                    >
                      <Text style={styles.continueButtonText}>{loading ? 'Linking account…' : 'Continue with this account'}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={17} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}
            <Text style={styles.accountHelp}>Your vehicles, policies and claims already linked to the selected customer profile will appear automatically after you continue.</Text>
          </View>
        ) : (
          <>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <View style={[styles.inputShell, otpSent && styles.fieldDisabled]}>
                <MaterialCommunityIcons name="account-outline" size={20} color="#1F6FEB" />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!otpSent && !loading}
                  autoCapitalize="words"
                  placeholder="Your full name"
                  placeholderTextColor="#B7C1CF"
                  style={styles.textInput}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <View style={[styles.phoneShell, otpSent && styles.fieldDisabled]}>
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
                  <Pressable accessibilityRole="button" onPress={editDetails} style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Email optional</Text>
              <View style={[styles.inputShell, otpSent && styles.fieldDisabled]}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#1F6FEB" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  editable={!otpSent && !loading}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  placeholderTextColor="#B7C1CF"
                  style={styles.textInput}
                />
              </View>
            </View>

            {otpSent ? (
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Enter OTP</Text>
                <OtpDotsInput value={otp} onChangeText={setOtp} disabled={loading} autoFocus={otpSent} highlighted={otpSent} />
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
                disabled={otpSent ? !otpValid : (!nameValid || !mobileValid || !emailValid)}
                variant="success"
                onPress={otpSent ? verifyOtp : requestOtp}
              />
            </View>

            <Text style={styles.legalText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              By continuing, you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => router.push(termsHref)}>Terms & Conditions</Text>
              {' '}and{' '}
              <Text style={styles.legalLink} onPress={() => router.push(privacyHref)}>Privacy Policy</Text>
            </Text>
          </>
        )}
      </AuthGlassPanel>
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

function signupErrorMessage(error: unknown, action: 'send' | 'verify') {
  const message = error instanceof Error ? error.message : '';
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('unsupported phone provider')) return 'Phone OTP is not fully enabled in Supabase. Please check the SMS provider settings and try again.';
  if (lowerMessage.includes('rate') || lowerMessage.includes('too many')) return 'Too many OTP attempts. Please wait a moment and try again.';
  if (lowerMessage.includes('already registered') || lowerMessage.includes('already exists')) return 'This mobile number is already registered. Please login instead.';
  if (lowerMessage.includes('invalid') || lowerMessage.includes('expired')) return 'The OTP is invalid or expired. Please request a new code.';
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) return 'Could not reach the InsureIT server. Check internet access and try again.';
  if (lowerMessage.includes('another login')) return 'This customer profile is already linked to another login. Please contact support.';
  if (message) return message;
  return action === 'send' ? 'Could not send OTP. Please try again.' : 'Could not verify OTP. Please try again.';
}

const styles = StyleSheet.create({
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 },
  secureIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center' },
  secureCopy: { flex: 1, minWidth: 0 },
  secureTitle: { color: '#071D49', fontSize: 17, fontWeight: '700' },
  secureSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: '#17202F', fontSize: 14.2, fontWeight: '600', marginBottom: 8 },
  inputShell: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#E1E6ED', backgroundColor: '#FFFFFF', paddingLeft: 15, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldDisabled: { opacity: 0.72 },
  textInput: { flex: 1, minHeight: 52, color: '#17202F', fontSize: 16, fontWeight: '400' },
  phoneShell: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#E1E6ED', backgroundColor: '#FFFFFF', paddingLeft: 9, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryPill: { minWidth: 56, height: 40, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CFE2FF' },
  countryText: { color: '#071D49', fontSize: 14, fontWeight: '700' },
  phoneInput: { flex: 1, minHeight: 52, color: '#17202F', fontSize: 17, fontWeight: '400' },
  editButton: { minHeight: 36, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F9FF' },
  editButtonText: { color: '#1F6FEB', fontSize: 12, fontWeight: '700' },
  resendButton: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', marginTop: 4 },
  resendText: { color: '#0B63CE', fontSize: 13, fontWeight: '700' },
  authActions: { gap: 8, marginTop: 2 },
  legalText: { color: '#59687A', fontSize: 9.8, lineHeight: 13, fontWeight: '500', textAlign: 'center', marginTop: 12 },
  legalLink: { color: '#0B63CE', fontWeight: '700' },
  accountList: { gap: 10 },
  accountCard: { borderWidth: 1, borderColor: '#DCE4EF', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14 },
  accountCardSelected: { borderColor: '#0B63CE', backgroundColor: '#F6FAFF' },
  accountTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: '#071D49', fontSize: 15, fontWeight: '700' },
  accountCode: { color: '#64748B', fontSize: 11.5, marginTop: 2 },
  accountMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#E8EEF6' },
  accountStat: { flex: 1, alignItems: 'center' },
  accountStatValue: { color: '#071D49', fontSize: 16, fontWeight: '800' },
  accountStatLabel: { color: '#64748B', fontSize: 10.5, marginTop: 1 },
  accountDivider: { width: 1, height: 28, backgroundColor: '#E2E8F0' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 9 },
  locationText: { color: '#64748B', fontSize: 11.5 },
  continueButton: { minHeight: 46, marginTop: 12, borderRadius: 12, backgroundColor: '#0B63CE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueButtonPressed: { opacity: 0.9 },
  continueButtonDisabled: { opacity: 0.65 },
  continueButtonText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  accountHelp: { color: '#64748B', fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 2 },
});
