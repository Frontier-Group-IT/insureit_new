/**
 * Strict single-account, MANUAL provisioning of a non-deliverable Auth email
 * identity on the same existing Supabase Auth UUID. Dry-run is the default.
 *
 * Never run against business Customer Auth without independent reviewed
 * approval. Do not run this from an Edge request or the app. No batch switch,
 * no Customer/profile/contact email changes, no new user creation.
 *
 * Example operator dry run:
 * CUSTOMER_AUTH_TARGET_UUID=<approved-id> SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 *   node scripts/customer-firebase-auth-alias-provision.mjs
 *
 * Production write additionally REQUIRES:
 *   --apply
 *   CUSTOMER_AUTH_ALIAS_WRITE_APPROVED=YES_SINGLE_CUSTOMER_UUID_APPROVED
 * and independent verified production Auth backup/recovery protocol.
 */
import { createClient } from '@supabase/supabase-js';
import { customerAuthAlias } from '../supabase/functions/_shared/customer-firebase-session-alias.mjs';
import { canonicalIndianPhone } from '../supabase/functions/_shared/customer-firebase-session-policy.mjs';

const apply = process.argv.includes('--apply');
const target = process.env.CUSTOMER_AUTH_TARGET_UUID;
const alias = customerAuthAlias(target);
const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reviewed = process.env.CUSTOMER_AUTH_ALIAS_WRITE_APPROVED ===
  'YES_SINGLE_CUSTOMER_UUID_APPROVED';
if (!alias || !url || !/^https:\/\/[^/]+\.supabase\.co\/?$/.test(url) ||
    !serviceRole || (apply && !reviewed)) {
  throw new Error('Refusing operation: missing allowed target/config or individual written approval');
}
const db = createClient(url, serviceRole, { auth: {
  persistSession: false, autoRefreshToken: false,
} });
const [{ data: profile, error: profileError }, { data: auth, error: authError }, { data: links, error: linksError }] =
  await Promise.all([
    db.from('profiles').select('id,role,is_active,phone').eq('id', target).maybeSingle(),
    db.auth.admin.getUserById(target),
    db.from('customer_firebase_identity_links')
      .select('profile_id,verified_phone_at_approval,is_approved,is_active')
      .eq('profile_id',target).eq('firebase_project_id','insureit-customer-auth')
      .limit(2),
  ]);
if (profileError || authError || linksError) throw Error('Identity preflight failed');
const user = auth?.user;
if (!profile || profile.role !== 'customer' || profile.is_active !== true ||
    !user || user.id !== target || !canonicalIndianPhone(user.phone) ||
    canonicalIndianPhone(user.phone) !== canonicalIndianPhone(profile.phone) ||
    !Array.isArray(links) || links.length !== 1 ||
    !links[0].is_approved || !links[0].is_active ||
    canonicalIndianPhone(links[0].verified_phone_at_approval) !== canonicalIndianPhone(user.phone)) {
  throw Error('Refusing provisioning: Customer identity/approved Firebase link mismatch');
}
if (user.email && user.email.toLowerCase() !== alias) {
  throw Error('Refusing provisioning: existing Auth email must never be overwritten');
}
if (user.email?.toLowerCase() === alias && user.email_confirmed_at) {
  console.info('NO CHANGE: approved Customer Auth UUID already uses the exact verified alias');
  process.exit(0);
}
if (!apply) {
  console.info('DRY RUN ONLY: one approved active Customer Auth UUID eligible; no records changed.');
  process.exit(0);
}
const beforePhoneConfirmed = user.phone_confirmed_at ?? null;
const beforePhone = user.phone;
const updated = await db.auth.admin.updateUserById(target, {
  email: alias, email_confirm: true,
});
if (updated.error || updated.data?.user?.id !== target) {
  throw new Error('Manual Auth identity update failed: inspect before any retry');
}
const checked = await db.auth.admin.getUserById(target);
if (checked.error || checked.data?.user?.id !== target ||
    checked.data.user.email?.toLowerCase() !== alias ||
    !checked.data.user.email_confirmed_at ||
    checked.data.user.phone !== beforePhone ||
    (checked.data.user.phone_confirmed_at ?? null) !== beforePhoneConfirmed) {
  throw Error('POST-WRITE INVARIANT FAILURE: halt rollout, investigate this UUID immediately');
}
console.info('SINGLE AUTH UUID updated and independently rechecked; phone and verification preserved.');
