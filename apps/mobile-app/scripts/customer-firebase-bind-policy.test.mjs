import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkExistingCustomerPhoneBinding } from '../../../supabase/functions/_shared/customer-firebase-bind-policy.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const now = 1_800_000_000;
function input() {
  return {
    verifiedPhone: '+919876543210',
    nowSeconds: now,
    profile: { id, role: 'customer', is_active: true, phone: '919876543210' },
    authUser: { id, phone: '919876543210', is_anonymous: false },
  };
}
function denied(mutate, reason) {
  const arg = input(); mutate(arg);
  const r = checkExistingCustomerPhoneBinding(arg);
  assert.deepEqual(r, { ok: false, reason });
}
test('accept same canonical profile/Auth UUID and both Indian phone formats', () => {
  assert.deepEqual(checkExistingCustomerPhoneBinding(input()), { ok: true, profileId: id });
  const x = input(); x.authUser.phone = '+919876543210';
  assert.deepEqual(checkExistingCustomerPhoneBinding(x), { ok: true, profileId: id });
});
test('deny stale profile phone and inactive/staff customer before any link insert', () => {
  denied(a => { a.profile.phone = '919876543211'; }, 'profile_not_bindable');
  denied(a => { a.profile.is_active = false; }, 'profile_not_bindable');
  denied(a => { a.profile.role = 'manager'; }, 'profile_not_bindable');
  denied(a => { a.profile.id = 'invalid'; }, 'profile_not_bindable');
});
test('deny UUID mismatch, different Auth phone, disabled/anonymous Auth identities', () => {
  denied(a => { a.authUser.phone = '919876543211'; }, 'auth_account_not_bindable');
  denied(a => { a.authUser.id = '22222222-2222-4222-8222-222222222222'; }, 'auth_account_not_bindable');
  denied(a => { a.authUser.is_anonymous = true; }, 'auth_account_not_bindable');
  denied(a => { a.authUser.banned_until = '2099-01-01T00:00:00Z'; }, 'auth_account_not_bindable');
  denied(a => { a.authUser = null; }, 'auth_account_not_bindable');
});
test('verified Firebase phone proof cannot target another phone', () => {
  denied(a => { a.verifiedPhone = '+919876543211'; }, 'profile_not_bindable');
  denied(a => { a.verifiedPhone = '919876543210'; }, 'profile_not_bindable');
  denied(a => { a.verifiedPhone = ''; }, 'profile_not_bindable');
});
test('Firebase bind endpoint is approval-only and never issues Firebase authorization claims', () => {
  const source=readFileSync(new URL('../../../supabase/functions/customer-firebase-bind/index.ts', import.meta.url), 'utf8');
  assert.match(source, /checkExistingCustomerPhoneBinding\(\{/);
  assert.match(source, /db\.auth\.admin\.getUserById\(profileId\)/);
  assert.match(source, /verifyIdToken\(bearer\[1\], true\)/);
  assert.match(source, /existing\.length !== 1/);
  assert.match(source, /identity_requires_approval/);
  assert.doesNotMatch(source, /\.insert\s*\(/);
  assert.doesNotMatch(source, /setCustomUserClaims/);
  assert.match(source, /Firebase is SMS VERIFICATION ONLY/);
});


test('approved-only binder is read-only even when an active profile matches the Firebase phone', () => {
  const source=readFileSync(new URL('../../../supabase/functions/customer-firebase-bind/index.ts', import.meta.url),'utf8');
  assert.match(source, /existing\.length !== 1/);
  assert.match(source, /existing\[0\]\.firebase_uid !== decoded\.uid/);
  assert.match(source, /existing\[0\]\.profile_id !== profileId/);
  assert.match(source, /!existing\[0\]\.is_approved \|\| !existing\[0\]\.is_active/);
  assert.doesNotMatch(source, /\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|setCustomUserClaims/);
});
