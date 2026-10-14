import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCustomerSessionEligibility, FIREBASE_CUSTOMER_PROJECT } from '../../../supabase/functions/_shared/customer-firebase-session-policy.mjs';

const id = '1e1e1e1e-1111-4111-8111-111111111111';
const otherId = '2e2e2e2e-2222-4222-8222-222222222222';
const now = 1_800_000_000;
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
    profile: { id, role: 'customer', is_active: true },
    authUser: { id, phone: '+919876543210', email: 'verified@example.org',
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
    ok: true, customerProfileId: id, verifiedExistingEmail: 'verified@example.org',
  });
});

test('blocks current phone-only customer (no silent email alias or new user)', () => {
  verify(({ authUser }) => { authUser.email = null; }, 'session_identity_not_provisioned');
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
