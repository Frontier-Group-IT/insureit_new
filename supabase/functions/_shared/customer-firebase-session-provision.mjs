import { customerAuthAlias, isApprovedAuthAlias } from './customer-firebase-session-alias.mjs';
import { canonicalIndianPhone } from './customer-firebase-session-policy.mjs';

/**
 * OPTIONAL JUST-IN-TIME AUTH-ID ALIAS, NEVER AUTO-ENABLED.
 * Only invoke after Firebase Admin revocation-checked phone identity,
 * exact approved Firebase UID↔active Customer Auth UUID link, and atomic
 * privileged rate consumption. Existing Auth UUID/phone are immutable.
 */
export async function ensureCustomerSupabaseSessionAlias({
  db, authUser, customerProfileId, enabled,
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
  // NEVER replace an actual or external Auth email; never allow confirmation
  // of a user-controlled email. Existing profile contact email is unrelated.
  if (authUser.email || authUser.email_confirmed_at) {
    return deny('existing_auth_email_not_system_owned');
  }
  if (!enabled) return deny('alias_provision_disabled');
  if (!canonicalIndianPhone(authUser.phone)) return deny('phone_unavailable');
  if (!db?.auth?.admin?.updateUserById || !db.auth.admin.getUserById) {
    return deny('admin_unavailable');
  }

  const originalPhone = authUser.phone;
  const originalPhoneConfirmed = authUser.phone_confirmed_at ?? null;
  const updated = await db.auth.admin.updateUserById(customerProfileId, {
    email: alias, email_confirm: true,
  });
  if (updated.error || updated.data?.user?.id !== customerProfileId) {
    return deny('auth_alias_provision_failed');
  }
  // Double-check persisted state, not merely the admin update return.
  const refreshed = await db.auth.admin.getUserById(customerProfileId);
  const next = refreshed.data?.user;
  if (refreshed.error || !next ||
      next.id !== customerProfileId || !isApprovedAuthAlias(next.id, next.email) ||
      !next.email_confirmed_at ||
      next.phone !== originalPhone ||
      (next.phone_confirmed_at ?? null) !== originalPhoneConfirmed) {
    // Never attempt destructive account compensation on a pre-existing user.
    // Halt and require explicit manual investigation if invariant drift occurs.
    return deny('auth_alias_postwrite_invariant_failed');
  }
  return { ok: true, authUser: next };
}
