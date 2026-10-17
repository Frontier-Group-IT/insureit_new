/**
 * SOURCE-ONLY operator verified enrollment. NOT an Edge function / public API.
 * Production bridge v7 does NOT import this module. Explicit apply=false.
 *
 * Actual writes (if a future trusted operator handler and guarded SQL are
 * separately approved) are limited to the reviewed atomic database RPC:
 * no Auth credential changes, no new UUIDs, no phone-based customer selection.
 */
import {prepareReviewedCustomerEnrollment} from './customer-firebase-reviewed-enrollment.mjs';

const deny=reason=>Object.freeze({ok:false,reason});
export async function executeReviewedCustomerEnrollment({
  db, firebaseAdmin, customerFirebaseIdToken, operatorSupabaseAccessToken,
  targetCustomerUuid, nowSeconds, apply=false,
}={}) {
  if (apply !== true) return deny('explicit_operator_execution_required');
  const review=await prepareReviewedCustomerEnrollment({
    db,firebaseAdmin,customerFirebaseIdToken,operatorSupabaseAccessToken,
    targetCustomerUuid,nowSeconds,
  });
  if (!review.ok) return review;
  if (review.stage==='approved_enrollment_requires_auth_recovery') {
    return deny('auth_backup_restore_and_alias_required');
  }
  if (review.stage==='ready_for_explicit_limited_cohort') {
    return Object.freeze({ok:true,stage:'already_enrolled',writesPerformed:0});
  }
  if (review.stage!=='operator_approved_atomic_uid_enrollment_pending') {
    return deny('review_state_not_executable');
  }

  // Recheck live bearer proofs before any RPC; the SQL RPC will recheck
  // newest review, digest, phones, shared-staff collisions, alias, and UID
  // uniqueness while holding transaction locks.
  const op=await db.auth.getUser(operatorSupabaseAccessToken).catch(()=>null);
  const verified=await firebaseAdmin.verifyIdToken(customerFirebaseIdToken,true).catch(()=>null);
  if (!op || op.error || !op.data?.user?.id ||
      !verified || !verified.uid || verified.firebase?.sign_in_provider!=='phone' ||
      verified.aud!=='insureit-customer-auth' ||
      verified.iss!=='https://securetoken.google.com/insureit-customer-auth' ||
      !Number.isSafeInteger(verified.auth_time) ||
      verified.auth_time>nowSeconds+30 || nowSeconds-verified.auth_time>300) {
    return deny('verified_operator_or_firebase_identity_expired');
  }
  // Freshly reread latest review; no client-supplied evidence digest accepted.
  const pending=await db.from('customer_firebase_enrollment_reviews')
    .select('id,customer_profile_id,decision,reviewer_id,evidence_digest')
    .eq('customer_profile_id',targetCustomerUuid)
    .order('id',{ascending:false}).limit(1);
  const latest=pending?.data?.[0];
  if (pending?.error || !Array.isArray(pending?.data) ||
      pending.data.length!==1 || latest.decision!=='approved' ||
      latest.customer_profile_id!==targetCustomerUuid ||
      latest.reviewer_id!==op.data.user.id ||
      typeof latest.evidence_digest!=='string' ||
      !/^[a-f0-9]{64}$/.test(latest.evidence_digest)) {
    return deny('latest_operator_review_unavailable');
  }
  const result=await db.rpc('customer_firebase_enroll_reviewed',{
    p_profile_id:targetCustomerUuid,
    p_firebase_uid:verified.uid,
    p_verified_phone:verified.phone_number,
    p_operator_id:op.data.user.id,
    p_evidence_digest:latest.evidence_digest,
  });
  if (result?.error) return deny('atomic_enrollment_denied');
  if (result.data==='enrolled') return Object.freeze({
    ok:true,stage:'enrolled',writesPerformed:1,
  });
  if (result.data==='already_approved') return Object.freeze({
    ok:true,stage:'already_enrolled',writesPerformed:0,
  });
  return deny('unexpected_enrollment_result');
}
