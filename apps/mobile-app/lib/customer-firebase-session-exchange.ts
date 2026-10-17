/**
 * Phase 2/3 preparation for Customer Android Firebase *OTP-only* authentication.
 *
 * UNWIRED AND DISABLED BY DEFAULT. This does not import Firebase native code,
 * modify existing login/signup, or alter customer RLS/Storage/RPC architecture.
 *
 * Only Supabase Auth can issue the session. Firebase verifies recent SMS via a
 * revocation-checked Edge endpoint, which returns a genuine Supabase-generated
 * one-use challenge for a pre-existing Customer Auth UUID. Until the phone-only
 * session identity gate is reviewed/proven, the endpoint denies all real users.
 */
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { restoreCustomerSessionSnapshot } from './customer-account-vault';
import { supabase } from './supabase';

type SessionChallenge = Readonly<{
  code: 'exchange_ready';
  token_hash: string;
  profile_id: string;
}>;

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hashRe = /^[a-f0-9]{32,128}$/i;

export function firebaseOtpSessionGateEnabled(): boolean {
  return Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED === 'true';
}

function validChallenge(candidate: unknown): candidate is SessionChallenge {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const data = candidate as Record<string, unknown>;
  return data.code === 'exchange_ready' &&
    typeof data.profile_id === 'string' && uuidRe.test(data.profile_id) &&
    typeof data.token_hash === 'string' && hashRe.test(data.token_hash);
}

/** Takes ONLY an Android SDK-confirmed Firebase ID token, never an SMS OTP. */
export async function exchangeVerifiedFirebaseOtpForSupabaseSession(
  firebaseIdToken: string,
): Promise<Session> {
  if (!firebaseOtpSessionGateEnabled()) {
    throw new Error('Firebase OTP session exchange is not enabled for this app.');
  }
  if (typeof firebaseIdToken !== 'string' || firebaseIdToken.length < 100 ||
    firebaseIdToken.length > 16_384) {
    throw new Error('A verified Firebase sign-in is required.');
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !/^https:\/\//.test(url)) {
    throw new Error('Customer authentication is not configured.');
  }
  const snapshotResult = await supabase.auth.getSession();
  if (snapshotResult.error) throw new Error('Could not safeguard the existing session.');
  const previousSession = snapshotResult.data.session;

  let mayHaveInstalledSession = false;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/customer-firebase-session-bridge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${firebaseIdToken}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!response.ok) throw new Error('Customer phone identity is not ready for this login method.');
    const candidate: unknown = await response.json();
    if (!validChallenge(candidate)) {
      throw new Error('Invalid Customer login session challenge.');
    }

    // Firebase ID tokens NEVER enter setSession or Supabase's data client.
    // Supabase itself mints this one-use Auth challenge and the resulting
    // refreshable access/refresh token pair.
    mayHaveInstalledSession = true;
    const exchanged = await supabase.auth.verifyOtp({
      token_hash: candidate.token_hash,
      type: 'magiclink',
    });
    const session = exchanged.data.session;
    if (exchanged.error || !session?.access_token || !session.refresh_token ||
      !session.user || session.user.id !== candidate.profile_id) {
      throw new Error('Supabase rejected the verified Customer identity.');
    }
    const { data: verified, error: verifiedError } = await supabase.auth.getUser();
    if (verifiedError || !verified.user || verified.user.id !== candidate.profile_id) {
      throw new Error('The refreshed Customer authentication does not match.');
    }
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('id,role,is_active')
      .eq('id', candidate.profile_id)
      .maybeSingle();
    if (profileError || !profile || profile.role !== 'customer' ||
      !profile.is_active || profile.id !== candidate.profile_id) {
      throw new Error('The verified Customer account is not active.');
    }
    return session;
  } catch {
    // A rejected B-account login MUST NOT leak/replace the saved A-account.
    if (mayHaveInstalledSession) {
      try {
        if (previousSession) {
          await restoreCustomerSessionSnapshot(previousSession);
        } else {
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch {
        // Better no identity than silently retaining an unexpected user.
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }
    }
    // Never leak Firebase token, one-use challenge, phone or raw SDK errors.
    throw new Error('Secure Customer login could not be completed. Use the existing OTP login.');
  }
}
