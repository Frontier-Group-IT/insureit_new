import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { canPartnerAccess, canPartnerStartClaim, requiredPartnerRoutePermission } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';
import { PartnerErrorBoundary } from '@/components/partner-error-boundary';
import { PartnerBiometricLockProvider } from '@/providers/partner-biometric-lock-provider';
import { PartnerNativeRuntimeProvider } from '@/providers/partner-native-runtime-provider';
import { PartnerNetworkProvider } from '@/providers/partner-network-provider';
import { PartnerSensitivePrivacyProvider } from '@/providers/partner-sensitive-privacy-provider';
import { PartnerSearchProvider } from '@/providers/partner-search-provider';
import { PartnerSessionProvider } from '@/providers/partner-session-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PartnerErrorBoundary>
        <PartnerNetworkProvider>
        <PartnerSessionProvider>
          <PartnerBiometricLockProvider>
            <PartnerNativeRuntimeProvider>
              <PartnerSensitivePrivacyProvider>
                <PartnerSearchProvider>
                  <StatusBar style="dark" />
                  <PartnerPermissionBoundary>
                  <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="home" />
                    <Stack.Screen name="renewals" />
                    <Stack.Screen name="customers" />
                    <Stack.Screen name="customer-new" />
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
                    <Stack.Screen name="claim/stage" />
                    <Stack.Screen name="claim/new" />
                    <Stack.Screen name="policy-intakes" />
                    <Stack.Screen name="policy-intake-new" />
                    <Stack.Screen name="policy-intakes/[id]" />
                    <Stack.Screen name="access-denied" />
                  </Stack>
                  </PartnerPermissionBoundary>
                </PartnerSearchProvider>
              </PartnerSensitivePrivacyProvider>
            </PartnerNativeRuntimeProvider>
          </PartnerBiometricLockProvider>
        </PartnerSessionProvider>
        </PartnerNetworkProvider>
      </PartnerErrorBoundary>
    </SafeAreaProvider>
  );
}

function PartnerPermissionBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { context, status } = usePartnerSession();
  const required = requiredPartnerRoutePermission(pathname);
  if (status === 'ready' && required) {
    const allowed = /^\\/claim\\/(?:new|select-vehicle)(?:\\/|$)/.test(pathname)
      ? canPartnerStartClaim(context)
      : canPartnerAccess(context, required.capability, required.minimum);
    if (!allowed) return <Redirect href="/access-denied" />;
  }
  return <>{children}</>;
}
