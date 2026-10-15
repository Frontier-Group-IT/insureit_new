import { customerAuthAlias, isApprovedAuthAlias } from './customer-firebase-session-alias.mjs';

/**
 * Existing-alias validator ONLY. No live OTP request may create or modify
 * Supabase Auth identity, regardless of environment variables or caller input.
 *
 * This matters because existing phone-only Customer auth.users rows have
 * password hashes: adding a deterministic email alias may expose an
 * additional email/password credential surface. Only an independently
 * approved, recovery-backed manual canary tool may provision an alias and
 * rotate the existing password at the same time.
 */
export async function ensureCustomerSupabaseSessionAlias({
  authUser, customerProfileId, enabled,
}) {
  const deny = reason => ({ ok: false, reason });
  const alias = customerAuthAlias(customerProfileId);
  if (!alias || !authUser || authUser.id !== customerProfileId) {
    return deny('invalid_customer_auth_identity');
  }
  if (isApprovedAuthAlias(customerProfileId, authUser.email) &&
      authUser.email_confirmed_at) {
    return { ok: true, authUser };
  }
  if (authUser.email || authUser.email_confirmed_at) {
    return deny('existing_auth_email_not_system_owned');
  }
  // Even an accidental server-side JIT flag cannot write to Auth.
  return deny(enabled ? 'manual_alias_required' : 'alias_provision_disabled');
}
