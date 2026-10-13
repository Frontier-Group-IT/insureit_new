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
    try {
      result = await confirmation.confirm(code);
    } catch (cause) {
      const failure = firebaseOtpFailure('firebase_verification', cause);
      // Incorrect code can be retried on the same confirmation handle; expired
      // or unusable sessions must request a new SMS. Do not throw away the
      // confirmation before we know whether the code was incorrect.
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
