import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { SplashIntro } from '@/components/first-look';
import { RealtimeNotificationProvider } from '@/components/realtime-notifications';

export default function RootLayout() {
  const [introVisible, setIntroVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIntroVisible(false), 1250);
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
        <Stack screenOptions={{ headerShown: false }} />
      </RealtimeNotificationProvider>
    </>
  );
}
