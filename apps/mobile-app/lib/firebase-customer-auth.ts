import { getAuth } from '@react-native-firebase/auth';
import { createInstalledAndroidFirebaseOtpFlow } from './firebase-installed-android-otp';
import { createCustomerFirebaseDataClient } from './firebase-data-client';
import {
  FirebaseCustomerOtpError,
  firebaseOtpFailure,
  firebaseOtpHttpFailure,
  recordFirebaseOtpStage,
} from './firebase-otp-errors';

/**
 * Native-only Firebase customer identity bootstrap.
 * Authenticates against a privileged backend before allowing data access.
 * Does not forge a Supabase Auth session.
 */
let pendingFlow: ReturnType<typeof createInstalledAndroidFirebaseOtpFlow> | null = null;
// Never cache SMS codes or ID tokens; retain only an ephemeral verified identity
// for a short retry if server binding fails after native OTP confirmation.
let verifiedPhone: { uid: string; phoneNumber: string; confirmedAt: number } | null = null;
const maxVerifiedRetryMs = 4 * 60 * 1000;

export function startFirebaseCustomerOtp() {
  pendingFlow = createInstalledAndroidFirebaseOtpFlow();
  verifiedPhone = null;
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
  let uid: string;
  let phoneNumber: string;
  let idToken: string;
  if (pendingFlow) {
    const confirmed = await pendingFlow.verify(code);
    uid = confirmed.uid;
    phoneNumber = confirmed.phoneNumber;
    idToken = confirmed.idToken;
    pendingFlow = null;
    verifiedPhone = { uid, phoneNumber, confirmedAt: Date.now() };
  } else if (verifiedPhone && Date.now() - verifiedPhone.confirmedAt <= maxVerifiedRetryMs) {
    // A retry after an *already verified* OTP reuses Firebase's authenticated
    // current user, not a client-provided identity or a previously cached token.
    const current = getAuth().currentUser;
    if (!current || current.uid !== verifiedPhone.uid ||
        current.phoneNumber !== verifiedPhone.phoneNumber) {
      verifiedPhone = null;
      throw new FirebaseCustomerOtpError('firebase_verification', 'customer/identity-unavailable');
    }
    uid = current.uid;
    phoneNumber = verifiedPhone.phoneNumber;
    try {
      idToken = await current.getIdToken(true);
    } catch (cause) {
      throw firebaseOtpFailure('token_refresh', cause);
    }
  } else {
    verifiedPhone = null;
    throw new FirebaseCustomerOtpError('firebase_verification', 'auth/session-expired');
  }
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publicKey) throw new Error('Supabase configuration missing');
  if (signup) {
    recordFirebaseOtpStage('customer_registration');
    let registration: Response;
    try {
      registration = await fetch(`${supabaseUrl}/functions/v1/customer-firebase-signup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        apikey: publicKey,
      },
      body: JSON.stringify({ fullName: signup.fullName, ...(signup.email ? { email: signup.email } : {}) }),
      });
    } catch (cause) {
      throw firebaseOtpFailure('customer_registration', cause);
    }
    if (!registration.ok) {
      const failure: { error?: string } = await registration.json().catch(() => ({}));
      // A verified existing phone uses the same canonical binding flow as
      // Login. Never provision a duplicate Supabase profile for that phone.
      if (registration.status !== 409 || failure.error !== 'phone_already_registered') {
        throw firebaseOtpHttpFailure('customer_registration', registration.status);
      }
    } else {
      const result: { status?: string; requiresBinding?: boolean } = await registration.json();
      if (result.status !== 'registered' || result.requiresBinding !== true) {
        throw new FirebaseCustomerOtpError('customer_registration', 'customer/rejected');
      }
    }
    recordFirebaseOtpStage('customer_registration', 'ok');
  }

  recordFirebaseOtpStage('customer_binding');
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/customer-firebase-bind`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', apikey: publicKey },
    body: '{}',
    });
  } catch (cause) {
    throw firebaseOtpFailure('customer_binding', cause);
  }
  if (!response.ok) {
    const failure = firebaseOtpHttpFailure('customer_binding', response.status);
    recordFirebaseOtpStage(failure.stage, failure.code);
    throw failure;
  }
  recordFirebaseOtpStage('customer_binding', 'ok');
  const result: { status?: string; requiresTokenRefresh?: boolean } = await response.json();
  if (result.status !== 'linked' || result.requiresTokenRefresh !== true) {
    throw new FirebaseCustomerOtpError('customer_binding', 'customer/rejected');
  }
  const firebaseUser = getAuth().currentUser;
  if (!firebaseUser || firebaseUser.uid !== uid) throw new FirebaseCustomerOtpError('token_refresh', 'customer/identity-unavailable');
  recordFirebaseOtpStage('token_refresh');
  let refreshedToken: string;
  try {
    refreshedToken = await firebaseUser.getIdToken(true);
  } catch (cause) {
    throw firebaseOtpFailure('token_refresh', cause);
  }
  if (!refreshedToken) throw new FirebaseCustomerOtpError('token_refresh', 'customer/rejected');
  recordFirebaseOtpStage('token_refresh', 'ok');
  recordFirebaseOtpStage('customer_authorization');
  const dataClient = createCustomerFirebaseDataClient(supabaseUrl, publicKey, async () => {
    const current = getAuth().currentUser;
    return current?.uid === uid ? current.getIdToken() : null;
  });
  const { data, error } = await dataClient.rpc('customer_firebase_profile_id');
  if (error || typeof data !== 'string') {
    recordFirebaseOtpStage('customer_authorization', 'customer/forbidden');
    throw new FirebaseCustomerOtpError('customer_authorization', 'customer/forbidden');
  }
  // Fail closed if refreshed token cannot access the canonical profile.
  recordFirebaseOtpStage('customer_authorization', 'ok');
  verifiedPhone = null;
  return { uid, phoneNumber, profileId: data };
}

/** Signup uses the same fresh native phone verification and canonical binder. */
export function confirmFirebaseCustomerSignup(
  code: string,
  signup: { fullName: string; email?: string },
): Promise<{ uid: string; phoneNumber: string; profileId: string }> {
  return confirmFirebaseCustomerOtp(code, signup);
}
