/**
 * Server-side Firebase identity binding authorization core.
 * No HTTP endpoint, secrets, DB writes or production integration.
 * Verifier MUST be Firebase Admin verifyIdToken(token, true).
 * Mapping lookup MUST use a trusted backend (never a caller profile UUID).
 */
export type VerifiedToken = Readonly<{
  uid: string;
  aud: string;
  iss: string;
  phone_number?: string;
  auth_time: number;
}>;
export type IdentityLink = Readonly<{
  firebaseUid: string;
  profileId: string;
  verifiedPhoneAtApproval: string;
  approved: boolean;
  active: boolean;
  profileRole: string;
  profileActive: boolean;
}>;
export type BindingResult =
  | { ok: true; profileId: string }
  | { ok: false; reason: string };
export type VerifiedTokenService = (idToken: string) => Promise<VerifiedToken>;
export type IdentityLinkStore = (firebaseUid: string) => Promise<readonly IdentityLink[]>;
const PROJECT = 'insureit-customer-auth';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function authorizeFirebaseCustomer(
  idToken: string,
  verifyRevokedFirebaseToken: VerifiedTokenService,
  findLinks: IdentityLinkStore,
  nowSeconds: number,
): Promise<BindingResult> {
  if (!idToken || !Number.isFinite(nowSeconds)) return { ok: false, reason: 'invalid_request' };
  let identity: VerifiedToken;
  try {
    identity = await verifyRevokedFirebaseToken(idToken);
  } catch {
    return { ok: false, reason: 'unverified_token' };
  }
  if (identity.aud !== PROJECT ||
      identity.iss !== 'https://securetoken.google.com/' + PROJECT ||
      !identity.uid ||
      !Number.isFinite(identity.auth_time) ||
      identity.auth_time > nowSeconds ||
      nowSeconds - identity.auth_time > 300 ||
      !/^\+91[6-9]\d{9}$/.test(identity.phone_number ?? '')) {
    return { ok: false, reason: 'invalid_identity' };
  }
  let links: readonly IdentityLink[];
  try {
    links = await findLinks(identity.uid);
  } catch {
    return { ok: false, reason: 'mapping_unavailable' };
  }
  if (links.length !== 1) return { ok: false, reason: 'mapping_ambiguous_or_missing' };
  const link = links[0];
  if (link.firebaseUid !== identity.uid ||
      link.verifiedPhoneAtApproval !== identity.phone_number ||
      !link.approved || !link.active ||
      !link.profileActive || link.profileRole !== 'customer' ||
      !UUID.test(link.profileId)) {
    return { ok: false, reason: 'mapping_not_authorized' };
  }
  return { ok: true, profileId: link.profileId };
}
