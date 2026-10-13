/**
 * Native Android Firebase Phone Auth based on explicit verification events.
 * Unlike signInWithPhoneNumber().confirm(), this preserves a valid native
 * verificationId during Android auto-verification and SMS resend flows.
 *
 * This class cannot mint customer access. Caller must still send the signed
 * Firebase ID token through the approved customer-firebase-bind backend.
 */
import type { VerifiedFirebasePhone } from './firebase-native-phone-flow';

export type NativePhoneSnapshot = {
  state: 'sent' | 'verified' | 'timeout' | 'error';
  verificationId?: string | null;
  code?: string | null;
  error?: unknown;
};
export type NativePhoneListener = {
  on: (event: 'state_changed', observer: (snapshot: NativePhoneSnapshot) => void,
    onError?: (error: unknown) => void) => unknown;
};
export type AndroidNativePhoneSdk = {
  verifyPhoneNumber: (phone: string, forceResend: boolean) => NativePhoneListener;
  getCurrentVerifiedUser?: () => Promise<{ uid: string; phoneNumber: string | null; getIdToken: (refresh?: boolean) => Promise<string> } | null>;
  signInWithPhoneCredential: (verificationId: string, code: string) => Promise<{
    user: { uid: string; phoneNumber: string | null; getIdToken: (refresh?: boolean) => Promise<string> };
  }>;
};

export type PhoneVerificationStatus =
  | { state: 'requesting' | 'sent' | 'timeout' | 'auto_verifying'; }
  | { state: 'auto_verified'; verified: VerifiedFirebasePhone }
  | { state: 'error'; code: string };

const codeOf = (error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code : null;
  return typeof code === 'string' && /^auth\/[a-z-]{3,60}$/.test(code)
    ? code : 'auth/verification-failed';
};

export class FirebaseAndroidPhoneEventFlow {
  private phone: string | null = null;
  private verificationId: string | null = null;
  private requestSequence = 0;
  private listeners = new Set<(event: PhoneVerificationStatus) => void>();
  private verified: VerifiedFirebasePhone | null = null;
  private verifying: Promise<VerifiedFirebasePhone> | null = null;
  private smsPreviouslyRequested = false;

  constructor(private readonly sdk: AndroidNativePhoneSdk) {}

  subscribe(callback: (event: PhoneVerificationStatus) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }
  private emit(event: PhoneVerificationStatus) {
    for (const callback of this.listeners) callback(event);
  }

  async send(phone: string): Promise<void> {
    if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error('auth/invalid-phone-number');
    const requestId = ++this.requestSequence;
    const resend = this.smsPreviouslyRequested && this.phone === phone;
    this.smsPreviouslyRequested = true;
    this.phone = phone;
    this.verificationId = null;
    this.verified = null;
    this.verifying = null;
    this.emit({ state: 'requesting' });
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const succeed = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (error: unknown) => {
        if (requestId !== this.requestSequence) return;
        this.verificationId = null;
        this.emit({ state: 'error', code: codeOf(error) });
        if (!settled) { settled = true; reject(error); }
      };
      const observe = (snap: NativePhoneSnapshot) => {
        if (requestId !== this.requestSequence) return; // ignore stale resend callbacks
        if (snap.state === 'error') { fail(snap.error ?? new Error('auth/verification-failed')); return; }
        if (snap.verificationId) this.verificationId = snap.verificationId;
        if (snap.state === 'sent') {
          if (!this.verificationId) { fail(new Error('auth/missing-verification-id')); return; }
          this.emit({ state: 'sent' }); succeed();
        } else if (snap.state === 'timeout') {
          this.emit({ state: 'timeout' });
          if (this.verificationId) succeed();
          else fail(new Error('auth/session-expired'));
        } else if (snap.state === 'verified') {
          if (!this.verificationId || !snap.code) {
            // Some Android instant-verification events have no SMS code.
            // Only accept an actual already-authenticated matching Firebase
            // user with a signed ID token; never invent a credential.
            this.emit({ state: 'auto_verifying' });
            this.verifying = this.finishAlreadySignedIn(requestId);
            void this.verifying.catch(fail);
            succeed();
            return;
          }
          this.emit({ state: 'auto_verifying' });
          void this.finishCredential(this.verificationId, snap.code, requestId)
            .catch(fail);
          succeed();
        }
      };
      try {
        this.sdk.verifyPhoneNumber(phone, resend).on('state_changed', observe, fail);
      } catch (error) { fail(error); }
    });
  }

  private async finishAlreadySignedIn(sequence: number): Promise<VerifiedFirebasePhone> {
    const user = await this.sdk.getCurrentVerifiedUser?.();
    if (sequence !== this.requestSequence || !this.phone || !user?.uid || user.phoneNumber !== this.phone) {
      throw new Error('auth/auto-verification-incomplete');
    }
    const idToken = await user.getIdToken();
    if (!idToken) throw new Error('auth/missing-id-token');
    const verified = { uid: user.uid, phoneNumber: this.phone, idToken };
    this.verified = verified;
    this.emit({ state: 'auto_verified', verified });
    return verified;
  }

  private async finishCredential(id: string, code: string, sequence: number): Promise<VerifiedFirebasePhone> {
    if (this.verifying) return this.verifying;
    const currentPhone = this.phone;
    this.verifying = (async () => {
      const result = await this.sdk.signInWithPhoneCredential(id, code);
      if (sequence !== this.requestSequence || !currentPhone ||
          result.user.phoneNumber !== currentPhone || !result.user.uid) {
        throw new Error('auth/identity-mismatch');
      }
      const idToken = await result.user.getIdToken();
      if (!idToken) throw new Error('auth/missing-id-token');
      const verified = { uid: result.user.uid, phoneNumber: currentPhone, idToken };
      this.verified = verified;
      this.emit({ state: 'auto_verified', verified });
      return verified;
    })();
    try { return await this.verifying; }
    catch (error) {
      this.verifying = null;
      throw error;
    }
  }

  async verify(code: string): Promise<VerifiedFirebasePhone> {
    if (this.verified) return this.verified;
    if (this.verifying) return this.verifying;
    if (!/^\d{6}$/.test(code)) throw new Error('auth/invalid-verification-code');
    if (!this.verificationId || !this.phone) throw new Error('auth/missing-verification-id');
    return this.finishCredential(this.verificationId, code, this.requestSequence);
  }

  reset() {
    ++this.requestSequence;
    this.verificationId = null;
    this.phone = null;
    this.verified = null;
    this.verifying = null;
    this.listeners.clear();
    this.smsPreviouslyRequested = false;
  }
}
