/**
 * Pre-approval proof that an SMS-verified Firebase phone is the exact same
 * pre-existing Supabase Auth customer as the matched active profile.
 *
 * Does NOT verify Firebase signatures; caller MUST verify Firebase Admin
 * token+revocation and current SMS phone before calling. No writes here.
 */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const phone = /^\+91[6-9]\d{9}$/;
function normalizeIndianPhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[ +()-]/g, '');
  if (!/^(91)?[6-9]\d{9}$/.test(digits)) return null;
  return '+91' + digits.slice(-10);
}

export function checkExistingCustomerPhoneBinding({ verifiedPhone, profile, authUser, nowSeconds }) {
  if (!phone.test(verifiedPhone ?? '') || !profile || !uuid.test(profile.id ?? '') ||
      profile.role !== 'customer' || profile.is_active !== true ||
      normalizeIndianPhone(profile.phone) !== verifiedPhone) {
    return { ok: false, reason: 'profile_not_bindable' };
  }
  if (!authUser || authUser.id !== profile.id || authUser.is_anonymous === true ||
      normalizeIndianPhone(authUser.phone) !== verifiedPhone ||
      (typeof authUser.banned_until === 'string' && Number.isFinite(nowSeconds) &&
        Date.parse(authUser.banned_until) > nowSeconds * 1000)) {
    return { ok: false, reason: 'auth_account_not_bindable' };
  }
  return { ok: true, profileId: profile.id };
}
