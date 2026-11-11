import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePartnerSession } from '@/providers/partner-session-provider';

export default function AccessDeniedScreen() {
  const router = useRouter();
  const { status, error, refresh, signOut } = usePartnerSession();
  const retryable = status === 'unavailable';

  if (status === 'ready') return <Redirect href="/(tabs)" />;
  if (status === 'signed_out') return <Redirect href="/login" />;

  async function returnToLogin() {
    try {
      await signOut();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>INSUREIT PARTNER</Text>
        <Text style={styles.title}>
          {retryable || status === 'loading' ? 'Unable to verify account' : 'Account access unavailable'}
        </Text>
        <Text style={styles.body}>
          {retryable
            ? (error || 'Account verification is temporarily unavailable. Check your connection and retry.')
            : 'This login does not currently resolve to an authorized Partner, POSP, MISP or commercial employee scope.'}
        </Text>
        {retryable || status === 'loading' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry account verification"
            disabled={status === 'loading'}
            onPress={() => void refresh()}
            style={[styles.button, status === 'loading' && styles.disabledButton]}
          >
            {status === 'loading'
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.buttonText}>Retry verification</Text>}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to sign in"
          disabled={status === 'loading'}
          onPress={() => void returnToLogin()}
          style={retryable || status === 'loading' ? styles.secondaryButton : styles.button}
        >
          <Text style={retryable || status === 'loading' ? styles.secondaryButtonText : styles.buttonText}>Return to sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F4F6FB' },
  card: { padding: 24, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EE' },
  eyebrow: { color: '#6254E7', fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  title: { marginTop: 9, color: '#17203A', fontSize: 22, fontWeight: '700' },
  body: { marginTop: 10, color: '#64748B', fontSize: 12, lineHeight: 19 },
  button: { marginTop: 22, height: 46, borderRadius: 12, backgroundColor: '#5548D9', alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  secondaryButton: { marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#315B9A', fontSize: 12, fontWeight: '700' },
});
