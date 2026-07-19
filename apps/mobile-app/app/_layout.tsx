import { Stack, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppLoadingProvider } from '@/components/app-loading';
import { AppUpdateManager } from '@/components/app-update-manager';
import { SplashIntro } from '@/components/first-look';
import { RealtimeNotificationProvider } from '@/components/realtime-notifications';

export default function RootLayout() {
  return <AppLoadingProvider><RootApplication /></AppLoadingProvider>;
}

function RootApplication() {
  const navigationState = useRootNavigationState();
  const [minimumIntroComplete, setMinimumIntroComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumIntroComplete(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  const introVisible = !minimumIntroComplete || !navigationState?.key;

  return (
    <>
      <StatusBar style={introVisible ? 'light' : 'dark'} />
      <RealtimeNotificationProvider>
        <AppUpdateManager />
        <Stack
          screenOptions={{ headerShown: false, animation: 'none' }}
        />
      </RealtimeNotificationProvider>
      {introVisible ? <View style={styles.introOverlay}><SplashIntro /></View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20000,
    elevation: 20000,
  },
});
