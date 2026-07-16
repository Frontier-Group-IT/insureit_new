import { Stack, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppLoadingProvider, useAppLoading } from '@/components/app-loading';
import { SplashIntro } from '@/components/first-look';
import { RealtimeNotificationProvider } from '@/components/realtime-notifications';

export default function RootLayout() {
  return <AppLoadingProvider><RootApplication /></AppLoadingProvider>;
}

function RootApplication() {
  const navigationState = useRootNavigationState();
  const { beginNavigation } = useAppLoading();
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
        <Stack
          screenOptions={{ headerShown: false, animation: 'none' }}
          screenListeners={{ state: () => beginNavigation('Loading page') }}
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