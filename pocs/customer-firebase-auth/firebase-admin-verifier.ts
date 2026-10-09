/**
 * Firebase Admin SDK verifier adapter for server-only use.
 *
 * Real wiring should inject firebase-admin/auth Auth from a trusted backend.
 * This module has no credentials, service-role keys, environment access,
 * HTTP listener, or production route import.
 *
 * Do not use Firebase client SDK or decode raw JWTs to authorize a customer.
 */
import type { VerifiedToken } from './server-identity-binding';

export type FirebaseAdminToken = {
  uid: string;
  aud: string;
  iss: string;
  phone_number?: string;
  auth_time: number;
};
export type FirebaseAdminAuth = {
  verifyIdToken: (token: string, checkRevoked: boolean) => Promise<FirebaseAdminToken>;
};

export function makeRevocationCheckingFirebaseVerifier(
  adminAuth: FirebaseAdminAuth,
): (token: string) => Promise<VerifiedToken> {
  return async (token) => {
    if (typeof token !== 'string' || token.length < 16 || token.length > 16384) {
      throw new Error('Invalid Firebase ID token');
    }
    // Signature, expiry, project and revocation verification must come from
    // the official Firebase Admin Auth implementation.
    const verified = await adminAuth.verifyIdToken(token, true);
    if (!verified || typeof verified.uid !== 'string' || !verified.uid) {
      throw new Error('Firebase verified token lacks a UID');
    }
    return {
      uid: verified.uid,
      aud: verified.aud,
      iss: verified.iss,
      phone_number: verified.phone_number,
      auth_time: verified.auth_time,
    };
  };
}
