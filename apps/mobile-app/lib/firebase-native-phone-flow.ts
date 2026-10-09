/**
 * Native Firebase phone verification, independent of any Supabase Auth session.
 *
 * A React Native Firebase adapter may supply the SDK interface after native
 * dependencies have been installed in a separately approved Android build.
 * This module has no native imports and cannot enable Firebase by itself.
 */
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
    const confirmation = await this.nativeAuth.signInWithPhoneNumber(phone);
    this.pending = confirmation;
    this.pendingPhone = phone;
  }

  async verify(code: string): Promise<VerifiedFirebasePhone> {
    if (!/^\d{6}$/.test(code)) throw new Error('Invalid OTP format');
    if (!this.pending || !this.pendingPhone) throw new Error('Request OTP first');
    const confirmation = this.pending;
    const phone = this.pendingPhone;
    // One attempt consumes the pending handle. Retry must request a new OTP.
    this.pending = null;
    this.pendingPhone = null;
    const result = await confirmation.confirm(code);
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
