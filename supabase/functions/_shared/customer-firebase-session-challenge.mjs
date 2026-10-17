/**
 * Supabase-issued session challenge. Never signs in or creates customers.
 * Unit-testable without Supabase credentials or Firebase tokens.
 *
 * Note: admin.generateLink('magiclink') can create a user if given an
 * unknown email. Therefore the caller MUST independently verify that the
 * email belongs to the EXACT existing approved Supabase Auth UUID.
 * This function also checks the returned UUID before releasing the token.
 */
const hexHash = /^[a-f0-9]{64}$/i;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function issueExistingCustomerSessionChallenge(db, gate) {
  if (!gate || gate.ok !== true ||
      typeof gate.customerProfileId !== 'string' || !uuid.test(gate.customerProfileId) ||
      typeof gate.verifiedExistingEmail !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gate.verifiedExistingEmail)) {
    return { ok: false, reason: 'identity_not_eligible' };
  }
  if (!db?.auth?.admin?.generateLink) {
    return { ok: false, reason: 'challenge_provider_unavailable' };
  }
  const { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email: gate.verifiedExistingEmail,
  });
  // Fixed-code diagnostics only: never log the email, token hash, UID, or raw
  // provider error. Continue to deny on every unexpected response shape.
  if (error) return { ok: false, reason: 'challenge_provider_rejected' };
  if (data?.user?.id !== gate.customerProfileId) {
    return { ok: false, reason: 'challenge_uuid_mismatch' };
  }
  if (typeof data?.user?.email !== 'string' ||
      data.user.email.toLowerCase() !== gate.verifiedExistingEmail.toLowerCase()) {
    return { ok: false, reason: 'challenge_email_mismatch' };
  }
  if (typeof data?.properties?.hashed_token !== 'string' ||
      (data.properties.hashed_token.length !== 64 || !hexHash.test(data.properties.hashed_token))) {
    return { ok: false, reason: 'challenge_hash_format_mismatch' };
  }
  return {
    ok: true,
    token_hash: data.properties.hashed_token,
    profile_id: gate.customerProfileId,
  };
}
