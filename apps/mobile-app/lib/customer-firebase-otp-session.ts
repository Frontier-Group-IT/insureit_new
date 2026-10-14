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
  signup?: { fullName: string; email?: string },
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
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !publicKey) throw Error('Customer backend is unavailable.');
    const base = supabaseUrl.replace(/\/$/, '');
    async function invokeFirebaseFunction(name: string, token: string, body: object): Promise<Response> {
      return fetch(`${base}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: publicKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    if (signup) {
      const registration = await invokeFirebaseFunction('customer-firebase-signup',
        verified.idToken, {
          fullName: signup.fullName.trim(),
          ...(signup.email?.trim() ? { email: signup.email.trim() } : {}),
        });
      if (!registration.ok) {
        const result: { error?: string } = await registration.json().catch(() => ({}));
        // A verified, already-existing phone must go through the strict
        // existing account binder, never create a duplicate Auth UUID.
        if (registration.status !== 409 || ![
          'phone_already_registered', 'firebase_identity_registered',
        ].includes(result.error ?? '')) {
          throw Error('Customer registration is unavailable.');
        }
      }
    }

    const linked = await invokeFirebaseFunction('customer-firebase-bind', verified.idToken, {});
    if (!linked.ok) throw Error('Verified phone could not be linked to an active customer.');
    const linkedResult: { status?: string; requiresTokenRefresh?: boolean } = await linked.json();
    if (linkedResult.status !== 'linked' || linkedResult.requiresTokenRefresh !== true) {
      throw Error('Verified customer identity is not active.');
    }
    const { getAuth } = await import('@react-native-firebase/auth');
    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser || firebaseUser.uid !== verified.uid ||
        firebaseUser.phoneNumber !== phone) {
      throw Error('Firebase verified identity changed after OTP.');
    }
    const refreshedFirebaseIdToken = await firebaseUser.getIdToken(true);
    const session = await exchangeVerifiedFirebaseOtpForSupabaseSession(refreshedFirebaseIdToken);
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
