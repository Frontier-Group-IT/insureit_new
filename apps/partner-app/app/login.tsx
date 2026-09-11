import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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
          <Image
            accessibilityLabel="INSUREIT Partner"
            resizeMode="contain"
            source={require('../assets/partner-login-logo.png')}
            style={styles.logo}
          />
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
              textContentType="username"
              placeholder="name@example.com"
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
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              placeholder="Enter password"
              returnKeyType="done"
              onFocus={revealFormEnd}
              onSubmitEditing={() => {
                if (!busy) void submit();
              }}
            />
          </View>

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
    paddingTop: 28,
    paddingBottom: 32,
  },
  brandBlock: { alignItems: 'center', marginBottom: 20 },
  logo: {
    width: 190,
    height: 190,
  },
  tagline: {
    marginTop: 4,
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
  error: {
    marginTop: partnerTheme.spacing.md,
    color: partnerTheme.colors.danger,
    ...partnerTheme.typography.caption,
  },
  button: { marginTop: partnerTheme.spacing.lg },
});
