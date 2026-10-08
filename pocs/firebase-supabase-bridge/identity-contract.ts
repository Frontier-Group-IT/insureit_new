/**
 * ISOLATED SECURITY CONTRACT POC. Not a login endpoint and never issues sessions.
 * No production imports, environment variables, Firebase private credentials or writes.
 *
 * A verified Firebase identity must NOT be treated as an existing Supabase identity:
 * their subject identifiers belong to different namespaces.
 */
export type VerifiedFirebaseIdentity = Readonly<{
  issuer: string;
  audience: string;
  uid: string;
  phoneNumber: string | null;
  emailVerified?: boolean;
  authTime: number;
  issuedAt: number;
  expiresAt: number;
}>;

export type ExistingSupabaseIdentity = Readonly<{
  userId: string;
  normalizedPhone: string;
  isActiveCustomer: boolean;
}>;

export type BridgeDecision =
  | { status: 'blocked'; reason: string }
  | { status: 'identity_verified_only'; supabaseUserId: string; needsSupportedSessionIssuer: true };

const firebaseProjectId = 'insureit-customer-auth';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedIndianPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^91[6-9]\d{9}$/.test(digits)) return '+' + digits;
  if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
  return null;
}

/**
 * Accepts ALREADY VERIFIED Firebase identity data from a trusted verifier.
 * NEVER decode a caller-provided JWT and treat the claims as verified.
 * The eventual service must use Firebase Admin verifyIdToken with issuer,
 * audience, signature, expiration, token revocation and recent sign-in checks.
 * This is a pure authorization gate, NOT an implementation of token verification.
 */
export function evaluateIdentityBridge(
  firebase: VerifiedFirebaseIdentity,
  candidate: ExistingSupabaseIdentity | null,
  nowSeconds: number,
): BridgeDecision {
  if (firebase.issuer !== 'https://securetoken.google.com/' + firebaseProjectId ||
      firebase.audience !== firebaseProjectId ||
      !firebase.uid.trim()) return { status: 'blocked', reason: 'firebase_identity_invalid' };
  if (!Number.isFinite(nowSeconds) ||
      firebase.issuedAt > nowSeconds ||
      firebase.expiresAt <= nowSeconds ||
      nowSeconds - firebase.authTime > 300 ||
      firebase.authTime > nowSeconds) return { status: 'blocked', reason: 'verification_stale' };
  const verifiedPhone = normalizedIndianPhone(firebase.phoneNumber);
  if (!verifiedPhone) return { status: 'blocked', reason: 'verified_phone_missing' };
  if (!candidate || !candidate.isActiveCustomer || !uuidPattern.test(candidate.userId)) {
    return { status: 'blocked', reason: 'existing_customer_not_proven' };
  }
  if (normalizedIndianPhone(candidate.normalizedPhone) !== verifiedPhone) {
    return { status: 'blocked', reason: 'phone_mismatch' };
  }
  // A phone match alone is NOT sufficient to select among duplicate accounts.
  // A backend must prove uniqueness or require an explicit, authorized selection.
  // This contract models only one already-authorized candidate.
  return {
    status: 'identity_verified_only',
    supabaseUserId: candidate.userId,
    needsSupportedSessionIssuer: true,
  };
}
