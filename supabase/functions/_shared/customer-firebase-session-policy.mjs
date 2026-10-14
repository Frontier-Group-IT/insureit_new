/**
 * Deny-by-default authorization policy for the PROPOSED Firebase SMS ->
 * preexisting Supabase Auth session bridge.
 *
 * This policy does NOT verify JWT signatures. The calling Edge function MUST
 * independently verify the Firebase bearer token with Firebase Admin SDK,
 * including revocation, before calling this function.
 *
 * No Supabase email aliases or Auth identities are created here.
 */
export const FIREBASE_CUSTOMER_PROJECT = 'insureit-customer-auth';

const phonePattern = /^\+91[6-9]\d{9}$/;
export function canonicalIndianPhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[ +()-]/g, '');
  if (!/^(91)?[6-9][0-9]{9}$/.test(digits)) return null;
  return '+91' + digits.slice(-10);
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function checkCustomerSessionEligibility({ firebase, link, profile, authUser, nowSeconds }) {
  const fail = (reason) => Object.freeze({ ok: false, reason });
  if (!firebase || typeof nowSeconds !== 'number' || !Number.isFinite(nowSeconds)) {
    return fail('invalid_firebase_principal');
  }
  const phone = firebase.phone_number;
  if (firebase.aud !== FIREBASE_CUSTOMER_PROJECT ||
    firebase.iss !== `https://securetoken.google.com/${FIREBASE_CUSTOMER_PROJECT}` ||
    typeof firebase.uid !== 'string' || !firebase.uid ||
    !phonePattern.test(phone ?? '') ||
    firebase.firebase?.sign_in_provider !== 'phone' ||
    !Number.isSafeInteger(firebase.auth_time) ||
    firebase.auth_time > nowSeconds + 30 ||
    nowSeconds - firebase.auth_time > 300) {
    return fail('invalid_firebase_principal');
  }

  if (!link || link.firebase_project_id !== FIREBASE_CUSTOMER_PROJECT ||
    link.firebase_uid !== firebase.uid ||
    link.verified_phone_at_approval !== phone ||
    link.is_approved !== true || link.is_active !== true ||
    typeof link.profile_id !== 'string' || !uuidPattern.test(link.profile_id)) {
    return fail('identity_link_not_approved');
  }

  if (!profile || profile.id !== link.profile_id ||
    profile.role !== 'customer' || profile.is_active !== true ||
    canonicalIndianPhone(profile.phone) !== phone) {
    return fail('customer_unavailable');
  }

  // auth.users.id is the canonical customer UUID used by every existing RLS
  // policy and by the current multi-account session vault. No new UUIDs.
  if (!authUser || authUser.id !== profile.id ||
    authUser.is_anonymous === true ||
    authUser.banned_until && Date.parse(authUser.banned_until) > nowSeconds * 1000 ||
    canonicalIndianPhone(authUser.phone) !== phone) {
    return fail('supabase_user_mismatch');
  }

  // The standard Admin generateLink('magiclink') API needs an existing
  // verified Supabase Auth email identity. All 24 active INSUREIT Customer
  // accounts presently have none. Never make one implicitly in this request.
  if (typeof authUser.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authUser.email) ||
    !authUser.email_confirmed_at) {
    return fail('session_identity_not_provisioned');
  }

  return Object.freeze({
    ok: true,
    customerProfileId: profile.id,
    verifiedExistingEmail: authUser.email,
  });
}
