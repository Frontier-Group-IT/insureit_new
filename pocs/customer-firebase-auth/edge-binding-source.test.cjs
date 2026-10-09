const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../supabase/functions/customer-firebase-bind/index.ts'),'utf8');
test('Firebase Admin checks revoked token before any privileged data access',()=>{
  assert.match(source,/verifyIdToken\(bearer\[1\], true\)/);
  assert.ok(source.indexOf('verifyIdToken(bearer[1], true)') < source.indexOf('createClient(supabaseUrl, serviceKey'));
});
test('inactive mapping denied and role assigned after link stored',()=>{
  assert.match(source,/existing\.some\(\(l\) => !l\.is_approved \|\| !l\.is_active\)/);
  assert.ok(source.indexOf('if (insertError) return') < source.indexOf('setCustomUserClaims(decoded.uid'));
});
test('no client supplied profile, role or phone can influence account binding',()=>{
  assert.doesNotMatch(source,/await request\.json\(/);
  assert.match(source,/canonicalIndianPhone\(p\.phone\) === decoded\.phone_number/);
  assert.match(source,/if \(matches\.length !== 1\) return reply\(409/);
  assert.match(source,/\.eq\("firebase_project_id", PROJECT\)/);
});

const otpProvider = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/customer-otp-provider.ts'),'utf8');
const firebaseClient = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/firebase-data-client.ts'),'utf8');
const nativeFlow = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/firebase-customer-auth.ts'),'utf8');

test('existing Supabase OTP remains available as a safe production fallback',()=>{
  assert.match(otpProvider,/return legacySupabaseOtpProvider;/);
  assert.match(otpProvider,/shouldCreateUser: false/);
  assert.match(otpProvider,/shouldCreateUser: true/);
  assert.match(otpProvider,/supabase\.auth\.verifyOtp/);
});

test('Firebase identity and recent phone authentication are required before privileged lookup',()=>{
  for (const guard of [
    /decoded\.aud !== PROJECT/, /decoded\.iss !== ISSUER/,
    /decoded\.firebase\?\.sign_in_provider !== "phone"/,
    /now - decoded\.auth_time > 300/,
    /if \(matches\.length !== 1\) return reply\(409/,
    /l\.profile_id !== profileId/, /l\.firebase_uid !== decoded\.uid/,
    /l\.verified_phone_at_approval !== decoded\.phone_number/,
  ]) assert.match(source,guard);
  assert.ok(source.indexOf('now - decoded.auth_time > 300') < source.indexOf('createClient(supabaseUrl, serviceKey'));
});

test('Firebase data access uses per-request ID token, never privileged database credentials',()=>{
  assert.match(firebaseClient,/accessToken: async \(\) =>/);
  assert.match(firebaseClient,/if \(!token\) throw new Error/);
  assert.match(firebaseClient,/persistSession: false/);
  assert.doesNotMatch(firebaseClient,/SERVICE_ROLE_KEY|service_role/);
  assert.doesNotMatch(firebaseClient,/setSession\(/);
});

test('Firebase binding must be confirmed by a token refresh and canonical profile resolver',()=>{
  assert.match(nativeFlow,/getIdToken\(true\)/);
  assert.match(nativeFlow,/rpc\('customer_firebase_profile_id'\)/);
  assert.match(nativeFlow,/current\?\.uid === uid/);
  assert.match(nativeFlow,/if \(error \|\| typeof data !== 'string'\) throw/);
});

test('binding endpoint fails closed for unknown customers without creating or changing existing records',()=>{
  assert.match(source,/customer_requires_review/);
  assert.doesNotMatch(source,/\.from\("profiles"\)\.insert\(/);
  assert.doesNotMatch(source,/\.from\("customers"\)\.insert\(/);
  assert.doesNotMatch(source,/\.from\("profiles"\)\.update\(/);
});

test('release gate: no Firebase primary auth while UUID-subject incompatibility remains unresolved',()=>{
  // Several existing PostgreSQL RLS policies still call auth.uid().
  // A Firebase JWT carries a provider UID, not necessarily a UUID. Production
  // read-only SQL verification raised SQLSTATE 22P02 for a Firebase-style UID.
  // Keep Supabase OTP until scoped token handling and negative RLS tests pass.
  assert.match(otpProvider,/export function activeCustomerOtpProvider/);
  assert.match(otpProvider,/return legacySupabaseOtpProvider;/);
  assert.doesNotMatch(otpProvider,/return firebaseOtpProvider;/);
});
