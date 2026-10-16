/**
 * Pure server-side enrollment transaction preflight. Requires an independently
 * Firebase-Admin-verified token and a separately authorized canonical Customer.
 * This library never writes Auth users or approves links by itself.
 */
import { assessCustomerFirebaseEnrollment } from './customer-firebase-migration-preflight.mjs';
export async function prepareVerifiedEnrollment({ firebaseAdmin, idToken, customer, db, authorization, nowSeconds }) {
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 16384) {
    return {ok:false,reason:'invalid_firebase_token'};
  }
  if (!authorization || authorization.approvedCustomerUuid !== customer?.profile?.id ||
      authorization.consentRecorded !== true || authorization.independentCustomerIdentityProof !== true ||
      authorization.ambiguousPhoneOwnership !== false || authorization.signatureAndRevocationChecked !== true) {
    return {ok:false,reason:'independent_authorization_required'};
  }
  let decoded;
  try {
    // Firebase Admin must validate signature, expiry and revocation.
    decoded = await firebaseAdmin.verifyIdToken(idToken, true);
  } catch {
    return {ok:false,reason:'invalid_or_revoked_token'};
  }
  const {data:uidLinks,error:uidErr} = await db.from('customer_firebase_identity_links')
    .select('firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active')
    .eq('firebase_project_id','insureit-customer-auth').eq('firebase_uid',decoded.uid);
  const {data:profileLinks,error:profileErr} = await db.from('customer_firebase_identity_links')
    .select('firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active')
    .eq('profile_id',customer.profile.id);
  if (uidErr || profileErr || !Array.isArray(uidLinks) || !Array.isArray(profileLinks)) {
    return {ok:false,reason:'mapping_audit_unavailable'};
  }
  const links=[...uidLinks,...profileLinks.filter(x=>!uidLinks.some(y=>y.firebase_uid===x.firebase_uid))];
  const decision=assessCustomerFirebaseEnrollment({
    profile:customer.profile, authUser:customer.authUser, firebase:decoded, links, nowSeconds,
    attested:{...authorization, project:'insureit-customer-auth',firebaseUid:decoded.uid,verifiedPhone:decoded.phone_number}
  });
  if (!decision.ok) return decision;
  // Deliberately no UPDATE/INSERT: enrollment approval is a separate signed
  // operator operation and must be atomic and auditable before activation.
  return {ok:true,action:decision.action,profileId:decision.profileId};
}

/**
 * Service-only, explicit operator execution. The caller MUST supply a trusted
 * independently authenticated operator approval; this function is not an HTTP
 * endpoint and never accepts public-client requests.
 */
export async function commitVerifiedEnrollment({ firebaseAdmin, idToken, customer, db,
    authorization, operator, evidenceDigest, nowSeconds, apply=false }) {
  if (apply !== true) return {ok:false,reason:'dry_run_only'};
  if (!operator || operator.verifiedPrivilegedStaff !== true ||
      typeof operator.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(operator.id) ||
      typeof evidenceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(evidenceDigest)) {
    return {ok:false,reason:'privileged_operator_and_evidence_required'};
  }
  const checked=await prepareVerifiedEnrollment({
    firebaseAdmin,idToken,customer,db,authorization,nowSeconds
  });
  if (!checked.ok || checked.action !== 'manual_approval_required') return checked;
  // Service-only Postgres function holds locks, checks both accounts/phones and
  // writes approved mapping + audit in a single transaction.
  const refreshed=await firebaseAdmin.verifyIdToken(idToken,true).catch(()=>null);
  if (!refreshed || refreshed.uid !== authorization.firebaseUid ||
      refreshed.phone_number !== authorization.verifiedPhone) {
    return {ok:false,reason:'verified_identity_changed'};
  }
  const result=await db.rpc('customer_firebase_enroll_approved',{
    p_profile_id:checked.profileId,
    p_firebase_uid:refreshed.uid,
    p_verified_phone:refreshed.phone_number,
    p_operator_id:operator.id,
    p_evidence_digest:evidenceDigest,
  });
  if (result.error) return {ok:false,reason:'atomic_enrollment_rejected'};
  return result.data === 'enrolled'
    ? {ok:true,action:'enrolled'}
    : {ok:false,reason:'enrollment_result_unexpected'};
}
