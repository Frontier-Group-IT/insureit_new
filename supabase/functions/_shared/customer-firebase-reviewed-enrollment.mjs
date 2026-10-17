/**
 * PHASE B: privileged, READ-ONLY review resolver. NOT a public endpoint.
 *
 * The only trusted proof is a restricted append-only server audit row.
 * Request JSON / flags / phone possession are NEVER customer-ownership proof.
 * No inserts, credential writes, Supabase sessions or Firebase UID approvals.
 */
import { canonicalIndianPhone, FIREBASE_CUSTOMER_PROJECT } from './customer-firebase-session-policy.mjs';
import { customerAuthAlias } from './customer-firebase-session-alias.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const deny = reason => Object.freeze({ok:false,reason});
const APP = FIREBASE_CUSTOMER_PROJECT;

/** Hash an unpredictable Firebase UID; never persist/return raw UID in reviews. */
async function uidDigest(uid) {
  const bytes = new TextEncoder().encode(APP + ':' + uid);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), v=>v.toString(16).padStart(2,'0')).join('');
}
const exactOne = result => result && !result.error && result.data && typeof result.data === 'object';

/**
 * Both tokens must be independently verified server-side. A Customer's token
 * cannot impersonate an IT Super User. Staff and Customer may SHARE a phone;
 * never infer a Customer UUID from Firebase phone possession.
 *
 * DATABASE EXPECTATIONS (source-only migration, NOT applied in production):
 *  - service-only phone collision RPC; no client-side phone inventory claims
 *  - append-only, restricted operator-reviewed consent/ownership decisions
 *  - a negative/revoked NEWEST decision overrides all earlier approvals
 */
export async function prepareReviewedCustomerEnrollment({
  db, firebaseAdmin, customerFirebaseIdToken, operatorSupabaseAccessToken,
  targetCustomerUuid, nowSeconds,
} = {}) {
  if (!Number.isSafeInteger(nowSeconds) ||
      typeof targetCustomerUuid !== 'string' || !UUID.test(targetCustomerUuid) ||
      typeof customerFirebaseIdToken !== 'string' ||
      customerFirebaseIdToken.length < 100 || customerFirebaseIdToken.length > 16384 ||
      typeof operatorSupabaseAccessToken !== 'string' ||
      operatorSupabaseAccessToken.length < 100 || operatorSupabaseAccessToken.length > 16384) {
    return deny('request_not_eligible');
  }
  if (!db?.auth?.getUser || !db?.auth?.admin?.getUserById ||
      !db?.from || !db?.rpc || !firebaseAdmin?.verifyIdToken) {
    return deny('trusted_providers_unavailable');
  }

  // Supabase Auth verifies the OPERATOR session, never user-supplied role flags.
  const operator = await db.auth.getUser(operatorSupabaseAccessToken).catch(()=>null);
  if (!operator || operator.error || !operator.data?.user?.id ||
      !UUID.test(operator.data.user.id)) return deny('operator_session_invalid');
  const operatorUuid = operator.data.user.id;
  if (operatorUuid === targetCustomerUuid) return deny('separate_operator_required');
  const operatorProfile = await db.from('profiles')
    .select('id,role,is_active').eq('id',operatorUuid).maybeSingle();
  if (!exactOne(operatorProfile) || operatorProfile.data.id !== operatorUuid ||
      operatorProfile.data.role !== 'it_super_user' ||
      operatorProfile.data.is_active !== true) return deny('operator_not_authorized');

  let verified;
  try {
    verified = await firebaseAdmin.verifyIdToken(customerFirebaseIdToken,true);
  } catch {
    return deny('firebase_identity_invalid');
  }
  if (!verified || verified.aud !== APP ||
      verified.iss !== 'https://securetoken.google.com/' + APP ||
      verified.firebase?.sign_in_provider !== 'phone' ||
      typeof verified.uid !== 'string' || !verified.uid ||
      typeof verified.phone_number !== 'string' ||
      !Number.isSafeInteger(verified.auth_time) ||
      verified.auth_time > nowSeconds + 30 ||
      nowSeconds - verified.auth_time > 300) {
    return deny('firebase_identity_invalid');
  }

  // Caller selects the EXACT desired Customer UUID; NEVER auto-pick a record
  // because a phone happens to match multiple Customer/staff principals.
  const [profile,auth,conflicts] = await Promise.all([
    db.from('profiles').select('id,role,is_active,phone')
      .eq('id',targetCustomerUuid).maybeSingle(),
    db.auth.admin.getUserById(targetCustomerUuid),
    db.rpc('customer_firebase_phone_collision_counts',{p_customer_id:targetCustomerUuid}),
  ]);
  if (!exactOne(profile) || profile.data.id !== targetCustomerUuid ||
      profile.data.role !== 'customer' || profile.data.is_active !== true ||
      !auth || auth.error || !auth.data?.user ||
      auth.data.user.id !== targetCustomerUuid ||
      auth.data.user.is_anonymous === true ||
      (auth.data.user.banned_until &&
        Date.parse(auth.data.user.banned_until) > nowSeconds * 1000)) {
    return deny('canonical_customer_not_eligible');
  }
  if (canonicalIndianPhone(profile.data.phone) !== verified.phone_number ||
      canonicalIndianPhone(auth.data.user.phone) !== verified.phone_number) {
    return deny('canonical_phone_mismatch');
  }
  // A missing, permission-denied or malformed collision query MUST fail closed.
  const cc = Array.isArray(conflicts?.data) ? conflicts.data[0] : conflicts?.data;
  if (conflicts?.error || !cc ||
      !Number.isSafeInteger(cc.non_customer_count) || cc.non_customer_count < 0 ||
      !Number.isSafeInteger(cc.other_customer_count) || cc.other_customer_count < 0) {
    return deny('collision_inventory_unavailable');
  }
  const shared = cc.non_customer_count > 0 || cc.other_customer_count > 0;

  // Immutable link conflicts across ALL Customers (UID -> profile, profile -> UID).
  const [uidResult, customerResult] = await Promise.all([
    db.from('customer_firebase_identity_links')
      .select('firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active')
      .eq('firebase_project_id',APP).eq('firebase_uid',verified.uid),
    db.from('customer_firebase_identity_links')
      .select('firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active')
      .eq('firebase_project_id',APP).eq('profile_id',targetCustomerUuid),
  ]);
  if (uidResult?.error || customerResult?.error ||
      !Array.isArray(uidResult?.data) || !Array.isArray(customerResult?.data)) {
    return deny('link_inventory_unavailable');
  }
  const links = [...uidResult.data,...customerResult.data.filter(x =>
    !uidResult.data.some(y => y.firebase_uid === x.firebase_uid))];
  if (links.length > 1 || links.some(link =>
      link.profile_id !== targetCustomerUuid ||
      link.firebase_uid !== verified.uid ||
      link.verified_phone_at_approval !== verified.phone_number ||
      link.is_approved !== true || link.is_active !== true)) {
    return deny('immutable_identity_conflict');
  }

  // The latest Customer review is authoritative. Never accept older APPROVED
  // rows after a REVOKED or DENIED decision, including for a different UID.
  const reviewQuery = await db.from('customer_firebase_enrollment_reviews')
    .select('id,customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,evidence_digest,consent_at,ownership_verified_at,recovery_verified_at,cohort_approved_at,reviewed_at,expires_at')
    .eq('customer_profile_id',targetCustomerUuid).order('id',{ascending:false}).limit(1);
  if (reviewQuery?.error || !Array.isArray(reviewQuery?.data)) {
    return deny('operator_review_unavailable');
  }
  const review = reviewQuery.data[0];
  if (!review || review.decision !== 'approved') return deny('independent_customer_review_required');
  const digest = await uidDigest(verified.uid);
  if (review.customer_profile_id !== targetCustomerUuid || review.uid_digest !== digest ||
      !SHA.test(review.evidence_digest ?? '') ||
      !UUID.test(review.reviewer_id ?? '') || review.reviewer_id !== operatorUuid ||
      !Number.isSafeInteger(review.id) ||
      !review.consent_at || !review.ownership_verified_at ||
      !review.reviewed_at || !review.expires_at) {
    return deny('operator_review_mismatch');
  }
  const reviewTime = Date.parse(review.reviewed_at);
  const consentTime = Date.parse(review.consent_at);
  const proofTime = Date.parse(review.ownership_verified_at);
  const expiryTime = Date.parse(review.expires_at);
  if (![reviewTime,consentTime,proofTime,expiryTime].every(Number.isFinite) ||
      reviewTime > nowSeconds*1000 || consentTime > nowSeconds*1000 ||
      proofTime > nowSeconds*1000 || expiryTime <= nowSeconds*1000 ||
      consentTime > reviewTime || proofTime > reviewTime ||
      reviewTime > expiryTime || expiryTime - reviewTime > 14*24*60*60*1000) {
    return deny('operator_review_expired');
  }
  // Shared phone accounts need a SECOND independent, distinct active reviewer.
  if (shared) {
    const secondaryId = review.second_reviewer_id;
    if (!UUID.test(secondaryId ?? '') || secondaryId === operatorUuid ||
        secondaryId === targetCustomerUuid) return deny('shared_phone_second_review_required');
    const second = await db.from('profiles').select('id,role,is_active')
      .eq('id',secondaryId).maybeSingle();
    if (!exactOne(second) || second.data.id !== secondaryId ||
        second.data.role !== 'it_super_user' || second.data.is_active !== true) {
      return deny('shared_phone_second_review_required');
    }
  }
  // A real Auth email is never overwritten. A missing reserved alias is only
  // a recovery-gated pending action, NOT a password-reset authorization.
  const desiredAlias = customerAuthAlias(targetCustomerUuid);
  if (!desiredAlias || (auth.data.user.email &&
      auth.data.user.email.toLowerCase() !== desiredAlias)) {
    return deny('existing_real_auth_email_requires_review');
  }
  const hasAlias = auth.data.user.email?.toLowerCase() === desiredAlias &&
    !!auth.data.user.email_confirmed_at;
  if (!hasAlias) return Object.freeze({
    ok:true,stage:'approved_enrollment_requires_auth_recovery',
    sameExistingUuid:true,sharedPhoneReviewed:shared,
    writesPerformed:0,
  });
  if (links.length === 0) return Object.freeze({
    ok:true,stage:'operator_approved_atomic_uid_enrollment_pending',
    sameExistingUuid:true,sharedPhoneReviewed:shared,
    writesPerformed:0,
  });
  if (!review.recovery_verified_at || !review.cohort_approved_at ||
      !Number.isFinite(Date.parse(review.recovery_verified_at)) ||
      !Number.isFinite(Date.parse(review.cohort_approved_at)) ||
      Date.parse(review.recovery_verified_at) > reviewTime ||
      Date.parse(review.cohort_approved_at) > reviewTime ||
      Date.parse(review.cohort_approved_at) > nowSeconds*1000) {
    return deny('limited_cohort_release_not_approved');
  }
  return Object.freeze({
    ok:true,stage:'ready_for_explicit_limited_cohort',
    sameExistingUuid:true,sharedPhoneReviewed:shared,
    writesPerformed:0,
  });
}
