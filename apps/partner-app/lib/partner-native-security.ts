import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_LOCK_KEY = 'insureit.partner.biometric-lock.enabled';
const PRIVACY_KEY = 'partner-sensitive-screen';

export async function getPartnerBiometricLockEnabled() {
  return (await SecureStore.getItemAsync(BIOMETRIC_LOCK_KEY)) === 'true';
}

export async function setPartnerBiometricLockEnabled(enabled: boolean) {
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_LOCK_KEY, 'true');
  else await SecureStore.deleteItemAsync(BIOMETRIC_LOCK_KEY);
}

export async function getPartnerBiometricCapability() {
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

export async function authenticatePartnerLocally(promptMessage = 'Unlock INSUREIT Partner') {
  try {
    const capability = await getPartnerBiometricCapability();
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

export async function protectPartnerSensitiveScreen() {
  try {
    await ScreenCapture.preventScreenCaptureAsync(PRIVACY_KEY);
  } catch {
    // Privacy protection should fail closed at the feature level without crashing the route.
  }
}

export async function releasePartnerSensitiveScreen() {
  try {
    await ScreenCapture.allowScreenCaptureAsync(PRIVACY_KEY);
  } catch {
    // Never crash navigation while releasing a privacy guard.
  }
}

export async function enablePartnerAppSwitcherPrivacy() {
  if (Platform.OS !== 'ios') return;
  try {
    await ScreenCapture.enableAppSwitcherProtectionAsync(0.65);
  } catch {
    // Android recent-app privacy is handled by FLAG_SECURE on protected screens.
  }
}

export async function disablePartnerAppSwitcherPrivacy() {
  if (Platform.OS !== 'ios') return;
  try {
    await ScreenCapture.disableAppSwitcherProtectionAsync();
  } catch {
    // Best-effort cleanup only.
  }
}
