import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkCustomerSessionEligibility, FIREBASE_CUSTOMER_PROJECT } from '../../../supabase/functions/_shared/customer-firebase-session-policy.mjs';

const id = '1e1e1e1e-1111-4111-8111-111111111111';
const otherId = '2e2e2e2e-2222-4222-8222-222222222222';
const now = 1_800_000_000;
const alias = 'c-' + id + '@customer-login.insureit.invalid';
function state() {
  return {
    nowSeconds: now,
    firebase: {
      uid: 'firebase-user-A',
      aud: FIREBASE_CUSTOMER_PROJECT,
      iss: `https://securetoken.google.com/${FIREBASE_CUSTOMER_PROJECT}`,
      phone_number: '+919876543210',
      auth_time: now - 20,
      firebase: { sign_in_provider: 'phone' },
    },
    link: { firebase_project_id: FIREBASE_CUSTOMER_PROJECT,
      firebase_uid: 'firebase-user-A', profile_id: id, is_approved: true,
      is_active: true, verified_phone_at_approval: '+919876543210' },
    profile: { id, phone: '919876543210', role: 'customer', is_active: true },
    authUser: { id, phone: '+919876543210', email: alias,
      email_confirmed_at: '2026-10-10T00:00:00Z', is_anonymous: false },
  };
}
const verify = (change, reason) => {
  const args = state();
  change(args);
  const result = checkCustomerSessionEligibility(args);
  assert.equal(result.ok, false);
  assert.equal(result.reason, reason);
};

test('allows only an existing verified email identity with matching canonical UUID', () => {
  const input = state();
  assert.deepEqual(checkCustomerSessionEligibility(input), {
    ok: true, customerProfileId: id, verifiedExistingEmail: alias,
  });
});

test('blocks current phone-only customer (no silent email alias or new user)', () => {
  verify(({ authUser }) => { authUser.email = null; }, 'session_identity_not_provisioned');
});

test('rejects real contact/email addresses even when confirmed; only the fixed service-only alias is allowed', () => {
  verify(({ authUser }) => { authUser.email = 'customer@example.com'; }, 'session_identity_not_provisioned');
});

test('blocks unconfirmed email', () => {
  verify(({ authUser }) => { authUser.email_confirmed_at = null; }, 'session_identity_not_provisioned');
});

test('blocks another customer UUID', () => {
  verify(({ authUser }) => { authUser.id = otherId; }, 'supabase_user_mismatch');
});

test('blocks a Firebase UID mapped to another user', () => {
  verify(({ firebase }) => { firebase.uid = 'firebase-user-B'; }, 'identity_link_not_approved');
});

test('blocks a phone number changed after mapping approval', () => {
  verify(({ firebase }) => { firebase.phone_number = '+919812345678'; }, 'identity_link_not_approved');
});

test('accepts existing Supabase 91-prefixed 12-digit phone without mutating the account', () => {
  const input = state();
  input.authUser.phone = '919876543210';
  assert.equal(checkCustomerSessionEligibility(input).ok, true);
});

test('blocks a Supabase phone mismatch', () => {
  verify(({ authUser }) => { authUser.phone = '+919812345678'; }, 'supabase_user_mismatch');
});

test('blocks inactive, unapproved or deleted links', () => {
  verify(({ link }) => { link.is_approved = false; }, 'identity_link_not_approved');
  verify(({ link }) => { link.is_active = false; }, 'identity_link_not_approved');
  verify(args => { args.link = null; }, 'identity_link_not_approved');
});

test('blocks stale phone changes on the Customer profile independently of auth.users', () => {
  verify(({ profile }) => { profile.phone = '919812345678'; }, 'customer_unavailable');
});

test('blocks inactive or staff profile', () => {
  verify(({ profile }) => { profile.is_active = false; }, 'customer_unavailable');
  verify(({ profile }) => { profile.role = 'it_super_user'; }, 'customer_unavailable');
});

test('blocks wrong Firebase issuer, audience or provider', () => {
  verify(({ firebase }) => { firebase.aud = 'other-project'; }, 'invalid_firebase_principal');
  verify(({ firebase }) => { firebase.iss = 'https://other'; }, 'invalid_firebase_principal');
  verify(({ firebase }) => { firebase.firebase.sign_in_provider = 'password'; }, 'invalid_firebase_principal');
});

test('rejects stale, missing, impossible or future Firebase auth_time', () => {
  verify(({ firebase }) => { firebase.auth_time = now - 301; }, 'invalid_firebase_principal');
  verify(({ firebase }) => { delete firebase.auth_time; }, 'invalid_firebase_principal');
  verify(({ firebase }) => { firebase.auth_time = now + 31; }, 'invalid_firebase_principal');
});

test('blocks anonymous, banned and missing auth users', () => {
  verify(({ authUser }) => { authUser.is_anonymous = true; }, 'supabase_user_mismatch');
  verify(({ authUser }) => { authUser.banned_until = '2099-01-01T00:00:00Z'; }, 'supabase_user_mismatch');
  verify(input => { input.authUser = null; }, 'supabase_user_mismatch');
});

test('Edge candidate is off by default and cannot mutate/create Auth users', () => {
  const source = readFileSync(
    new URL('../../../supabase/functions/customer-firebase-session-bridge/index.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED/);
  assert.match(source, /!== "true"/);
  assert.match(source, /verifyIdToken\(bearer\[1\], true\)/);
  assert.match(source, /auth\.admin\.getUserById/);
  assert.match(source, /issueExistingCustomerSessionChallenge/);
  const challenge = readFileSync(
    new URL('../../../supabase/functions/_shared/customer-firebase-session-challenge.mjs', import.meta.url),
    'utf8',
  );
  assert.match(challenge, /generateLink/);
  assert.match(challenge, /data\?\.user\?\.id !== gate\.customerProfileId/);
  assert.doesNotMatch(source, /auth\.admin\.(?:createUser|updateUserById|deleteUser)\s*\(/);
  assert.doesNotMatch(source, /signInWithPassword|setSession\s*\(/);
});

test('same verified Firebase phone cannot authorize a separate IT Super User Auth identity', () => {
  const customer = state();
  const staff = {
    ...customer.authUser,
    id: otherId,
    email: 'staff@example.com',
    email_confirmed_at: '2026-10-10T00:00:00Z',
  };
  const otherRole = { ...customer.profile, id: otherId, role: 'it_super_user' };
  assert.equal(checkCustomerSessionEligibility({ ...customer, profile: otherRole, authUser: staff }).reason, 'customer_unavailable');
  assert.equal(checkCustomerSessionEligibility({ ...customer, authUser: staff }).reason, 'supabase_user_mismatch');
  assert.equal(checkCustomerSessionEligibility({ ...customer, link: { ...customer.link, profile_id: otherId } }).reason, 'customer_unavailable');
});


test('shared phone never substitutes an approved Customer UID mapping with a staff mapping', () => {
  const input = state();
  const staffIdentity = { ...input, link: { ...input.link, profile_id: otherId },
    profile: { ...input.profile, id: otherId, role: 'it_super_user' },
    authUser: { ...input.authUser, id: otherId, email: 'staff@example.com' } };
  assert.equal(checkCustomerSessionEligibility(staffIdentity).reason, 'customer_unavailable');
  const mismatchedUid = { ...input, firebase: { ...input.firebase, uid: 'firebase-user-for-staff' } };
  assert.equal(checkCustomerSessionEligibility(mismatchedUid).reason, 'identity_link_not_approved');
  const mismatchedApprovedNumber = { ...input, link: { ...input.link,
    verified_phone_at_approval: '+919812345678' } };
  assert.equal(checkCustomerSessionEligibility(mismatchedApprovedNumber).reason, 'identity_link_not_approved');
});

test('unprovisioned Customer remains denied despite valid Firebase phone and approval', () => {
  const input = state();
  input.authUser.email = null;
  input.authUser.email_confirmed_at = null;
  assert.equal(checkCustomerSessionEligibility(input).reason, 'session_identity_not_provisioned');
});
