const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/customer-identity.ts'),'utf8');

test('Firebase customer identity and Supabase session are tagged, never conflated',()=>{
  assert.match(source,/provider: 'supabase'/);
  assert.match(source,/provider: 'firebase'/);
  assert.match(source,/session: Session/);
  assert.match(source,/firebaseUid: string/);
  assert.doesNotMatch(source,/as Session/);
  assert.doesNotMatch(source,/supabase\.auth\.setSession/);
});

test('Firebase mode requires an explicit Android rollout flag and approved profile',()=>{
  assert.match(source,/Platform\.OS === 'android'/);
  assert.match(source,/EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_ENABLED === 'true'/);
  assert.match(source,/selectCustomerAuthProvider/);
  assert.match(source,/getAuth\(\)\.currentUser/);
  assert.match(source,/current\?\.uid === uid/);
  assert.match(source,/rpc\('customer_firebase_profile_id'\)/);
  assert.match(source,/profile\.role !== 'customer' \|\| !profile\.is_active/);
});

test('failed Firebase session must not silently restore a different Supabase account',()=>{
  assert.match(source,/if \(mode === 'firebase'\)/);
  assert.match(source,/return verifiedFirebaseCustomer\(\)/);
  assert.match(source,/if \(!uid\) return null/);
  assert.match(source,/supabase\.auth\.getSession\(\)/);
});
