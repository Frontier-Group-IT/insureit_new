/**
 * Event-based Android Firebase phone verification bridge.
 * React Native Firebase native SDK is already included in Android AAB 0.3.1;
 * moving from signInWithPhoneNumber to verifyPhoneNumber is JS-only (OTA safe).
 */
import { Platform } from 'react-native';
import {
  getAuth,
  verifyPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { FirebaseAndroidPhoneEventFlow } from './firebase-android-phone-event-flow';

export function createInstalledAndroidFirebaseOtpFlow(): FirebaseAndroidPhoneEventFlow {
  if (Platform.OS !== 'android') throw new Error('Native Firebase OTP requires Android.');
  const native = getAuth();
  return new FirebaseAndroidPhoneEventFlow({
    verifyPhoneNumber: (phone, forceResend) => ({
      on: (_event, observer, onError) => {
        verifyPhoneNumber(native, phone, forceResend).on(
          'state_changed',
          snapshot => observer({
            state: snapshot.state,
            verificationId: snapshot.verificationId,
            code: snapshot.code,
            error: snapshot.error,
          }),
          error => onError?.(error),
        );
      },
    }),
    signInWithPhoneCredential: (verificationId, code) =>
      signInWithCredential(native, PhoneAuthProvider.credential(verificationId, code)),
  });
}
