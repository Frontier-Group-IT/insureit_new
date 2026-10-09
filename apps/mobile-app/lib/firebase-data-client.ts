/**
 * Separate Firebase-token Supabase client for a future Customer-only rollout.
 *
 * Firebase manages its own auth session. Supabase third-party Auth uses a
 * supported accessToken callback for Data API / Storage / Realtime requests.
 * This client does not call supabase.auth.setSession(), does not replace the
 * current Supabase client and never stores service-role credentials.
 *
 * IMPORTANT: instantiate only after the Firebase provider and identity-aware
 * database policies have been configured and verified. Do not use this client
 * with existing auth.uid()-based RLS unchanged.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type FirebaseAccessTokenProvider = () => Promise<string | null>;

export function createCustomerFirebaseDataClient(
  url: string,
  publicKey: string,
  getFirebaseIdToken: FirebaseAccessTokenProvider,
): SupabaseClient {
  if (!url.startsWith('https://') || !publicKey) {
    throw new Error('Missing trusted Supabase public client configuration.');
  }
  return createClient(url, publicKey, {
    accessToken: async () => {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Firebase login required for customer data access.');
      return token;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
