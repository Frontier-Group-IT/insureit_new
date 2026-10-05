import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_LOCK_KEY = 'insureit.customer.biometric-lock.enabled';

export async function getCustomerBiometricLockEnabled() {
  return (await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY)) === 'true';
}

export async function setCustomerBiometricLockEnabled(enabled: boolean) {
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, 'true');
  else await SecureStore.deleteItemAsync(BIOMETRIC_LOCK_KEY);
}

export async function getCustomerBiometricCapability() {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return { available: hasHardware && enrolled, hasHardware, enrolled, types };
  } catch {
    return { available: false, hasHardware: false, enrolled: false, types: [] as LocalAuthentication.AuthenticationType[] };
  }
}

export async function authenticateCustomerLocally(promptMessage = 'Unlock INSUREIT') {
  try {
    const capability = await getCustomerBiometricCapability();
    if (!capability.available) return { success: false as const, reason: 'unavailable' as const };

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      promptSubtitle: Platform.OS === 'android' ? 'Confirm it is you' : undefined,
      fallbackLabel: 'Use device passcode',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });

    return result.success
      ? { success: true as const }
      : { success: false as const, reason: result.error || 'cancelled' };
  } catch {
    return { success: false as const, reason: 'error' as const };
  }
}
