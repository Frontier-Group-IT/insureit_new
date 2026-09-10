import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PartnerErrorBoundary } from '@/components/partner-error-boundary';
import { checkForPartnerUpdate } from '@/lib/partner-updates';
import { PartnerSessionProvider } from '@/providers/partner-session-provider';

const UPDATE_RECHECK_MS = 60_000;

export default function RootLayout() {
  const lastUpdateCheckAt = useRef(0);
  const updateCheckRunning = useRef(false);

  const checkAndActivateLatestUpdate = useCallback(async () => {
    const now = Date.now();
    if (updateCheckRunning.current || now - lastUpdateCheckAt.current < UPDATE_RECHECK_MS) return;

    updateCheckRunning.current = true;
    lastUpdateCheckAt.current = now;
    try {
      // checkForPartnerUpdate fetches a compatible OTA and calls reloadAsync when one is available.
      // This closes the gap where ON_LOAD can download an update while Android keeps the same
      // process alive, leaving the newly downloaded bundle pending until a true process restart.
      await checkForPartnerUpdate();
    } catch {
      // Update delivery must never block login or normal Partner app startup. The native
      // ON_LOAD policy remains as the fallback and we retry on the next foreground transition.
    } finally {
      updateCheckRunning.current = false;
    }
  }, []);

  useEffect(() => {
    void checkAndActivateLatestUpdate();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void checkAndActivateLatestUpdate();
    });

    return () => subscription.remove();
  }, [checkAndActivateLatestUpdate]);

  return (
    <PartnerErrorBoundary>
      <PartnerSessionProvider>
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
      </PartnerSessionProvider>
    </PartnerErrorBoundary>
  );
}
