import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getCurrentSession, getOnboardingApplicationForUser } from '@/lib/auth';

const detailRoutes = new Set([
  '/customer/kyc/individual',
  '/customer/kyc/corporate',
  '/customer/kyc/group',
]);

export default function CustomerKycLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(detailRoutes.has(pathname));

  useEffect(() => {
    let active = true;

    async function guard() {
      if (!detailRoutes.has(pathname)) {
        if (active) setChecking(false);
        return;
      }

      try {
        const session = await getCurrentSession();
        if (!session?.user) {
          router.replace('/login');
          return;
        }

        const application = await getOnboardingApplicationForUser(session.user.id);
        if (!application || application.current_step < 2) {
          router.replace('/customer/kyc/partner-type');
          return;
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    setChecking(detailRoutes.has(pathname));
    void guard();
    return () => { active = false; };
  }, [pathname, router]);

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0A43A3" />
        <Text style={styles.label}>Opening your KYC</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="partner-type" />
      <Stack.Screen name="individual" />
      <Stack.Screen name="corporate" />
      <Stack.Screen name="group" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F6F8FC' },
  label: { color: '#59687A', fontSize: 13, fontWeight: '600' },
});