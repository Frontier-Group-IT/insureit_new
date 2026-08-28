import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function IndexScreen() {
  const { status } = usePartnerSession();

  if (status === 'loading') {
    return <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>;
  }
  if (status === 'ready') return <Redirect href="/(tabs)" />;
  if (status === 'denied') return <Redirect href="/access-denied" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.canvas },
});
