/**
 * Read-only, offline all-Customer Firebase migration planner.
 * Never fetches tokens, writes Auth identities or approves UID mappings.
 * Input must come from a trusted full inventory; returned decisions are NOT
 * authorization to bind a Firebase UID or change a Supabase Auth account.
 */
import { customerAuthAlias } from './customer-firebase-session-alias.mjs';
import { canonicalIndianPhone, FIREBASE_CUSTOMER_PROJECT } from './customer-firebase-session-policy.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const GENERAL_CUSTOMER_ROLLOUT_STAGES = Object.freeze([
  'inactive_or_invalid_customer',
  'missing_or_wrong_auth_identity',
  'phone_identity_mismatch',
  'phone_inventory_unavailable',
  'inspection_time_unavailable',
  'firebase_link_inventory_unavailable',
  'firebase_uid_conflict',
  'firebase_link_requires_review',
  'existing_auth_email_requires_review',
  'shared_phone_review',
  'independent_ownership_proof_required',
  'approved_link_requires_auth_recovery',
  'ready_existing_session',
]);

const result = (stage, flags = []) => Object.freeze({
  stage, flags: Object.freeze([...new Set(flags)].sort()),
});

/**
 * Review one EXISTING Customer without reading any Firebase ID token.
 * relatedProfiles MUST be the complete active/inactive profile phone inventory
 * from an independently authorized, restricted server-side query.
 * links MUST include all mappings for this Customer (plus any UID conflicts
 * discovered by a separately verified Firebase Admin token).
 */
export function classifyCustomerFirebaseReadiness({
  profile, authUser, links, relatedProfiles, nowSeconds,
} = {}) {
  if (!Number.isSafeInteger(nowSeconds)) return result('inspection_time_unavailable');
  if (!profile || typeof profile.id !== 'string' || !UUID.test(profile.id) ||
      profile.role !== 'customer' || profile.is_active !== true) {
    return result('inactive_or_invalid_customer');
  }
  if (!authUser || authUser.id !== profile.id || authUser.is_anonymous === true ||
      (typeof authUser.banned_until === 'string' &&
       Number.isFinite(Date.parse(authUser.banned_until)) &&
       Date.parse(authUser.banned_until) > nowSeconds * 1000)) {
    return result('missing_or_wrong_auth_identity');
  }
  const phone = canonicalIndianPhone(profile.phone);
  if (!phone || canonicalIndianPhone(authUser.phone) !== phone) {
    return result('phone_identity_mismatch');
  }
  if (!Array.isArray(relatedProfiles)) return result('phone_inventory_unavailable');
  const matches = relatedProfiles.filter(other =>
    other && other.id !== profile.id && canonicalIndianPhone(other.phone) === phone);
  const flags = [];
  if (matches.some(other => other.role !== 'customer')) flags.push('shared_with_non_customer');
  if (matches.some(other => other.role === 'customer')) flags.push('shared_with_customer');
  if (authUser.phone_confirmed_at == null) flags.push('auth_phone_unconfirmed');

  if (!Array.isArray(links)) return result('firebase_link_inventory_unavailable', flags);
  const suspicious = links.some(link =>
    !link || link.firebase_project_id !== FIREBASE_CUSTOMER_PROJECT ||
    link.profile_id !== profile.id || typeof link.firebase_uid !== 'string' ||
    !link.firebase_uid.trim());
  if (suspicious || links.length > 1) return result('firebase_uid_conflict', flags);

  const link = links[0];
  if (link && (link.is_approved !== true || link.is_active !== true ||
      link.verified_phone_at_approval !== phone)) {
    return result('firebase_link_requires_review', flags);
  }

  // A genuine existing email belongs to its owner and can NEVER be overwritten.
  const alias = customerAuthAlias(profile.id);
  if (authUser.email && (typeof authUser.email !== 'string' ||
      authUser.email.toLowerCase() !== alias)) {
    return result('existing_auth_email_requires_review', flags);
  }

  // Even an existing approved mapping merits another independent review before
  // any general cohort enrollment when the phone identifies multiple principals.
  if (matches.length > 0) return result('shared_phone_review', flags);
  if (!link) return result('independent_ownership_proof_required', flags);
  if (!authUser.email_confirmed_at || authUser.email?.toLowerCase() !== alias) {
    return result('approved_link_requires_auth_recovery', flags);
  }
  return result('ready_existing_session', flags);
}

/** Anonymous totals only; no phone, Auth UUID, Firebase UID or customer records. */
export function summarizeCustomerFirebaseRollout(records, relatedProfiles, nowSeconds) {
  if (!Number.isSafeInteger(nowSeconds)) return Object.freeze({ok:false,reason:'inspection_time_required'});
  if (!Array.isArray(records) || !Array.isArray(relatedProfiles)) {
    return Object.freeze({ok:false,reason:'complete_inventory_required'});
  }
  const counts = Object.fromEntries(GENERAL_CUSTOMER_ROLLOUT_STAGES.map(stage => [stage, 0]));
  const flags = { shared_with_non_customer:0, shared_with_customer:0, auth_phone_unconfirmed:0 };
  const seen = new Set();
  for (const record of records) {
    if (!record || !record.profile?.id || seen.has(record.profile.id)) {
      return Object.freeze({ok:false,reason:'duplicate_or_invalid_customer_inventory'});
    }
    seen.add(record.profile.id);
    const decision = classifyCustomerFirebaseReadiness({...record,relatedProfiles,nowSeconds});
    counts[decision.stage]++;
    for (const flag of decision.flags) flags[flag]++;
  }
  return Object.freeze({
    ok:true, analyzed:records.length,
    stages:Object.freeze(counts),
    riskFlags:Object.freeze(flags),
    writesPerformed:0,
  });
}
