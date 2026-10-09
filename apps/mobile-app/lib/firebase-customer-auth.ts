import { getAuth, type FirebaseAuthTypes } from '@react-native-firebase/auth';
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
): Promise<{ uid: string; phoneNumber: string; profileId: string }> {
  if (!pendingFlow) throw new Error('Request a verification code first.');
  const { uid, phoneNumber, idToken } = await pendingFlow.verify(code);
  pendingFlow = null;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publicKey) throw new Error('Supabase configuration missing');
  const response = await fetch(`${supabaseUrl}/functions/v1/customer-firebase-bind`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', apikey: publicKey },
    body: '{}',
  });
  if (!response.ok) throw new Error('Your verified phone could not be linked to an existing account.');
  const result: { status?: string; requiresTokenRefresh?: boolean } = await response.json();
  if (result.status !== 'linked' || result.requiresTokenRefresh !== true) {
    throw new Error('Firebase account linkage could not be confirmed.');
  }
  const firebaseUser: FirebaseAuthTypes.User | null = getAuth().currentUser;
  if (!firebaseUser || firebaseUser.uid !== uid) throw new Error('Firebase account changed during verification');
  const refreshedToken = await firebaseUser.getIdToken(true);
  const dataClient = createCustomerFirebaseDataClient(supabaseUrl, publicKey, async () => {
    const current = getAuth().currentUser;
    return current?.uid === uid ? current.getIdToken() : null;
  });
  const { data, error } = await dataClient.rpc('customer_firebase_profile_id');
  if (error || typeof data !== 'string') throw new Error('Customer authorization was not granted');
  // Fail closed if refreshed token cannot access the canonical profile.
  if (!refreshedToken) throw new Error('Could not refresh Firebase authorization');
  return { uid, phoneNumber, profileId: data };
}
