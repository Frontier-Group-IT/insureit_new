import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AppUpdateManager } from '@/components/app-update-manager';
import { SplashIntro } from '@/components/first-look';
import { RealtimeNotificationProvider } from '@/components/realtime-notifications';

export default function RootLayout() {
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIntroVisible(false), 1650);
    return () => clearTimeout(timer);
  }, []);

  if (introVisible) {
    return (
      <>
        <StatusBar style="light" />
        <SplashIntro />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <RealtimeNotificationProvider>
        <AppUpdateManager />
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </RealtimeNotificationProvider>
    </>
  );
}
