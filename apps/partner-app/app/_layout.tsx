import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PartnerSessionProvider } from '@/providers/partner-session-provider';

export default function RootLayout() {
  return (
    <PartnerSessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="home" />
        <Stack.Screen name="access-denied" />
      </Stack>
    </PartnerSessionProvider>
  );
}
