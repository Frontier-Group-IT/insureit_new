/**
 * Firebase is PHONE-OTP VERIFICATION ONLY. Supabase Auth remains the session.
 * Android native SDK loads ONLY after explicit candidate feature flag is on.
 * No Firebase token is given to a Supabase data client or setSession.
 */
import type { Session, User } from '@supabase/supabase-js';
import { firebaseOtpSessionGateEnabled, exchangeVerifiedFirebaseOtpForSupabaseSession } from './customer-firebase-session-exchange';
import { FirebasePhoneOtpFlow } from './firebase-native-phone-flow';

let pending: FirebasePhoneOtpFlow | null = null;
let requestedPhone: string | null = null;

export async function sendCustomerFirebasePhoneOtp(phone: string): Promise<void> {
  if (!firebaseOtpSessionGateEnabled()) throw Error('Firebase Customer OTP is disabled.');
  const { createInstalledAndroidFirebaseOtpFlow } = await import('./firebase-installed-android-otp');
  pending = createInstalledAndroidFirebaseOtpFlow();
  requestedPhone = phone;
  try {
    await pending.send(phone);
  } catch (error) {
    pending = null;
    requestedPhone = null;
    throw error;
  }
}

export async function verifyCustomerFirebasePhoneOtp(
  phone: string, code: string,
): Promise<{ user: User; session: Session }> {
  if (!firebaseOtpSessionGateEnabled() || !pending || requestedPhone !== phone) {
    throw Error('Request a new verification code.');
  }
  let verified;
  try {
    verified = await pending.verify(code);
  } catch (error) {
    // Invalid code is retryable within the same Firebase confirmation.
    // Expired/malformed verification clears the pending flow internally.
    throw error;
  }
  pending = null;
  requestedPhone = null;
  try {
    const session = await exchangeVerifiedFirebaseOtpForSupabaseSession(verified.idToken);
    if (!session?.user?.id) throw Error('Supabase session unavailable.');
    return { user: session.user, session };
  } finally {
    // OTP-only integration: do not retain Firebase as a persistent app identity
    // after an actual SMS verification. Supabase refresh tokens own the session.
    try {
      const { getAuth, signOut } = await import('@react-native-firebase/auth');
      await signOut(getAuth());
    } catch {
      // Do not invalidate an already-issued, independently verified Supabase
      // session solely because Firebase native signout could not complete.
    }
  }
}

export function resetCustomerFirebaseOtp(): void {
  pending?.reset();
  pending = null;
  requestedPhone = null;
}
