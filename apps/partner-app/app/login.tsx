import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function revealFormEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <Image
              accessibilityLabel="INSUREIT logo"
              source={require('../assets/partner-app-icon.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View accessibilityLabel="INSUREIT Partner" style={styles.brandMark}>
              <Text style={styles.brandName}>insureit</Text>
              <Text style={styles.brandPartner}>Partner</Text>
            </View>
          </View>
          <Text style={styles.tagline}>YOUR SAFETY, OUR PROMISE</Text>
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
              importantForAutofill="no"
              textContentType="username"
              placeholder="name@example.com"
              style={styles.loginInput}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                passwordRef.current?.focus();
                revealFormEnd();
              }}
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
              secureTextEntry={!passwordVisible}
              autoComplete="current-password"
              importantForAutofill="no"
              textContentType="password"
              placeholder="Enter password"
              style={styles.loginInput}
              returnKeyType="done"
              onFocus={revealFormEnd}
              onSubmitEditing={() => {
                if (!busy) void submit();
              }}
              rightAccessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setPasswordVisible((current) => !current)}
                  style={styles.eyeButton}
                >
                  <MaterialCommunityIcons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={partnerTheme.colors.inkMuted}
                  />
                </Pressable>
              }
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            disabled={busy}
            onPress={() => router.push('/forgot-password')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: partnerTheme.colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: partnerTheme.spacing.xl,
    paddingTop: 24,
    paddingBottom: 32,
  },
  brandBlock: { alignItems: 'center', marginBottom: 20 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: 66,
    height: 66,
    borderRadius: 16,
  },
  brandMark: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  brandName: {
    color: partnerTheme.colors.ink,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.6,
    lineHeight: 43,
  },
  brandPartner: {
    marginTop: -1,
    color: partnerTheme.colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  tagline: {
    marginTop: 9,
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.35,
  },
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
  loginInput: {
    backgroundColor: partnerTheme.colors.surfaceMuted,
    borderColor: partnerTheme.colors.lineStrong,
  },
  eyeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 4,
    paddingLeft: 12,
  },
  forgotPasswordText: {
    color: partnerTheme.colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    marginTop: partnerTheme.spacing.md,
    color: partnerTheme.colors.danger,
    ...partnerTheme.typography.caption,
  },
  button: { marginTop: partnerTheme.spacing.lg },
});
