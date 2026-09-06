import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PartnerErrorBoundary } from '@/components/partner-error-boundary';
import { PartnerBiometricLockProvider } from '@/providers/partner-biometric-lock-provider';
import { PartnerNativeRuntimeProvider } from '@/providers/partner-native-runtime-provider';
import { PartnerNetworkProvider } from '@/providers/partner-network-provider';
import { PartnerSessionProvider } from '@/providers/partner-session-provider';

export default function RootLayout() {
  return (
    <PartnerErrorBoundary>
      <PartnerNetworkProvider>
        <PartnerSessionProvider>
          <PartnerBiometricLockProvider>
            <PartnerNativeRuntimeProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="home" />
                <Stack.Screen name="renewals" />
                <Stack.Screen name="customers" />
                <Stack.Screen name="activity" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="pulse" />
                <Stack.Screen name="impact" />
                <Stack.Screen name="journey" />
                <Stack.Screen name="network" />
                <Stack.Screen name="learn" />
                <Stack.Screen name="stories" />
                <Stack.Screen name="weekly-story" />
                <Stack.Screen name="recognition" />
                <Stack.Screen name="support" />
                <Stack.Screen name="search" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="customer/[id]" />
                <Stack.Screen name="policy/[id]" />
                <Stack.Screen name="claim/[id]" />
                <Stack.Screen name="policy-intakes" />
                <Stack.Screen name="policy-intake-new" />
                <Stack.Screen name="policy-intakes/[id]" />
                <Stack.Screen name="access-denied" />
              </Stack>
            </PartnerNativeRuntimeProvider>
          </PartnerBiometricLockProvider>
        </PartnerSessionProvider>
      </PartnerNetworkProvider>
    </PartnerErrorBoundary>
  );
}
