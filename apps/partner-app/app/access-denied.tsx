import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOut } from '@/lib/partner-session';

export default function AccessDeniedScreen() {
  const router = useRouter();

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
        <Text style={styles.title}>Account access unavailable</Text>
        <Text style={styles.body}>
          This login does not currently resolve to an authorized Partner, POSP, MISP or commercial employee scope.
        </Text>
        <Pressable onPress={returnToLogin} style={styles.button}><Text style={styles.buttonText}>Return to sign in</Text></Pressable>
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
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
