/**
 * Native Firebase phone verification, independent of any Supabase Auth session.
 *
 * A React Native Firebase adapter may supply the SDK interface after native
 * dependencies have been installed in a separately approved Android build.
 * This module has no native imports and cannot enable Firebase by itself.
 */
import { firebaseOtpFailure, recordFirebaseOtpStage } from './firebase-otp-errors';

export type NativePhoneConfirmation = {
  confirm: (code: string) => Promise<{
    user: { uid: string; phoneNumber: string | null; getIdToken: (forceRefresh?: boolean) => Promise<string> };
  }>;
};
export type NativeFirebasePhoneAuth = {
  signInWithPhoneNumber: (phone: string) => Promise<NativePhoneConfirmation>;
  /**
   * Android may sign in automatically after receiving a Firebase SMS.
   * Discard ANY previous Firebase auth user before starting a new challenge
   * so this getter can only detect a fresh native auto-verification.
   */
  clearPreviousFirebaseUser?: () => Promise<void>;
  getAutoVerifiedUser?: () => Promise<Awaited<ReturnType<NativePhoneConfirmation['confirm']>>['user'] | null>;
};
export type VerifiedFirebasePhone = Readonly<{
  uid: string;
  phoneNumber: string;
  idToken: string;
}>;

export class FirebasePhoneOtpFlow {
  private pending: NativePhoneConfirmation | null = null;
  private pendingPhone: string | null = null;
  constructor(private readonly nativeAuth: NativeFirebasePhoneAuth) {}

  async send(phone: string) {
    if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error('Invalid Indian mobile number');
    this.pending = null;
    this.pendingPhone = null;
    recordFirebaseOtpStage('sms_request');
    try {
      // Never accept a cached Firebase identity from a previous SMS/session as
      // this verification. Supabase accounts and sessions are unaffected.
      await this.nativeAuth.clearPreviousFirebaseUser?.();
      const confirmation = await this.nativeAuth.signInWithPhoneNumber(phone);
      this.pending = confirmation;
      this.pendingPhone = phone;
      // SDK acceptance does not prove an SMS reached the device.
      recordFirebaseOtpStage('sms_request', 'ok');
    } catch (cause) {
      const failure = firebaseOtpFailure('sms_request', cause);
      recordFirebaseOtpStage(failure.stage, failure.code);
      throw failure;
    }
  }

  async verify(code: string): Promise<VerifiedFirebasePhone> {
    if (!/^\d{6}$/.test(code)) throw new Error('Invalid OTP format');
    if (!this.pending || !this.pendingPhone) throw new Error('Request OTP first');
    const confirmation = this.pending;
    const phone = this.pendingPhone;
    recordFirebaseOtpStage('firebase_verification');
    let result: Awaited<ReturnType<NativePhoneConfirmation['confirm']>>;

    // On Android, Firebase/Play Services can complete SMS verification before
    // the user submits the code. The native confirmation may then reject the
    // already-consumed verificationId with auth/session-expired. We only accept
    // a native authenticated user for the EXACT just-requested phone. The
    // adapter signs out any previous Firebase user before starting each SMS.
    const freshAutoVerified = async () => {
      const user = await this.nativeAuth.getAutoVerifiedUser?.();
      return user?.uid && user.phoneNumber === phone ? user : null;
    };
    try {
      const autoUser = await freshAutoVerified();
      if (autoUser) {
        recordFirebaseOtpStage('firebase_verification', 'auto_verified');
        result = { user: autoUser };
      } else {
        try {
          result = await confirmation.confirm(code);
        } catch (cause) {
          const failure = firebaseOtpFailure('firebase_verification', cause);
          // Android auto verification may race with manual confirmation.
          // Never recover an invalid code or arbitrary Firebase SDK failure.
          const consumed = ['auth/session-expired', 'auth/code-expired',
            'auth/invalid-verification-id'].includes(failure.code);
          const verifiedUser = consumed ? await freshAutoVerified() : null;
          if (verifiedUser) {
            recordFirebaseOtpStage('firebase_verification', 'auto_verified');
            result = { user: verifiedUser };
          } else {
            if (!failure.retryableCode) this.reset();
            recordFirebaseOtpStage(failure.stage, failure.code);
            throw failure;
          }
        }
      }
    } catch (cause) {
      const failure = firebaseOtpFailure('firebase_verification', cause);
      if (!failure.retryableCode) this.reset();
      recordFirebaseOtpStage(failure.stage, failure.code);
      throw failure;
    }
    this.reset();
    recordFirebaseOtpStage('firebase_verification', 'ok');
    if (result.user.phoneNumber !== phone || !result.user.uid) {
      throw new Error('Firebase returned a mismatched phone identity');
    }
    const idToken = await result.user.getIdToken();
    if (!idToken) throw new Error('Firebase did not provide an ID token');
    // Token must still be verified by the server, then mapped to allowed
    // customers. Never pass this ID token to supabase.auth.setSession().
    return { uid: result.user.uid, phoneNumber: phone, idToken };
  }

  reset() {
    this.pending = null;
    this.pendingPhone = null;
  }
}
