/**
 * SOURCE-ONLY future Customer Firebase approved-cohort access resolver.
 * No public endpoint. No client-controlled feature flag/approval mode.
 * NEVER wired into deployed v7 canary bridge. No production schema deployed.
 */
import {checkFutureCustomerFirebaseRolloutGate} from './customer-firebase-general-rollout-gate.mjs';
import {FIREBASE_CUSTOMER_PROJECT} from './customer-firebase-session-policy.mjs';

const disabled = reason => Object.freeze({ok:false,reason});
const SHA = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function digestUid(uid) {
  const bytes = new TextEncoder().encode(FIREBASE_CUSTOMER_PROJECT + ':' + uid);
  const hash = await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
/**
 * serverMode: a CODE-OWNED option, never a field copied from HTTP body/query.
 * DB supplied must be a trusted service-role-only client initialized server
 * side. Both default and any query failure must DENY wider cohorts.
 */
export async function resolveCustomerFirebaseCohort({
  db, principal, nowSeconds, serverMode='canary',
} = {}) {
  if (!Number.isSafeInteger(nowSeconds) || !principal?.firebase ||
      !principal?.profile || !principal?.authUser || !principal?.link) {
    return disabled('trusted_identity_required');
  }
  if (serverMode === 'canary') {
    return checkFutureCustomerFirebaseRolloutGate({principal,mode:'canary'});
  }
  if (serverMode !== 'approved_cohort') return disabled('rollout_mode_disabled');
  if (!db?.from || !UUID.test(principal.profile.id??'')) {
    return disabled('server_context_missing');
  }
  // Controls table must exist and explicitly be enabled by separately approved
  // privileged admin process. Its absence or any query failure blocks rollout.
  const control=await db.from('customer_firebase_rollout_control')
    .select('singleton,enabled,paused').eq('singleton',true).maybeSingle();
  if (control?.error || !control?.data || control.data.singleton !== true ||
      control.data.enabled !== true || control.data.paused !== false) {
    return disabled('cohort_kill_switch_closed');
  }
  // Latest row only; a later denial or revocation supersedes an approval.
  const query=await db.from('customer_firebase_enrollment_reviews')
    .select('id,customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,consent_at,ownership_verified_at,recovery_verified_at,cohort_approved_at,reviewed_at,expires_at,evidence_digest')
    .eq('customer_profile_id',principal.profile.id).order('id',{ascending:false}).limit(1);
  if (query?.error || !Array.isArray(query?.data) || query.data.length !== 1) {
    return disabled('cohort_review_unavailable');
  }
  const review=query.data[0];
  if (!review || review.decision !== 'approved' ||
      review.customer_profile_id !== principal.profile.id ||
      review.uid_digest !== await digestUid(principal.firebase.uid) ||
      !Number.isSafeInteger(review.id) ||
      !SHA.test(review.evidence_digest??'') ||
      !UUID.test(review.reviewer_id??'') ||
      !review.consent_at || !review.ownership_verified_at ||
      !review.recovery_verified_at || !review.cohort_approved_at ||
      !review.reviewed_at || !review.expires_at) {
    return disabled('cohort_review_not_approved');
  }
  const timestamps=[
    'consent_at','ownership_verified_at','recovery_verified_at','cohort_approved_at',
    'reviewed_at','expires_at',
  ].map(field=>Date.parse(review[field]));
  const [consent,ownership,recovery,cohort,reviewed,expires]=timestamps;
  if (timestamps.some(v=>!Number.isFinite(v)) || reviewed > nowSeconds*1000 ||
      expires <= nowSeconds*1000 || expires - reviewed > 14*24*60*60*1000 ||
      [consent,ownership,recovery,cohort].some(v=>v>reviewed)) {
    return disabled('cohort_review_expired');
  }
  // A cohort is never inferred from phone possession. The DB review must
  // come from a trusted operator system which reviewed the phone collision
  // inventory. For shared numbers a second active IT reviewer is mandatory.
  const collisions=await db.rpc('customer_firebase_phone_collision_counts',{
    p_customer_id:principal.profile.id,
  });
  const cc=Array.isArray(collisions?.data)?collisions.data[0]:collisions?.data;
  if (collisions?.error || !cc ||
      !Number.isSafeInteger(cc.non_customer_count) ||
      !Number.isSafeInteger(cc.other_customer_count) ||
      cc.non_customer_count < 0 || cc.other_customer_count < 0) {
    return disabled('cohort_collision_audit_unavailable');
  }
  const shared=cc.non_customer_count>0 || cc.other_customer_count>0;
  if (shared) {
    const secondary=review.second_reviewer_id;
    if (!UUID.test(secondary??'') || secondary===review.reviewer_id ||
        secondary===principal.profile.id) return disabled('shared_phone_review_not_approved');
    const s=await db.from('profiles').select('id,role,is_active')
      .eq('id',secondary).maybeSingle();
    if (s?.error || !s?.data || s.data.id!==secondary ||
        s.data.role!=='it_super_user' || s.data.is_active!==true) {
      return disabled('shared_phone_review_not_approved');
    }
  }
  // Reviewer must STILL be a privileged active person at login time.
  const op=await db.from('profiles').select('id,role,is_active')
    .eq('id',review.reviewer_id).maybeSingle();
  if (op?.error || !op?.data || op.data.id!==review.reviewer_id ||
      op.data.role!=='it_super_user' || op.data.is_active!==true) {
    return disabled('cohort_reviewer_inactive');
  }
  return checkFutureCustomerFirebaseRolloutGate({
    principal,mode:'approved_cohort',
    serverCohortApproval:{
      source:'restricted_operator_audit',
      profileId:review.customer_profile_id,
      firebaseUid:principal.firebase.uid,
      operatorEnrollmentApproved:true,
      authCredentialRecoveryVerified:true,
      cohortReleaseApproved:true,
      sharedPhoneIdentityReviewComplete:true,
    },
  });
}
