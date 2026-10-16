import { customerAuthAlias } from './customer-firebase-session-alias.mjs';
import { canonicalIndianPhone } from './customer-firebase-session-policy.mjs';

const PROJECT = 'insureit-customer-auth';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny = reason => Object.freeze({ok:false, reason});

/**
 * Offline-only migration decision. It NEVER creates a link or changes Auth.
 * The operator must prove the signed/revocation-checked Firebase principal
 * separately; phone possession alone is not enrollment approval.
 */
export function assessCustomerFirebaseEnrollment({ profile, authUser, firebase, links, nowSeconds, attested }) {
  if (!Number.isSafeInteger(nowSeconds) || !attested ||
      attested.project !== PROJECT || attested.signatureAndRevocationChecked !== true ||
      attested.consentRecorded !== true || attested.approvedCustomerUuid !== profile?.id) {
    return deny('independent_attestation_required');
  }
  if (!profile || !UUID.test(profile.id ?? '') ||
      profile.role !== 'customer' || profile.is_active !== true ||
      !authUser || authUser.id !== profile.id || authUser.is_anonymous === true ||
      (authUser.banned_until && Date.parse(authUser.banned_until) > nowSeconds * 1000)) {
    return deny('canonical_customer_mismatch');
  }
  const phone = canonicalIndianPhone(profile.phone);
  if (!phone || canonicalIndianPhone(authUser.phone) !== phone ||
      firebase?.phone_number !== phone || firebase?.aud !== PROJECT ||
      firebase?.iss !== 'https://securetoken.google.com/' + PROJECT ||
      firebase?.firebase?.sign_in_provider !== 'phone' ||
      !firebase.uid || typeof firebase.uid !== 'string' ||
      !Number.isSafeInteger(firebase.auth_time) ||
      firebase.auth_time > nowSeconds + 30 || nowSeconds - firebase.auth_time > 300 ||
      attested.firebaseUid !== firebase.uid || attested.verifiedPhone !== phone) {
    return deny('verified_phone_or_uid_mismatch');
  }
  if (attested.ambiguousPhoneOwnership !== false || attested.independentCustomerIdentityProof !== true) {
    return deny('shared_phone_or_account_review_required');
  }
  if (!Array.isArray(links)) return deny('mapping_audit_missing');
  if (links.some(link => link.firebase_uid === firebase.uid && link.profile_id !== profile.id ||
      link.profile_id === profile.id && link.firebase_uid !== firebase.uid ||
      link.firebase_project_id !== PROJECT)) {
    return deny('immutable_identity_link_conflict');
  }
  if (links.length > 1) return deny('mapping_audit_ambiguous');
  if (links.length === 1) {
    const link = links[0];
    if (link.profile_id !== profile.id || link.firebase_uid !== firebase.uid ||
        link.verified_phone_at_approval !== phone || !link.is_active || !link.is_approved) {
      return deny('existing_link_requires_review');
    }
    return Object.freeze({ok:true, action:'already_approved', profileId:profile.id});
  }
  return Object.freeze({ok:true, action:'manual_approval_required', profileId:profile.id});
}

export function assessCustomerAuthAliasMigration({ profile, authUser, approvedLink, recovery }) {
  const id = profile?.id;
  const alias = customerAuthAlias(id);
  if (!alias || profile?.role !== 'customer' || profile.is_active !== true ||
      !authUser || authUser.id !== id ||
      canonicalIndianPhone(profile.phone) !== canonicalIndianPhone(authUser.phone) ||
      !canonicalIndianPhone(authUser.phone)) return deny('canonical_customer_mismatch');
  if (!approvedLink || approvedLink.profile_id !== id ||
      approvedLink.is_approved !== true || approvedLink.is_active !== true ||
      approvedLink.verified_phone_at_approval !== canonicalIndianPhone(authUser.phone)) {
    return deny('approved_uid_link_required');
  }
  if (authUser.email && authUser.email.toLowerCase() !== alias) return deny('existing_auth_email_must_not_be_replaced');
  if (authUser.email?.toLowerCase() === alias && authUser.email_confirmed_at) {
    return Object.freeze({ok:true,action:'already_provisioned'});
  }
  if (recovery?.recoverableSnapshotVerified !== true ||
      recovery?.outOfBandEncryptedStorageVerified !== true ||
      recovery?.rollbackProcedureRehearsed !== true ||
      recovery?.credentialRotationApproved !== true ||
      recovery?.emailRecoveryAndPasswordSignInRiskAccepted !== true ||
      recovery?.targetUuid !== id) return deny('recovery_and_credential_rotation_gate_required');
  return Object.freeze({ok:true,action:'manual_single_customer_canary_only'});
}
