const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../supabase/functions/customer-firebase-signup/index.ts'),'utf8');

test('new signup only after revoked-token-aware Firebase Admin phone verification',()=>{
  assert.match(source,/verifyIdToken\(bearer\[1\], true\)/);
  assert.match(source,/decoded\.aud !== PROJECT/);
  assert.match(source,/decoded\.iss !== ISSUER/);
  assert.match(source,/decoded\.firebase\?\.sign_in_provider !== "phone"/);
  assert.match(source,/now - decoded\.auth_time > 300/);
  assert.ok(source.indexOf('verifyIdToken(bearer[1], true)') < source.indexOf('createClient(supabaseUrl, serviceKey'));
});

test('no profile ID, Firebase UID, role or phone may be supplied in signup body',()=>{
  assert.match(source,/\["fullName", "email"\]/);
  assert.match(source,/unrecognized_signup_field/);
  assert.match(source,/payload_too_large/);
  assert.match(source,/bodyBytes > 2048/);
  assert.match(source,/phone: decoded\.phone_number/);
  assert.match(source,/phone_confirm: true/);
  assert.match(source,/app_metadata: \{ app_role: "customer" \}/);
  assert.doesNotMatch(source,/phone: record\./);
  assert.doesNotMatch(source,/role: record\./);
});

test('verified phone and Firebase UID cannot silently create duplicate profiles',()=>{
  assert.match(source,/\.eq\("firebase_uid", decoded\.uid\)/);
  assert.match(source,/existingLinks\.length > 0/);
  assert.match(source,/profiles\.some\(\(profile\) => canonicalIndianPhone\(profile\.phone\) === decoded\.phone_number\)/);
  assert.match(source,/profiles\.length === 1000/);
  assert.match(source,/phone_already_registered/);
  assert.match(source,/firebase_identity_registered/);
  assert.match(source,/customer_registration_unavailable/);
});

test('new customer provisioning never supplies a Supabase session, role key, or verified email',()=>{
  assert.match(source,/auth\.admin\.createUser/);
  assert.doesNotMatch(source,/email_confirm: true/);
  assert.doesNotMatch(source,/await firebase\.setCustomUserClaims/);
  assert.doesNotMatch(source,/return reply\(201, \{[^\n]*(?:access_token|refresh_token|service_role)/i);
  assert.match(source,/requiresBinding: true/);
  assert.match(source,/cache-control": "no-store"/);
});

const nativeCustomerAuth = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/firebase-customer-auth.ts'),'utf8');
test('native signup provisions only after Firebase phone code verification and reuses canonical binder',()=>{
  assert.match(nativeCustomerAuth,/pendingFlow\.verify\(code\)/);
  assert.match(nativeCustomerAuth,/functions\/v1\/customer-firebase-signup/);
  assert.match(nativeCustomerAuth,/registration\.status !== 409 \|\| failure\.error !== 'phone_already_registered'/);
  assert.match(nativeCustomerAuth,/functions\/v1\/customer-firebase-bind/);
  assert.match(nativeCustomerAuth,/firebaseUser\.getIdToken\(true\)/);
  assert.match(nativeCustomerAuth,/rpc\('customer_firebase_profile_id'\)/);
  assert.match(nativeCustomerAuth,/export function confirmFirebaseCustomerSignup/);
});

test('new verified customer is given an owned Customer App onboarding application',()=>{
  assert.match(source,/db\.from\("customer_onboarding_applications"\)/);
  assert.match(source,/profile_id: data\.user\.id/);
  assert.match(source,/initiated_by: data\.user\.id/);
  assert.match(source,/source: "customer_app"/);
  assert.match(source,/partner_type: "individual_proprietor"/);
  assert.match(source,/status: "not_started"/);
  assert.match(source,/applicant_phone: decoded\.phone_number/);
  assert.ok(source.indexOf('const { error: onboardingError }') < source.indexOf('return reply(201'));
  assert.match(source,/if \(onboardingError\) \{/);
  assert.match(source,/db\.auth\.admin\.deleteUser\(data\.user\.id\)/);
});
