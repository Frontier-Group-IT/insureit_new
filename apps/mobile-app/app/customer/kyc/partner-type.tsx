import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PartnerTypeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/customer/kyc/individual');
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0A43A3" />
        <Text style={styles.loadingText}>Opening your KYC</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FC' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#59687A' },
});
