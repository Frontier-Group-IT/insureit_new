/**
 * Server-only composition of official Firebase Admin verification and
 * approved customer identity mapping. This is not a public HTTP endpoint.
 * Dependencies must be injected by trusted backend wiring.
 */
import { makeRevocationCheckingFirebaseVerifier, type FirebaseAdminAuth } from './firebase-admin-verifier';
import {
  authorizeFirebaseCustomer,
  type BindingResult,
  type IdentityLinkStore,
} from './server-identity-binding';

export type FirebaseBindingBackend = Readonly<{
  verify: (idToken: string, nowSeconds: number) => Promise<BindingResult>;
}>;

/** No client-provided profile ID or phone number is accepted. */
export function createFirebaseBindingBackend(
  firebaseAdminAuth: FirebaseAdminAuth,
  identityStore: IdentityLinkStore,
): FirebaseBindingBackend {
  const verify = makeRevocationCheckingFirebaseVerifier(firebaseAdminAuth);
  return {
    verify: (idToken, nowSeconds) =>
      authorizeFirebaseCustomer(idToken, verify, identityStore, nowSeconds),
  };
}
