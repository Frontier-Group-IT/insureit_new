import { Stack } from 'expo-router';

export default function CustomerKycLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="partner-type" />
      <Stack.Screen name="individual" />
      <Stack.Screen name="corporate" />
      <Stack.Screen name="group" />
    </Stack>
  );
}
