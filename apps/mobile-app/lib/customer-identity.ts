/**
 * Customer App identity boundary for progressive Firebase OTP migration.
 *
 * Firebase sessions are not Supabase Auth sessions. Keep them as separate
 * tagged identities, with a Firebase bearer-token Supabase data client.
 * Existing staff/partner and legacy customer sessions remain unchanged.
 *
 * This is disabled by default pending comprehensive customer navigation,
 * Storage write and native-device regression.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { createCustomerFirebaseDataClient } from './firebase-data-client';

const modeKey = 'insureit:customer-auth-provider-v1';
export type CustomerIdentity =
  | { provider: 'supabase'; profileId: string; session: Session; data: SupabaseClient }
  | { provider: 'firebase'; profileId: string; firebaseUid: string; data: SupabaseClient };

export function firebaseCustomerRolloutEnabled(): boolean {
  return Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED === 'true';
}

export async function selectCustomerAuthProvider(provider: 'supabase' | 'firebase'): Promise<void> {
  if (provider === 'firebase' && !firebaseCustomerRolloutEnabled()) {
    throw new Error('Firebase customer sign-in is not enabled in this build.');
  }
  await AsyncStorage.setItem(modeKey, provider);
}

async function verifiedFirebaseCustomer(): Promise<CustomerIdentity | null> {
  if (!firebaseCustomerRolloutEnabled()) return null;
  const { getAuth } = await import('@react-native-firebase/auth');
  const uid = getAuth().currentUser?.uid;
  if (!uid) return null;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publicKey) throw new Error('Customer data access is not configured.');
  const client = createCustomerFirebaseDataClient(url, publicKey, async () => {
    const current = getAuth().currentUser;
    return current?.uid === uid ? current.getIdToken() : null;
  });
  const { data: profileId, error: resolverError } = await client.rpc('customer_firebase_profile_id');
  if (resolverError || typeof profileId !== 'string') {
    throw new Error('Your Firebase customer identity is not approved.');
  }
  const { data: profile, error: profileError } = await client
    .from('profiles').select('id,role,is_active').eq('id', profileId).maybeSingle();
  if (profileError || !profile || profile.role !== 'customer' || !profile.is_active) {
    throw new Error('Your InsureIT customer account is unavailable.');
  }
  return { provider: 'firebase', profileId, firebaseUid: uid, data: client };
}

/** Never return a fabricated Supabase Auth session for a Firebase account. */
export async function getCustomerIdentity(): Promise<CustomerIdentity | null> {
  const mode = firebaseCustomerRolloutEnabled()
    ? await AsyncStorage.getItem(modeKey)
    : 'supabase';
  if (mode === 'firebase') {
    // Fail closed: do not silently switch to a different persisted Supabase
    // user's identity when the selected Firebase token is unavailable.
    return verifiedFirebaseCustomer();
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) return null;
  return {
    provider: 'supabase',
    profileId: data.session.user.id,
    session: data.session,
    data: supabase,
  };
}
