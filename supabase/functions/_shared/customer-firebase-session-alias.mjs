/**
 * NON-DELIVERABLE, system-only Supabase Auth identity for users whose existing
 * Auth account is phone-only. The .invalid TLD is RFC 2606-reserved, never
 * an actual email inbox or customer contact address.
 *
 * This alias is NOT a Customer email and MUST NEVER be used to send mail,
 * show as contact information, or accept a password login. It is a candidate
 * implementation pending security review and an approved canary.
 */
export const CUSTOMER_AUTH_ALIAS_DOMAIN = 'customer-login.insureit.invalid';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function customerAuthAlias(profileId) {
  if (typeof profileId !== 'string' || !uuid.test(profileId)) return null;
  return `c-${profileId.toLowerCase()}@${CUSTOMER_AUTH_ALIAS_DOMAIN}`;
}
export function isApprovedAuthAlias(profileId, email) {
  const expected = customerAuthAlias(profileId);
  return expected !== null && typeof email === 'string' &&
    email.toLowerCase() === expected;
}
