/**
 * FUTURE SERVER-ONLY policy; NOT used by the live v7 Edge bridge.
 * Never read mode/evidence from the client. Server must fetch restricted,
 * immutable approval/audit records and verified Firebase principal itself.
 *
 * Designed for eventual migration off the two-UUID canary only after a
 * separate authorized change and independently rehearsed recovery process.
 */
import { checkCustomerSessionEligibility } from './customer-firebase-session-policy.mjs';
import { checkCustomerFirebaseCanary } from './customer-firebase-canary-gate.mjs';

const denied = reason => Object.freeze({ok:false,reason});

export function checkFutureCustomerFirebaseRolloutGate({
  principal, mode = 'canary', serverCohortApproval = null,
} = {}) {
  if (!principal || !principal.firebase || !principal.profile ||
      !principal.authUser || !principal.link) return denied('verified_principal_required');
  const verified = checkCustomerSessionEligibility(principal);
  if (!verified.ok) return denied('customer_session_not_eligible');

  if (mode === 'canary') {
    const canary = checkCustomerFirebaseCanary({
      profile:principal.profile,
      authUser:principal.authUser,
      link:principal.link,
      phone:principal.firebase.phone_number,
    });
    return canary.ok
      ? Object.freeze({ok:true, customerProfileId:verified.customerProfileId, cohort:'canary'})
      : denied('outside_approved_canary');
  }
  if (mode !== 'approved_cohort') return denied('rollout_mode_disabled');

  // This is a policy contract, not a trust boundary: integration MUST obtain
  // approvals from a restricted service-role query, never JSON or caller flags.
  const proof = serverCohortApproval;
  if (!proof || proof.source !== 'restricted_operator_audit' ||
      proof.profileId !== verified.customerProfileId ||
      proof.firebaseUid !== principal.firebase.uid ||
      proof.operatorEnrollmentApproved !== true ||
      proof.authCredentialRecoveryVerified !== true ||
      proof.cohortReleaseApproved !== true ||
      proof.sharedPhoneIdentityReviewComplete !== true) {
    return denied('restricted_cohort_approval_required');
  }
  return Object.freeze({ok:true,customerProfileId:verified.customerProfileId,cohort:'approved_cohort'});
}
