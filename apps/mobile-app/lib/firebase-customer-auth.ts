import { getAuth } from '@react-native-firebase/auth';
import { createInstalledAndroidFirebaseOtpFlow } from './firebase-installed-android-otp';
import { createCustomerFirebaseDataClient } from './firebase-data-client';

/**
 * Native-only Firebase customer identity bootstrap.
 * Authenticates against a privileged backend before allowing data access.
 * Does not forge a Supabase Auth session.
 */
let pendingFlow: ReturnType<typeof createInstalledAndroidFirebaseOtpFlow> | null = null;

export function startFirebaseCustomerOtp() {
  pendingFlow = createInstalledAndroidFirebaseOtpFlow();
  return pendingFlow;
}

export async function sendFirebaseCustomerOtp(phone: string): Promise<void> {
  const flow = pendingFlow ?? startFirebaseCustomerOtp();
  await flow.send(phone);
}

export async function confirmFirebaseCustomerOtp(
  code: string,
  signup?: { fullName: string; email?: string },
): Promise<{ uid: string; phoneNumber: string; profileId: string }> {
  if (!pendingFlow) throw new Error('Request a verification code first.');
  const { uid, phoneNumber, idToken } = await pendingFlow.verify(code);
  pendingFlow = null;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publicKey) throw new Error('Supabase configuration missing');
  if (signup) {
    const registration = await fetch(`${supabaseUrl}/functions/v1/customer-firebase-signup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        apikey: publicKey,
      },
      body: JSON.stringify({ fullName: signup.fullName, ...(signup.email ? { email: signup.email } : {}) }),
    });
    if (!registration.ok) {
      const failure: { error?: string } = await registration.json().catch(() => ({}));
      // A verified existing phone uses the same canonical binding flow as
      // Login. Never provision a duplicate Supabase profile for that phone.
      if (registration.status !== 409 || failure.error !== 'phone_already_registered') {
        throw new Error('registration_' + (failure.error ?? 'unavailable'));
      }
    } else {
      const result: { status?: string; requiresBinding?: boolean } = await registration.json();
      if (result.status !== 'registered' || result.requiresBinding !== true) {
        throw new Error('Customer registration was not confirmed.');
      }
    }
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/customer-firebase-bind`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', apikey: publicKey },
    body: '{}',
  });
  if (!response.ok) {
    const detail: { error?: string } = await response.json().catch(() => ({}));
    throw new Error('bind_' + (detail.error ?? 'unavailable'));
  }
  const result: { status?: string; requiresTokenRefresh?: boolean } = await response.json();
  if (result.status !== 'linked' || result.requiresTokenRefresh !== true) {
    throw new Error('bind_unexpected_response');
  }
  const firebaseUser = getAuth().currentUser;
  if (!firebaseUser || firebaseUser.uid !== uid) throw new Error('Firebase account changed during verification');
  const refreshedToken = await firebaseUser.getIdToken(true);
  const dataClient = createCustomerFirebaseDataClient(supabaseUrl, publicKey, async () => {
    const current = getAuth().currentUser;
    return current?.uid === uid ? current.getIdToken() : null;
  });
  const { data, error } = await dataClient.rpc('customer_firebase_profile_id');
  if (error || typeof data !== 'string') throw new Error('authorization_profile_resolution_failed');
  // Fail closed if refreshed token cannot access the canonical profile.
  if (!refreshedToken) throw new Error('Could not refresh Firebase authorization');
  return { uid, phoneNumber, profileId: data };
}

/** Signup uses the same fresh native phone verification and canonical binder. */
export function confirmFirebaseCustomerSignup(
  code: string,
  signup: { fullName: string; email?: string },
): Promise<{ uid: string; phoneNumber: string; profileId: string }> {
  return confirmFirebaseCustomerOtp(code, signup);
}

/** A read-only, rate-limited backend eligibility check. Never read customer
 * profiles or auth.users directly from the unauthenticated mobile client. */
export type FirebaseCustomerRegistration = {
  status: 'registered' | 'not_registered' | 'signup_incomplete' | 'account_requires_review';
};

export async function checkFirebaseCustomerRegistration(phone: string): Promise<FirebaseCustomerRegistration> {
  if (!/^\+91[6-9]\d{9}$/.test(phone)) throw new Error('invalid-phone-number');
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !publicKey) throw new Error('registration_check_unavailable');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await fetch(`${baseUrl}/functions/v1/customer-firebase-registration-check`, {
      method: 'POST',
      headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
      signal: controller.signal,
    });
    if (!result.ok) {
      if (result.status === 429) throw new Error('too-many-requests');
      throw new Error('registration_check_unavailable');
    }
    const data: { status?: string } = await result.json();
    if (data.status !== 'registered' && data.status !== 'not_registered' && data.status !== 'signup_incomplete' && data.status !== 'account_requires_review') {
      throw new Error('registration_check_unavailable');
    }
    return { status: data.status };
  } finally {
    clearTimeout(timeout);
  }
}
