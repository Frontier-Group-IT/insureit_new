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
