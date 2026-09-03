import { Stack, usePathname, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLoadingProvider } from '@/components/app-loading';
import { SplashIntro } from '@/components/first-look';
import { RealtimeNotificationProvider } from '@/components/realtime-notifications';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  const [updateGateReady, setUpdateGateReady] = useState(!Updates.isEnabled);

  useEffect(() => {
    if (!Updates.isEnabled) return undefined;

    let active = true;
    let released = false;

    const releaseGate = () => {
      if (!active || released) return;
      released = true;
      setUpdateGateReady(true);
    };

    const timeout = setTimeout(releaseGate, 10000);

    async function applyLatestUpdateBeforeAppStarts() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (!active || released) return;

        if (!update.isAvailable) {
          releaseGate();
          return;
        }

        const fetched = await Updates.fetchUpdateAsync();
        if (!active || released) return;

        if (fetched.isNew) {
          clearTimeout(timeout);
          released = true;
          await Updates.reloadAsync();
          return;
        }
      } catch {
        // Offline/update-service failures must never block the cached app.
      }

      releaseGate();
    }

    void applyLatestUpdateBeforeAppStarts();

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  if (!updateGateReady) {
    return <View style={styles.updateGate}><SplashIntro /></View>;
  }

  return (
    <AppLoadingProvider><RootApplication /></AppLoadingProvider>
  );
}

function RootApplication() {
  const navigationState = useRootNavigationState();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [minimumIntroComplete, setMinimumIntroComplete] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinimumIntroComplete(true), 1100);
    return () => clearTimeout(timer);
  }, []);
  const introVisible = !minimumIntroComplete || !navigationState?.key;
  const customerRoute = pathname.startsWith('/customer');
  const customerStatusBarVisible = customerRoute && !introVisible;
  return (
    <>
      <StatusBar
        style={introVisible || customerRoute ? 'light' : 'dark'}
        backgroundColor={customerRoute ? '#071D49' : '#EEF7FF'}
      />
      {customerStatusBarVisible ? (
        <View pointerEvents="none" style={[styles.customerStatusBarFill, { height: insets.top }]} />
      ) : null}
      <RealtimeNotificationProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="customer/add-vehicle" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </RealtimeNotificationProvider>
      {introVisible ? <View style={styles.introOverlay}><SplashIntro /></View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  updateGate: { flex: 1, backgroundColor: '#F4F8FC' },
  customerStatusBarFill: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 19000, backgroundColor: '#071D49' },
  introOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20000, elevation: 20000 },
});
