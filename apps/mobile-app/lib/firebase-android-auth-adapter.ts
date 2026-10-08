/**
 * Android React Native Firebase Phone Authentication adapter.
 *
 * The native package must exist in a newly installed Android binary before
 * calling createAndroidFirebasePhoneAuth. Never invoke from Expo Go or an
 * existing build without @react-native-firebase/auth.
 */
import type { NativeFirebasePhoneAuth } from './firebase-native-phone-flow';

export type ReactNativeFirebaseAuthModule = {
  signInWithPhoneNumber: (phone: string) => Promise<{
    confirm: (code: string) => Promise<{
      user: {
        uid: string;
        phoneNumber: string | null;
        getIdToken: (forceRefresh?: boolean) => Promise<string>;
      };
    }>;
  }>;
};

/**
 * Inject the actual SDK's getAuth() / auth() instance from Android-only code.
 * This adapter never creates or fabricates a Supabase session.
 */
export function createAndroidFirebasePhoneAuth(
  sdkAuth: ReactNativeFirebaseAuthModule,
): NativeFirebasePhoneAuth {
  if (!sdkAuth || typeof sdkAuth.signInWithPhoneNumber !== 'function') {
    throw new Error('Native Firebase Auth is unavailable in this app build');
  }
  return {
    signInWithPhoneNumber: (phone) => sdkAuth.signInWithPhoneNumber(phone),
  };
}
