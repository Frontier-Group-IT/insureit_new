/**
 * OFFLINE POC: Firebase principal resolution from a TRUSTED JWT claims object.
 * No database, network, secret access, auth issuance, or production integration.
 * A mapping must be provisioned by a trusted server after conflict review.
 */
export type FirebasePrincipal = Readonly<{
  iss: string; aud: string; sub: string; role: string;
}>;
export type ApprovedMapping = Readonly<{
  firebaseUid: string; supabaseUserId: string;
  active: boolean; reviewed: boolean;
}>;
export type IdentityResolution =
  | { status: 'denied'; reason: string }
  | { status: 'resolved'; supabaseUserId: string };

const projectId = 'insureit-customer-auth';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Only call this with server-verified Firebase claims; never trust caller data.
 * Caller must separately validate revocation, temporal claims and token signature.
 * `role` is the third-party JWT PostgREST role, not an INSUREIT profile role.
 */
export function resolveApprovedPrincipal(
  claims: FirebasePrincipal,
  mappings: readonly ApprovedMapping[],
): IdentityResolution {
  if (claims.iss !== 'https://securetoken.google.com/' + projectId ||
      claims.aud !== projectId ||
      claims.role !== 'authenticated' ||
      !claims.sub?.trim()) return { status: 'denied', reason: 'invalid_principal' };

  const matches = mappings.filter((m) => m.firebaseUid === claims.sub);
  if (matches.length !== 1) return { status: 'denied', reason: 'mapping_missing_or_ambiguous' };
  const mapped = matches[0];
  if (!mapped.active || !mapped.reviewed || !uuid.test(mapped.supabaseUserId)) {
    return { status: 'denied', reason: 'mapping_not_authorized' };
  }
  const competing = mappings.some((m) => m !== mapped &&
    m.active && m.supabaseUserId === mapped.supabaseUserId);
  if (competing) return { status: 'denied', reason: 'conflicting_identity_mapping' };
  return { status: 'resolved', supabaseUserId: mapped.supabaseUserId };
}
