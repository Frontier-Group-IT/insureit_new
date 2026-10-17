/**
 * Real Android Firebase SDK bridge. Do not import from the active Supabase
 * login path until the canonical Firebase identity/RLS cutover is approved.
 *
 * Requires a NEW Android native build containing RNFirebase; it cannot
 * be activated via OTA in existing installations.
 */
import { Platform } from 'react-native';
import { getAuth, signInWithPhoneNumber, signOut } from '@react-native-firebase/auth';
import { createAndroidFirebasePhoneAuth } from './firebase-android-auth-adapter';
import { FirebasePhoneOtpFlow } from './firebase-native-phone-flow';

export function createInstalledAndroidFirebaseOtpFlow(): FirebasePhoneOtpFlow {
  if (Platform.OS !== 'android') {
    throw new Error('Native Firebase OTP is configured for Android only.');
  }
  const nativeAuth = getAuth();
  return new FirebasePhoneOtpFlow(createAndroidFirebasePhoneAuth({
    signInWithPhoneNumber: (phone) => signInWithPhoneNumber(nativeAuth, phone),
    // AuthStateChanged can sign in the Firebase user automatically on Android
    // before manual confirmation consumes the verification ID.
    getAutoVerifiedUser: async () => nativeAuth.currentUser,
    // Ignore pre-existing Firebase state. Only an SMS verified AFTER this
    // request can be adopted. Does not touch the Supabase Auth session.
    clearPreviousFirebaseUser: async () => {
      if (nativeAuth.currentUser) await signOut(nativeAuth);
    },
  }));
}
